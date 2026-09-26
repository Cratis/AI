"""Cratis Decision API v1 adapter for stock Laya. No Laya source changes."""
import asyncio
import math
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field, model_validator
from laya.router import Router

MODEL = os.environ.get("DECISION_LAYA_MODEL", "multilingual")
if MODEL not in ("multilingual", "english", "typed-decisions"):
    raise ValueError(f"unsupported Laya checkpoint: {MODEL}")
MODEL_ID = "convaiinnovations/laya" + (f"-{MODEL}" if MODEL != "english" else "")
REVISION = os.environ.get("DECISION_MODEL_REVISION", "55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851")
router = Router(device="cpu", revision=REVISION, max_loaded=1)
router.preload([MODEL])  # only one checkpoint: fail startup rather than silently download another
loaded_at = datetime.now(timezone.utc).isoformat()
app = FastAPI(title="Cratis Decision Engine (Laya)")
pool = ThreadPoolExecutor(max_workers=1)
gate = asyncio.Lock()
completed = 0
failed = 0


class Context(BaseModel):
    text: str | None = Field(default=None, max_length=8000)
    structured: dict[str, str] | None = None

    @model_validator(mode="after")
    def requires_content(self):
        if not (self.text or "").strip() and not self.structured:
            raise ValueError("context must contain text or structured data")
        return self


class Decision(BaseModel):
    requestId: str = ""
    context: Context
    choices: list[str] = Field(min_length=1, max_length=32)
    question: str | None = None
    descriptions: dict[str, str] = Field(default_factory=dict)


class Batch(BaseModel):
    decisions: list[Decision] = Field(min_length=1, max_length=32)


class Labels(BaseModel):
    context: Context
    labels: list[str] = Field(min_length=1, max_length=32)
    threshold: float = Field(default=0.5, ge=0, le=1)
    descriptions: dict[str, str] = Field(default_factory=dict)


def check_choices(choices):
    if len(set(choices)) != len(choices) or any(not c.strip() for c in choices):
        raise HTTPException(422, "choices/labels must be nonempty and unique")


def state(context):
    # Laya's attention memory grows with input tokens. Valid 8K contexts can OOM a
    # 2 GiB pod even for a single label; retain title/prefix and recent suffix.
    text = context.text
    if text and len(text) > 1500:
        text = text[:750] + "\n... [middle truncated] ...\n" + text[-750:]
    return {**({"text": text} if text else {}),
            **({"structured": context.structured} if context.structured else {})}


def infer(context, questions):
    return router.predict(state(context), questions, model=MODEL)["answers"]


def decide(request):
    check_choices(request.choices)
    started = time.perf_counter()
    if len(request.choices) == 1:
        return {"requestId": request.requestId, "choices": {request.choices[0]: 1.0},
                "model": MODEL_ID, "engine": "laya-choice/v1", "latencyMs": 0.0}
    answers = infer(request.context, {"decision": {
        "type": "choice",
        "instructions": request.question or "Which option best applies to this context?",
        "criteria": {c: request.descriptions.get(c, c) for c in request.choices},
    }})
    probabilities = answers["decision"]["probabilities"]
    # Laya rounds to four decimals; renormalize to honor the v1 sum-to-one guarantee.
    total = sum(probabilities.values())
    if not math.isfinite(total) or total <= 0:
        raise ValueError("invalid model probabilities")
    scores = {c: probabilities[c] / total for c in request.choices}
    return {"requestId": request.requestId, "choices": scores, "model": MODEL_ID,
            "engine": "laya-choice/v1", "latencyMs": (time.perf_counter() - started) * 1000}


def classify_labels(request):
    check_choices(request.labels)
    started = time.perf_counter()
    # An 8K-character context OOM-killed 2 GiB pods with 32 labels on x86 and
    # even four labels per pass on Apple Silicon. Score one label per pass.
    answers = {}
    for i, label in enumerate(request.labels):
        answers.update(infer(request.context, {f"label_{i}": {
            "type": "noul",
            "instructions": f"Does this issue warrant the label '{label}'? "
                            f"{request.descriptions.get(label, '')}",
        }}))
    probabilities = {label: answers[f"label_{i}"]["noul"]
                     for i, label in enumerate(request.labels)}
    return {"labels": [label for label in request.labels if probabilities[label] >= request.threshold],
            "probabilities": probabilities, "model": MODEL_ID,
            "latencyMs": (time.perf_counter() - started) * 1000}


async def run(fn, arg):
    global completed, failed
    async with gate:
        try:
            result = await asyncio.get_running_loop().run_in_executor(pool, fn, arg)
            completed += 1
            return result
        except HTTPException:
            failed += 1
            raise
        except ValueError as exc:
            failed += 1
            raise HTTPException(422, str(exc)) from exc
        except Exception as exc:
            failed += 1
            raise HTTPException(500, "inference failed; check container logs") from exc


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/readyz")
async def readyz():
    if MODEL not in router.loaded:
        raise HTTPException(503, "model not loaded")
    return {"status": "ready"}


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    return ("# TYPE decision_engine_requests_total counter\n"
            f'decision_engine_requests_total{{status="success"}} {completed}\n'
            f'decision_engine_requests_total{{status="failure"}} {failed}\n')


@app.get("/v1/model")
async def model():
    return {"model": MODEL_ID, "revision": router.loaded_revisions.get(MODEL, "unknown"),
            "runtime": "laya/cpu", "loadedAt": loaded_at}


@app.post("/v1/decisions")
async def decisions(request: Decision):
    return await run(decide, request)


def decide_batch(request):
    return {"results": [decide(item) for item in request.decisions]}


@app.post("/v1/decisions/batch")
async def batch(request: Batch):
    return await run(decide_batch, request)


@app.post("/v1/labels")
async def labels(request: Labels):
    return await run(classify_labels, request)
