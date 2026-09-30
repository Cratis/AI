# Cratis Decision Engine (Laya)

Decision API v1 implemented as a small FastAPI adapter around stock [Laya](https://github.com/NandhaKishorM/laya) at commit `4066d5d5fbf08b66c6757ddeedbd797bd7655bc0`. The source under `upstream/` is copied unmodified from that commit (including Apache-2.0 LICENSE). The Dockerfile follows Laya's CPU image build with a Cratis adapter entry point. The adapter runs in **the same process and memory limit** as the preloaded model. For upstream updates, replace `upstream/` from a reviewed pinned commit, update the revision in Dockerfile/docs, and rerun tests. Never silently track `main`.

Build and run locally (Docker + network for the first Hugging Face download):

```sh
docker build -t cratis/decision-engine:local Source/DecisionEngine
docker run --rm --name cratis-decision-engine --cpus=2 --memory=2g --memory-swap=2g \
  -p 127.0.0.1:8080:8080 -v decision-model-cache:/home/laya/.cache/huggingface \
  cratis/decision-engine:local
# in another shell:
DECISION_ENGINE_BASE_URL=http://127.0.0.1:8080 Source/DecisionEngine/decision-engine-test.sh
python3 Source/DecisionEngine/benchmark.py
```

From the repository root, tests without weights: `docker run --rm --entrypoint python -v "$PWD/Source/DecisionEngine/tests:/tests:ro" cratis/decision-engine:local -m unittest discover -s /tests`.

Default model: `convaiinnovations/laya-multilingual` (mmBERT-base, 322M); checkpoint revision `55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851`. Environment: `DECISION_LAYA_MODEL` (`multilingual`, `english`, or `typed-decisions`), `DECISION_MODEL_REVISION`, `LAYA_THREADS=2`, `HF_HOME=/home/laya/.cache/huggingface`. Only the selected checkpoint is preloaded. English/typed-decisions are larger and **not validated under 2 GiB**; English OOM-killed locally. Keep revisions pinned. The built-in C# model name is for display and usage reporting; it does not switch models per request.

## API

`GET /healthz` is liveness, `GET /readyz` readiness after preload, `GET /v1/model` reports the checkpoint, revision, runtime and load time; `GET /metrics` exports request counters. Laya's own `/v1/systemone` is intentionally **not exposed**: letting requests select a second checkpoint could OOM this constrained container. **Only expose on trusted internal networks**: no authentication is configured.

`POST /v1/decisions` accepts `requestId` (optional), `context` containing nonempty `text` and/or `structured` string pairs, `choices` (one to 32 distinct strings), optional `question` and `descriptions` keyed by choice. Response: `requestId`, `choices` (every choice scored, normalized to sum to 1), `model`, `engine`, `latencyMs`. `POST /v1/decisions/batch` accepts `{ "decisions": [ ... ] }` (max 32) and returns `{ "results": [ ... ] }` in the same order. It serializes inference for bounded memory; batch saves network round trips, not model time. This preserves the existing C# `BuiltInDecisionEngineClient` contract.

`POST /v1/labels` is **multi-label**: `{ "context": { "text": "Issue title and body" }, "labels": ["bug", "documentation"], "threshold": 0.5, "descriptions": {} }`. Response: `{ "labels": [...], "probabilities": { "bug": 0.7, "documentation": 0.6 }, "model": "...", "latencyMs": 123 }`. Each candidate is independently asked as a Laya `noul` question. Labels are scored one per forward pass and inference text longer than 1,500 characters keeps its first and last 750 characters. Valid 8K contexts OOM-killed 2 GiB pods (even for one label on Apple Silicon); callers may still send up to 8K, but middle text is not read by the model. This bounds peak memory at the cost of information loss and higher multi-label latency. Evaluate that trade-off on representative issues. The C# `BuiltInDecisionEngineClient.ClassifyLabels` calls this route. Direct integration is tracked by [Cratis/Direct#1287](https://github.com/Cratis/Direct/issues/1287). These probabilities need calibration on your issues before automating labels.

## Known limitations

The packaged image on Apple Silicon Docker Desktop (2 CPU / 2 GiB) answered ten sample issues: 30 sequential decisions in 4.12 s, 30 batched in 3.97 s, and ten multi-label requests in 6.96 s. A 100-request short-prompt benchmark yielded p50 92.33 ms, p95 96.92 ms, p99 99.63 ms and 10.76 req/s, followed by 40 concurrent-client requests at 10.91 req/s with no failures. Memory after these tests was ~1.912 GiB / 2 GiB. An earlier Compose trial using the same checkpoint reached **1.996 GiB / 2 GiB** and restarted once after the issue workload. Labeling also missed obvious examples. This is an experiment, **not demonstrated stable or accurate on the production x86 node**. Do not deploy automatically on the strength of local latency; verify OOM events, memory high-water mark, and issue-label quality in staging first.
