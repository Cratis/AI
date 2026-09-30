#!/usr/bin/env bash
# Test the local Laya-backed Decision API with the exact ten Cratis sample issues — each scored
# for type, semver impact, and likely labels — twice over:
#
#   1. Sequentially: one POST /v1/decisions per decision, issue by issue, timing every issue.
#   2. As a batch:   every decision for every issue in one POST /v1/decisions/batch, timed once.
#
# Both runs ask exactly the same questions, so the second doubles as a consistency check: the
# engine scores each decision on its own even inside a batch, and a top choice that changes between
# the two runs is reported as a defect.
#
# This is a read-only local smoke test. It checks Decision API v1 and multi-label classification.
#
# Exit codes: 0 all decisions answered and consistent, 1 inconsistent or incomplete answers,
# 2 could not run (no connection, service not ready, request failed).
set -euo pipefail

BASE_URL="${DECISION_ENGINE_BASE_URL:-http://127.0.0.1:8080}"
command -v curl >/dev/null || { echo "curl is required" >&2; exit 2; }
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 2; }
echo "Using ${BASE_URL}" >&2

# The engine is always on: a running pod is only Ready once its model is loaded, resident, and
# warmed up. Not ready here means something is wrong with the deployment, so fail rather than wait.
if ! curl -sf -o /dev/null "${BASE_URL}/readyz"; then
    echo "decision-engine is not ready - check the pod (Documentation/deployment/decision-engine.md)" >&2
    exit 2
fi

python3 - "$BASE_URL" <<'PYEOF'
import json
import sys
import time
import urllib.error
import urllib.request

base_url = sys.argv[1].rstrip("/")

TYPE_CHOICES = ["Feature", "Task", "Bug"]
SEMVER_CHOICES = ["major", "minor", "patch"]
LABEL_CHOICES = ["bug", "enhancement", "documentation", "breaking-change", "tech-debt", "question"]
KINDS = (("type", TYPE_CHOICES), ("semver", SEMVER_CHOICES), ("labels", LABEL_CHOICES))

ISSUES = [
    ("Projection replay throws NRE on redacted events",
     "When an observer replays after a GDPR redaction, ProjectionReplayManager.Rebuild throws a "
     "NullReferenceException because the redacted event's payload is null but the projection still "
     "tries to read a property off it.",
     "Cratis/Chronicle"),
    ("Add batch endpoint to Decision Engine",
     "Callers scoring many candidates against one task pay a round trip per candidate today. Add a "
     "/v1/decisions/batch route that accepts several independent decision requests and returns "
     "results in order.",
     "Cratis/AI"),
    ("Typo in getting-started tutorial",
     "The React getting-started tutorial says 'recieve' instead of 'receive' in step 3.",
     "Cratis/Documentation"),
    ("Support EventSourceId<T> for non-Guid backing types",
     "Right now EventSourceId<T> round-trips cleanly for Guid and string, but other IComparable "
     "types need explicit verification. Add support and specs for int and long backing types.",
     "Cratis/Fundamentals"),
    ("DataPage crashes when detailsComponent throws during render",
     "If the component passed to DataPage.detailsComponent throws, the whole page unmounts instead "
     "of showing an error boundary around just the detail pane.",
     "Cratis/Components"),
    ("Rename IReducerFor<T> to IReducer<T>",
     "Purely a naming cleanup for consistency with IProjectionFor<T> — no behavior change.",
     "Cratis/Chronicle"),
    ("Reactor quarantine does not include the failing event's causation chain",
     "When a reactor partition is quarantined, the failure record captures the event type and error "
     "but drops the causation chain, making root-cause diagnosis much harder for support.",
     "Cratis/Chronicle"),
    ("Command validators silently skip nested record properties",
     "CommandValidator<T> does not validate properties on nested records by default, so a required "
     "nested field can be missing without any validation error being raised.",
     "Cratis/Arc"),
    ("Add dark mode to Storybook docs site",
     "The Components Storybook instance only ships a light theme; contributors working at night "
     "have asked for a dark toggle.",
     "Cratis/Components"),
    ("Chronicle client throws on empty batch of events during append",
     "EventStore.Append throws an unhandled exception when given an empty event list, instead of a "
     "clear validation error or a no-op.",
     "Cratis/Chronicle"),
]


class CouldNotRun(Exception):
    pass


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        f"{base_url}{path}", data=data, method=method, headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            return json.load(response)
    except (urllib.error.URLError, TimeoutError) as error:
        raise CouldNotRun(f"{method} {path} failed: {error}") from error


def decisions_for(index, issue):
    title, body, repository = issue
    context = {"text": f"{title}\n\n{body}", "structured": {"repository": repository}}
    return [
        {"requestId": f"{index}:{kind}", "context": context, "choices": choices}
        for kind, choices in KINDS
    ]


def ranked(result, n):
    return sorted(result["choices"].items(), key=lambda kv: kv[1], reverse=True)[:n]


def fmt(pairs):
    return ", ".join(f"{name} {prob:.0%}" for name, prob in pairs)


def seconds(value):
    return f"{value:.2f}s"


def print_table(headers, rows):
    widths = [max(len(h), *(len(r[i]) for r in rows)) for i, h in enumerate(headers)]
    print(" | ".join(h.ljust(w) for h, w in zip(headers, widths)))
    print("-+-".join("-" * w for w in widths))
    for row in rows:
        print(" | ".join(c.ljust(w) for c, w in zip(row, widths)))


def result_columns(results, index):
    return (
        fmt(ranked(results[f"{index}:type"], 1)),
        fmt(ranked(results[f"{index}:semver"], 1)),
        fmt(ranked(results[f"{index}:labels"], 2)),
    )


def short(title):
    return title if len(title) <= 48 else title[:45] + "..."


def heading(text):
    print()
    print(text)
    print("=" * len(text))


def main():
    model = call("GET", "/v1/model")
    print(f"Model: {model['model']} @ {model['revision']} ({model['runtime']}), loaded {model.get('loadedAt')}")

    all_decisions = [d for i, issue in enumerate(ISSUES, start=1) for d in decisions_for(i, issue)]

    # --- Test 1: one request per decision, issue by issue ------------------------------------
    heading(f"Test 1/2: sequential - {len(ISSUES)} issues, {len(KINDS)} decisions each, "
            "one POST /v1/decisions per decision")
    sequential = {}
    rows = []
    sequential_started = time.perf_counter()
    for index, issue in enumerate(ISSUES, start=1):
        started = time.perf_counter()
        for decision in decisions_for(index, issue):
            sequential[decision["requestId"]] = call("POST", "/v1/decisions", decision)
        elapsed = time.perf_counter() - started
        row = (str(index), short(issue[0]), *result_columns(sequential, index), seconds(elapsed))
        rows.append(row)
        print(f"  issue {index:>2}: {seconds(elapsed)}", flush=True)
    sequential_elapsed = time.perf_counter() - sequential_started
    print()
    print_table(("#", "Issue", "Type", "SemVer", "Likely labels", "Time"), rows)
    print(f"\nSequential total: {seconds(sequential_elapsed)} for {len(all_decisions)} decisions "
          f"({sequential_elapsed / len(ISSUES):.2f}s per issue)")

    # --- Test 2: every decision in one batch request -----------------------------------------
    heading(f"Test 2/2: batch - the same {len(ISSUES)} issues, all {len(all_decisions)} decisions "
            "in one POST /v1/decisions/batch")
    started = time.perf_counter()
    response = call("POST", "/v1/decisions/batch", {"decisions": all_decisions})
    batch_elapsed = time.perf_counter() - started
    batch = {r["requestId"]: r for r in response["results"]}

    missing = sorted({d["requestId"] for d in all_decisions} - batch.keys())
    if missing:
        print(f"Batch response is missing {len(missing)} of {len(all_decisions)} results: {', '.join(missing)}")
        return 1

    rows = [(str(i), short(issue[0]), *result_columns(batch, i)) for i, issue in enumerate(ISSUES, start=1)]
    print_table(("#", "Issue", "Type", "SemVer", "Likely labels"), rows)
    print(f"\nBatch total: {seconds(batch_elapsed)} for {len(all_decisions)} decisions "
          f"({batch_elapsed / len(ISSUES):.2f}s per issue)")

    # --- Summary -------------------------------------------------------------------------------
    heading("Summary")
    disagreements = [
        request_id for request_id in sequential
        if ranked(sequential[request_id], 1)[0][0] != ranked(batch[request_id], 1)[0][0]
    ]
    print(f"Sequential: {seconds(sequential_elapsed)}   Batch: {seconds(batch_elapsed)}   "
          f"Batch saved {seconds(sequential_elapsed - batch_elapsed)}")
    if disagreements:
        print(f"Top choice differed between the runs for {len(disagreements)} of {len(sequential)} "
              f"decisions: {', '.join(disagreements)}")
        return 1
    print(f"Top choice identical in both runs for all {len(sequential)} decisions")

    # Labels are multi-select: each candidate is scored independently via Laya noul.
    heading("Multi-label classification: 10 issues, supplied candidate labels")
    label_times = []
    for i, issue in enumerate(ISSUES, 1):
        title, body, repository = issue
        started = time.perf_counter()
        answer = call("POST", "/v1/labels", {
            "context": {"text": f"{title}\n\n{body}", "structured": {"repository": repository}},
            "labels": LABEL_CHOICES,
        })
        label_times.append(time.perf_counter() - started)
        if not set(answer["labels"]).issubset(LABEL_CHOICES) or set(answer["probabilities"]) != set(LABEL_CHOICES):
            print(f"Invalid label result for issue {i}: {answer}")
            return 1
        print(f"  issue {i:>2}: {seconds(label_times[-1])}  labels: {', '.join(answer['labels']) or '(none)'}")
    print(f"Labels total: {seconds(sum(label_times))}")
    return 0


try:
    sys.exit(main())
except CouldNotRun as error:
    print(error, file=sys.stderr)
    sys.exit(2)
PYEOF
