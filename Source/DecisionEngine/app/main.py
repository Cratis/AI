# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""The Cratis Decision Engine service.

Five routes, no model-specific vocabulary in any of them. See Decision API v1.
"""

from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from .contract import (
    DecisionBatchRequest,
    DecisionBatchResponse,
    DecisionRequest,
    DecisionResponse,
    ModelInfo,
)
from .model import MODEL, ModelNotLoaded, ScoringTask
from .scoring import ENGINE, normalize, truncate
from .settings import SETTINGS
from .telemetry import CHOICES, LATENCY, MODEL_LOADED, REQUESTS, TOP_PROBABILITY

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Load the model before the first request, and mark readiness only once it is loaded."""
    MODEL_LOADED.set(0)
    try:
        MODEL.load()
        MODEL_LOADED.set(1)
    except Exception:
        # Deliberately not fatal: the process stays up so /healthz keeps answering and the pod is
        # not restart-looped while a slow or failing artifact download is diagnosed. /readyz stays
        # false, so it receives no traffic either way.
        logger.exception("model failed to load")
    yield


app = FastAPI(title="Cratis Decision Engine", version="1.0", lifespan=lifespan)


@app.post("/v1/decisions", response_model=DecisionResponse)
def decide(request: DecisionRequest) -> DecisionResponse:
    """Weigh one set of choices against one context."""
    return _decide([request])[0]


@app.post("/v1/decisions/batch", response_model=DecisionBatchResponse)
def decide_batch(request: DecisionBatchRequest) -> DecisionBatchResponse:
    """Weigh several independent questions in one round trip."""
    if len(request.decisions) > SETTINGS.max_batch:
        raise HTTPException(
            status_code=422,
            detail=f"{len(request.decisions)} requests exceeds the batch limit of {SETTINGS.max_batch}",
        )

    # Every decision in the batch is scored in one pass over the model rather than one pass each.
    # This endpoint exists because a caller weighing many candidates should not pay N round trips;
    # it would be a poor trade if it then paid N forward passes on this side instead.
    return DecisionBatchResponse(results=_decide(request.decisions))


@app.get("/v1/model", response_model=ModelInfo)
def model_info() -> ModelInfo:
    """What is currently loaded."""
    loaded_at = MODEL.loaded_at
    return ModelInfo(
        model=SETTINGS.model,
        revision=SETTINGS.model_revision,
        runtime=SETTINGS.runtime,
        loadedAt=loaded_at.isoformat() if loaded_at else None,
    )


@app.get("/healthz")
def healthz() -> dict[str, str]:
    """Liveness. The process is up; says nothing about the model."""
    return {"status": "ok"}


@app.get("/readyz")
def readyz() -> dict[str, str]:
    """Readiness. False until the model can actually score."""
    if not MODEL.is_loaded:
        raise HTTPException(status_code=503, detail="model is not loaded")
    return {"status": "ready"}


@app.get("/metrics")
def metrics() -> Response:
    """Prometheus exposition."""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


def _decide(requests: list[DecisionRequest]) -> list[DecisionResponse]:
    for request in requests:
        if request.context.is_empty():
            REQUESTS.labels(outcome="rejected").inc()
            raise HTTPException(status_code=422, detail="context is empty")

        if len(request.choices) > SETTINGS.max_choices:
            REQUESTS.labels(outcome="rejected").inc()
            raise HTTPException(
                status_code=422,
                detail=f"{len(request.choices)} choices exceeds the limit of {SETTINGS.max_choices}",
            )

    started = time.perf_counter()
    tasks = [
        ScoringTask(
            context=truncate(request.context.render(), SETTINGS.max_context_chars),
            choices=request.choices,
            question=request.question,
            descriptions=request.descriptions,
        )
        for request in requests
    ]

    forward_started = time.perf_counter()
    try:
        scored = MODEL.score(tasks)
    except ModelNotLoaded as error:
        REQUESTS.labels(outcome="unavailable").inc()
        raise HTTPException(status_code=503, detail=str(error)) from error
    LATENCY.labels(phase="forward").observe(time.perf_counter() - forward_started)

    elapsed = time.perf_counter() - started
    # Attributed per decision, so the histogram means the same thing whether a caller sent one
    # decision or thirty. Batch throughput is visible as the choices-per-request histogram.
    per_decision = elapsed / len(requests)

    responses: list[DecisionResponse] = []
    for request, choice_scores in zip(requests, scored, strict=True):
        distribution = normalize(choice_scores, SETTINGS.temperature)

        LATENCY.labels(phase="total").observe(per_decision)
        CHOICES.observe(len(request.choices))
        TOP_PROBABILITY.observe(max(distribution.values()))
        REQUESTS.labels(outcome="decided").inc()

        responses.append(DecisionResponse(
            requestId=request.requestId or uuid.uuid4().hex,
            choices=distribution,
            model=SETTINGS.model,
            engine=ENGINE,
            latencyMs=per_decision * 1000,
        ))

    return responses
