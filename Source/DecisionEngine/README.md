# Cratis Decision Engine

A small HTTP service that weighs a supplied set of choices against a context and returns a
probability distribution over them. It generates nothing.

It exists so that bounded workflow decisions — which agent, which model, which next action, which
diagnostic path — stop costing a frontier-model call each.

## The contract

Decision API v1. Nothing in it names a model family, and nothing a caller branches on reveals which
model is loaded: replacing the model is a deployment change.

### `POST /v1/decisions`

```json
{
  "requestId": "0f2b",
  "context": {
    "text": "Issue #123: NRE during projection replay",
    "structured": { "repository": "Cratis/Chronicle", "labels": "bug" }
  },
  "choices": ["investigate", "plan", "implement", "ask_user"]
}
```

```json
{
  "requestId": "0f2b",
  "choices": { "investigate": 0.05, "plan": 0.12, "implement": 0.82, "ask_user": 0.01 },
  "model": "Qwen/Qwen2.5-0.5B-Instruct",
  "engine": "logprob-scoring/v1",
  "latencyMs": 41.2
}
```

Guarantees a caller may rely on:

- Every supplied choice appears in the response.
- The probabilities sum to 1.
- Choices are opaque strings. The service has no built-in vocabulary and never will — the calling
  workflow owns the options.

### `POST /v1/decisions/batch`

`{ "decisions": [ <request>, … ] }` → `{ "results": [ <response>, … ] }`, results in request order.

For callers scoring many candidates against one task, where a round trip each would cost more than
the filtering saves.

### Operational routes

| Route | Purpose |
|---|---|
| `GET /v1/model` | What is loaded — model, revision, runtime, load time |
| `GET /healthz` | Liveness. The process is up; says nothing about the model |
| `GET /readyz` | Readiness. 503 until the model can actually score |
| `GET /metrics` | Prometheus exposition |

`/healthz` and `/readyz` are deliberately different. A model that takes four minutes to pull its
artifact must not be restart-looped by a liveness probe that is really a readiness probe.

## How choices are scored

Each choice is scored by the **mean per-token log-likelihood** the model assigns it when conditioned
on a prompt containing the context *and the full option set*. The scores are then softmaxed into a
distribution.

Three decisions worth knowing about:

- **Not generation.** Asking the model to emit the answer yields one label and no distribution, and
  a 0.5B model's self-reported confidence is worthless. Scoring yields a real distribution for one
  short forward pass per choice.
- **Mean, not sum.** A summed log-likelihood is systematically more negative for longer strings, so
  `change_approach` would lose to `retry` on length alone.
- **All options in the prompt.** Scoring a choice without showing the alternatives answers "is this
  a plausible continuation", which is a noisier question than "which of these".

`DECISION_TEMPERATURE` is the calibration knob — below 1.0 sharpens, above flattens. Tune it against
recorded decisions rather than intuition.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DECISION_MODEL` | `Qwen/Qwen2.5-0.5B-Instruct` | Hugging Face repository id |
| `DECISION_MODEL_REVISION` | `main` | Pin to a commit sha in deployment |
| `DECISION_RUNTIME` | `transformers` | Reported for telemetry |
| `DECISION_TEMPERATURE` | `1.0` | Softmax temperature |
| `DECISION_MAX_CHOICES` | `32` | Per-request choice cap |
| `DECISION_MAX_BATCH` | `32` | Batch size cap |
| `DECISION_MAX_CONTEXT_CHARS` | `8000` | Context truncated keeping the **end** |
| `DECISION_TORCH_THREADS` | unset | Pin to the pod's CPU limit to stop torch oversubscribing |
| `HF_HOME` | `/models` | Artifact cache — mount it, or every restart re-downloads |

## Running locally

```bash
pip install -r requirements.txt
DECISION_MODEL=Qwen/Qwen2.5-0.5B-Instruct uvicorn app.main:app --port 8080
```

```bash
pytest tests
```

The tests cover the scoring math and the contract, not the model: loading half a gigabyte of weights
to assert a softmax sums to one would be testing PyTorch.

## Deployment

Deployed to the shared cluster by `Cratis/Infrastructure` as an internal-only service — no ingress.
See that repository's `Documentation/deployment/decision-engine.md` for sizing and the model
replacement procedure.
