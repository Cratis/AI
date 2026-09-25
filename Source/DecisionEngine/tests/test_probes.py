# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""The probes answer while a burst of decisions waits for the model.

Decisions are scored one at a time and wait for their turn on the request threadpool. A probe that
needed a thread of its own would wait behind them, miss its deadline, and have a busy pod killed as
if it were dead - which is how production restart-looped the engine under a backlog of decisions.
"""

from __future__ import annotations

import asyncio
import threading

import httpx
import pytest

from app import main
from app.model import MODEL

# More than the threadpool's forty threads, so every one of them is held by a waiting decision.
QUEUED_DECISIONS = 48
PROBE_DEADLINE_SECONDS = 2


@pytest.fixture
def saturated(monkeypatch: pytest.MonkeyPatch):
    release = threading.Event()

    def score_when_released(tasks):
        release.wait()
        return [[] for _ in tasks]

    monkeypatch.setattr(MODEL, "score", score_when_released)
    monkeypatch.setattr(type(MODEL), "is_loaded", property(lambda _: True))
    yield release
    release.set()


async def _probe_during_burst(release: threading.Event, route: str) -> int:
    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://engine") as client:
        decision = {"context": {"text": "an issue"}, "choices": ["low", "high"]}
        burst = [
            asyncio.create_task(client.post("/v1/decisions", json=decision)) for _ in range(QUEUED_DECISIONS)
        ]
        await asyncio.sleep(0.5)
        try:
            response = await asyncio.wait_for(client.get(route), PROBE_DEADLINE_SECONDS)
            return response.status_code
        finally:
            release.set()
            await asyncio.gather(*burst, return_exceptions=True)


class describe_probes_under_a_burst_of_decisions:
    def it_answers_liveness(self, saturated: threading.Event):
        assert asyncio.run(_probe_during_burst(saturated, "/healthz")) == 200

    def it_answers_readiness(self, saturated: threading.Event):
        assert asyncio.run(_probe_during_burst(saturated, "/readyz")) == 200
