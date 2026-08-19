# Deterministic evaluations

Stage 0 evaluations measure repository discovery and compiled preflight without
invoking a model, network, worker, Planner, Pi, or the `cratis` CLI. They are
local conformance checks, not simulated agent runs.

## Immutable execution boundary

An executable catalog entry binds all of the following:

- one case identifier;
- one repository-tree fixture and its exact tree hash;
- one operation and complete request;
- the exact eligible profile identifiers;
- typed JSON Pointer assertions; and
- a self hash for both the fixture declaration and execution declaration.

The tree hash covers every relative file path, file content hash, and executable
bit. The runner captures each regular file through a no-follow descriptor,
verifies stable file identity around the read, and executes from that immutable
in-memory snapshot rather than returning to the source tree. Root and nested
symbolic links, unsupported entries, missing files, tree drift, unknown
profiles, duplicate cases/references/selections, and placeholder values fail
before an operation runs. Preflight fixtures use a minimal Git environment with
fixed identity, time, object format, hooks, signing, templates, global
configuration, and line-ending behavior.

The result is deterministic and self-addressed. Static verification checks the
Factory canonical JSON subset, schema, content hash, coverage, summary,
bindings, and type-aware assertion outcome/diagnostic semantics. Authoritative
verification then reruns the exact selected catalog executions from freshly
captured, tree-hash-matched fixture snapshots and requires the complete
result—including operation hashes—to match. A self-rehashed result, invented
operation hash, stale fixture, or different catalog revision is not an
attestation.

## Run and verify

From the AI repository root:

```shell
python3 Factory/scripts/evaluate_factory.py
python3 Factory/scripts/evaluate_factory.py \
  --case discovery-golden-stack --format json \
  --output /tmp/cratis-factory-evaluation.json
python3 Factory/scripts/evaluate_factory.py --verify-result /tmp/cratis-factory-evaluation.json
```

Machine consumers should use `--format json` or `--format json-compact`. A
non-passing evaluation returns a non-zero exit status.

Every projection is a shared `operation-result`. The typed evaluation is in
`result.value`; saved verification accepts that envelope. Machine failures,
including verification failures, are also single structured envelopes with
stable status, diagnostic code, request hash, and exit code—never prose followed
by generic exit 1.

## Coverage and release gates

Every evaluation result contains exact catalog, executable, and selected case
counts and identifier lists. `scope` has three non-interchangeable values:

- `selected-executable-cases` means only the named subset ran;
- `full-executable-catalog` means every currently executable case ran; and
- `full-catalog` means every reviewed catalog case is executable and ran.

An operation status of `success` means the declared selection passed. It does
not promote subset coverage to a release gate. Automation must bind the expected
catalog hash and exact case IDs/counts as well as require the appropriate scope
and passing result. The current foundation conformance gate may require
`full-executable-catalog` at 10/10 executable cases, but the Stage 0
benchmark/release gate remains unmet until it can require `full-catalog` at
40/40. The 30 prose-only cases cannot contribute a pass.

## Current coverage

The foundation catalog contains 40 reviewed scenarios. Ten are executable
against nine immutable ecosystem fixtures:

- composed Arc, Components, Chronicle, and React discovery;
- Arc without Chronicle;
- Arc.React.MVVM with React and no inferred unrelated integration;
- Chronicle TypeScript, Kotlin/Java, and Elixir client discovery;
- contracts-only, missing Components peer dependencies, and unknown ecosystems;
  and
- a clean golden-stack preflight that binds the resolved profile, repository
  revision, workflow, and effective policy.

The other 30 scenarios remain an explicit backlog. They do not count as passing
coverage, and therefore current full runs report `full-executable-catalog`,
never `full-catalog`. Agent quality, source-writing workflows, Screenplay and
modeling behavior, browser/runtime evidence, security attacks, correction loops,
and cross-version client compatibility still need immutable fixtures and
executable gates before Pi or Planner expansion can rely on them.
