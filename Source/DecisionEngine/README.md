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
  "engine": "single-pass-mcq/v1",
  "latencyMs": 265.4
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

This endpoint saves **round trips, not model time**. Decisions inside a batch are scored one at a
time, deliberately — see below.

`latencyMs` on a batch response is the batch's total time divided across its decisions, so the
number means the same thing whether one decision was sent or thirty.

## How choices are scored

The choices are put to the model as a letter-indexed multiple-choice question, and the distribution
is read straight off the letter tokens of **one forward pass**:

```
<context>

Question: which option applies?

A. investigate
B. plan
C. implement
D. ask_user

Answer with the letter of the single best option.
```

The log-probabilities of the tokens `A`, `B`, `C`, `D` at the next position *are* the distribution,
after a softmax at `DECISION_TEMPERATURE`.

### Why not score each choice as a continuation

That is the obvious design, and it is what this service originally did. It was replaced because it
lost on both axes, measured on the deployment node (EPYC 9575F, 2 CPU, 72 labelled decisions):

- **Cost.** One forward pass per choice, each re-reading the whole prompt, so latency grew with the
  number of choices: 2114 ms at three choices, 4362 ms at six. Reading letter tokens is one pass
  regardless — 265 ms and 290 ms.
- **Accuracy.** A continuation score is contaminated by how likely the choice is as English. The
  string `bug` is common and `breaking-change` is not, and that difference lands in the score
  whatever the context says. Single-token letters are equally likely a priori, so the only thing
  separating them is the question. Accuracy went from 43% to 56% on the same set.

The continuation scorer is still in `model.py`, as the fallback for choice sets larger than the 26
letters of the alphabet. It keeps its prompt's attention cache across choices, so it costs one
prefill plus a short pass per choice rather than a full prefill per choice.

### Why the option order is rotated

The letter form introduces its own bias: the model favours certain positions in the list regardless
of content. `DECISION_ROTATIONS` asks the same question with the options rotated and averages the
results, which cancels it. Rotations are rows in the same forward pass, so the cost is sublinear.

| Rotations | 3-choice p50 | Accuracy | ECE | Confidence separation |
|---|---|---|---|---|
| 1 | 193 ms | 46% | 0.208 | +0.209 |
| **2** | **324 ms** | **56%** | **0.162** | **+0.124** |
| 3 | 558 ms | 60% | 0.189 | +0.047 |

Two is the default: the point where accuracy and calibration error are both best. Three is more
often right but can no longer tell you *when* it is right, which makes a consumer's confidence
threshold meaningless.

Rotation rather than shuffling, so the orders asked are deterministic and a recorded decision can be
reproduced from its inputs during an audit.

### Why decisions are not batched with each other

Folding several decisions into shared forward passes measured at 292 ms per decision against 290 ms
for scoring them one at a time — at these sizes the matmuls are already compute-bound, so there is
no per-call overhead left to recover. What it did cost was reproducibility: bfloat16 takes a
different kernel path depending on batch shape, and 3 of 72 decisions changed their top choice
according to nothing but what else was scored alongside them. A decision that cannot be reproduced
from its recorded inputs is not worth a throughput gain that does not exist.

`DECISION_TEMPERATURE` is the calibration knob — below 1.0 sharpens, above flattens. Tune it against
recorded decisions rather than intuition.

### Operational routes

| Route | Purpose |
|---|---|
| `GET /v1/model` | What is loaded — model, revision, runtime, load time |
| `GET /healthz` | Liveness. The process is up; says nothing about the model |
| `GET /readyz` | Readiness. 503 until the model can actually score |
| `GET /metrics` | Prometheus exposition |

`/healthz` and `/readyz` are deliberately different. A model that takes four minutes to pull its
artifact must not be restart-looped by a liveness probe that is really a readiness probe.

Ready means ready to answer at full speed, not just loaded. Before `/readyz` turns green the weights
are copied out of the memory-mapped checkpoint into process memory, and one warm-up decision is
scored. Without the copy the weights stay as page cache over the model volume, the node reclaims them
whenever it wants memory back, and the next decision after an idle spell pays seconds to fault them
back in from storage. A pod that is Ready stays warm for as long as it runs.

## Choosing the model

`Qwen2.5-0.5B-Instruct` is the default because it was the best of the CPU-viable candidates on both
axes at once. Measured on the deployment node, single-pass scoring, 72 labelled decisions:

| Model | 3-choice p50 | Accuracy | Confidence separation | |
|---|---|---|---|---|
| **Qwen2.5-0.5B-Instruct** | **245 ms** | **46%** | **+0.209** | Default |
| SmolLM2-360M-Instruct | 180 ms | 26% | +0.017 | At the random baseline (~28%), and its confidence carries no signal |
| Llama-3.2-1B-Instruct | 494 ms | 47% | +0.113 | Ties within noise at 2× the latency; also a **gated** HF repo, needing a token in-cluster |

The accuracy column is argmax against hand-labelled expectations; confidence separation is mean
confidence when right minus mean confidence when wrong, which is the property a consumer gating on a
threshold actually depends on. Replacing the model is a configuration change — nothing in this
service names one.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DECISION_MODEL` | `Qwen/Qwen2.5-0.5B-Instruct` | Hugging Face repository id |
| `DECISION_MODEL_REVISION` | `main` | Pin to a commit sha in deployment |
| `DECISION_RUNTIME` | `transformers` | Reported for telemetry |
| `DECISION_DTYPE` | `bfloat16` | Weight precision. `float32` is 3.9× slower for no accuracy gain; `float16` is emulated on x86 and 10× slower; int8 was measured and rejected for becoming confidently wrong |
| `DECISION_ROTATIONS` | `2` | Option orders averaged per decision |
| `DECISION_TEMPERATURE` | `1.0` | Softmax temperature |
| `DECISION_MAX_CHOICES` | `32` | Per-request choice cap. Above 26 a request falls back to continuation scoring |
| `DECISION_MAX_BATCH` | `32` | Batch size cap |
| `DECISION_MAX_ROWS` | `16` | Rows per padded forward pass — bounds peak memory |
| `DECISION_MAX_CONTEXT_CHARS` | `8000` | Context truncated keeping the **end** |
| `DECISION_TORCH_THREADS` | unset | Threads to pin torch to. When unset it is derived from the cgroup CPU quota, which is right more often than a hard-coded number |
| `HF_HOME` | `/models` | Artifact cache — mount it, or every restart re-downloads |

### Threads

Torch sizes its pool from the *node's* core count, which inside a container is not the number of
CPUs the process may use. Measured in the pod against a 2-CPU quota: **217 GFLOPS at 2 threads,
142 GFLOPS at 4.** Oversubscribing a quota is slower than matching it, so the service reads
`/sys/fs/cgroup/cpu.max` and configures itself when `DECISION_TORCH_THREADS` is absent.

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
