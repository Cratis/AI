# Cratis Software Factory foundation

This directory contains the policy and profile definitions for the Cratis
Software Factory. The factory is a governed, model-driven delivery system for
Cratis applications—not a fork of an agent harness and not an extension of the
existing `cratis` CLI runtime.

The Python code under `scripts/` is the current Stage 0 executable specification
and differential-parity oracle for maintainers. It is temporary, is not the
supported public product experience, and must not become production authority.
The remaining native core, evaluation, and CLI work described below is the
planned P0 prerequisite. Managed orchestration, worker, and adapter
implementation is on **hold** until that native authority and the security
boundaries are accepted.

Native schema validation is the independently accepted second `Factory.Core`
slice. Its private static-rebasing design contains the JsonSchema.Net 8.0.5
embedded-resource build failure without package-global state, reflection, lazy
evaluation, a dependency change, or altered accepted semantics. The accepted
evidence covers 63 documents, 135 cases, 24 generators, 107/107 permanent schema
specifications in Debug and Release, and 7,339/0 temporary differential
comparisons in each configuration. Build and specification evidence is no longer
macOS-only: the `Factory .NET libraries` CI job runs the Release build, the Debug
build, and the specs on both `ubuntu-latest` and `windows-latest`, and Linux has
already reported green. Trim and NativeAOT evidence is a separate and much
narrower claim, and it is still macOS arm64 only — it comes from a local sandbox
pinned to `osx-arm64` that no workflow runs, so trim and NativeAOT execution on
Windows and Linux does remain pending. See
[`SchemaValidation.md`](./SchemaValidation.md).

The native definition/workflow semantic compiler is the focused #47
implementation candidate. It consumes only caller bytes and the already
accepted schema set, covers the closed 13-kind route table and frozen workflow
semantics, and has no discovery or execution authority. Frozen-tree acceptance
is still pending; #67, #47, and G0 remain open, and the deletion-bound Python
comparison remains retained. See
[`DefinitionWorkflowCompilation.md`](./DefinitionWorkflowCompilation.md).

The foundation is split by ownership:

- [`../Contracts/v1/`](../Contracts/v1/) is the current executable
  cross-runtime protocol. [`../Contracts/v2/`](../Contracts/v2/) is the
  integrity-only artifact provenance foundation and is not auto-applied to v1.
- [`../Workflows/`](../Workflows/) contains versioned deterministic workflow
  graphs.
- [`Profiles/`](./Profiles/) composes only the skills and capabilities the
  detected stack actually supports.
- [`Policies/`](./Policies/) defines executable capability and approval
  boundaries.
- [`scripts/validate_factory.py`](./scripts/validate_factory.py) is part of the
  temporary maintainer oracle. It performs Draft 2020-12 schema validation plus
  semantic checks for references, workflow graphs, recommendations, protected
  paths, and CLI non-interference.
- [`CanonicalJson.md`](./CanonicalJson.md) defines the bounded native canonical
  JSON and hashing contract, shared vectors, and temporary parity boundary.
- [`SchemaValidation.md`](./SchemaValidation.md) defines native Draft 2020-12
  schema loading, explicit local closure, stable diagnostics, resource limits,
  and the deletion-bound schema differential.
- [`DefinitionWorkflowCompilation.md`](./DefinitionWorkflowCompilation.md)
  defines the pure caller-bytes compiler API, closed routes, semantic rules,
  frozen limits, stable diagnostics, native specifications, and non-blocking
  historical migration evidence.
- [`../Documentation/Factory/`](../Documentation/Factory/) records the product,
  architecture, security model, and investment gates.
- [`../Evaluations/Factory/`](../Evaluations/Factory/) starts the cross-stack,
  security, and reliability benchmark catalog.

## Target product boundary — planned

- `Source/Factory.Core` is the native .NET authority for canonical JSON,
  validation, ecosystem resolution, workflow compilation, policy, preflight,
  and shared operation semantics.
- `Source/Factory.Evaluations` is the native .NET evaluation and authoritative
  result-verification engine.
- `Source/Factory.Cli` is the native .NET `cratis-factory` human and machine
  command surface. It and Planner consume `Factory.Core` in process; neither
  shells out to Python.
- `Source/Planner/Factory` owns the durable C#/Chronicle graph and the trusted
  server-side authority for secret-reference resolution, input materialization,
  sanitization, capability brokering, approvals, and publishing. Its managed
  implementation is on hold.
- `Source/Factory.Worker` is the .NET phase-protocol, budget, cancellation, and
  normalized-event host. It calls the server-side capability broker as an
  authenticated, run-scoped client; it does not own secret resolution or
  publishing. Its implementation is on hold.
- `Source/Factory.Worker.Pi` is the only worker project that contains
  TypeScript. It is a thin, exact-pinned Pi SDK adapter over versioned
  JSON/JSONL and has no independent authority. Its implementation is on hold.

The supported target is a self-contained native .NET `cratis-factory`. Python
is not an end-user prerequisite. Node and Pi are needed only inside the packaged
Pi adapter, not for deterministic Factory operations.

## Exercise the temporary maintainer oracle

From the AI repository root, maintainers can exercise the current reference
semantics without a model, network access, or repository writes:

```shell
python3 -m pip install -r Factory/requirements.txt
REPOSITORY=/absolute/path/to/cratis-repository
python3 Factory/scripts/resolve_factory.py --repository "$REPOSITORY" \
  --purpose investigate --format text
```

The default summary fits on one terminal screen. It names the target and
repository mode, detected Cratis surfaces and versions, languages/UI, selected
profiles and important exclusions with reasons, agent and workflow rationale,
blockers, and the next safe action. Every committed ecosystem fixture fits
within 24 visual lines at 80 columns. Ask for the full decision table or
evidence and hashes only when needed:

```shell
python3 Factory/scripts/resolve_factory.py --repository "$REPOSITORY" \
  --detail explain --format text
python3 Factory/scripts/resolve_factory.py --repository "$REPOSITORY" \
  --detail trace --format text
python3 Factory/scripts/resolve_factory.py --repository "$REPOSITORY" \
  --format json-compact
```

`--detail` changes only the text projection. JSON always contains the complete
canonical result, and format/detail choices do not change the operation request
hash.

## Validate the temporary foundation

Validate the foundation from the repository root:

```shell
python3 -m pip install -r Factory/requirements.txt
python3 Factory/scripts/validate_factory.py
python3 -m unittest discover -s Factory/scripts -p 'test_*.py'
python3 Factory/scripts/evaluate_factory.py
```

Definition validation and repository inspection both emit the versioned
`operation-result` contract in `text`, `json`, or `json-compact` form:

```shell
python3 Factory/scripts/validate_factory.py --format json-compact
python3 Factory/scripts/resolve_factory.py --repository "$REPOSITORY" \
  --purpose investigate --format text
```

Inspection returns exit code `3` with typed recovery actions when repository
evidence is insufficient, required peers or an idiomatic Chronicle client are
missing, or no complete agent/workflow route exists. These inspection and
validation operations are read-only and report `sideEffectsOccurred: false`.

The evaluation runner executes only fixture-snapshot- and hash-bound machine
assertions, and saved-result verification reruns the exact selection. It emits a
typed `operation-result`; the evaluation and its explicit coverage are in
`result.value`. The current trusted catalog has ten executable
discovery/preflight cases out of 40 reviewed cases. Passing 10/10 is full
executable coverage, not full catalog or release coverage; the remaining 30
scenarios are backlog, not implied passes. See
[`../Documentation/Factory/evaluations.md`](../Documentation/Factory/evaluations.md).

Resolve, compile, and independently verify a machine-readable preflight plan
from a clean Git repository:

```shell
python3 Factory/scripts/preflight_factory.py --repository "$REPOSITORY" \
  --format text
python3 Factory/scripts/preflight_factory.py --repository "$REPOSITORY" \
  --format json --output /tmp/cratis-preflight.json
python3 Factory/scripts/preflight_factory.py --repository "$REPOSITORY" \
  --verify-plan /tmp/cratis-preflight.json --format json-compact
```

Preflight performs no model call, network operation, source write, or runtime
action. It resolves only regular tracked files materialized from the exact bound
Git commit; Git replacement objects, ignored files, and the live worktree are
not evidence. Assume-unchanged, skip-worktree, dirty, changing, linked, and
special-file inputs fail closed. Output is rejected inside the source repository
and is published outside it through a no-follow, atomic file replacement.

The human projection names the bound revision and workflow, agent phases,
scopes, phase budgets, required gates, approvals, and next legal action. The
command emits one typed `operation-result`; its `result.value` is the compiled
workflow. `--verify-plan` accepts that envelope or a bare compiled workflow and
regenerates the plan from the explicit current repository request. A plan that
fails content integrity or current-authority binding returns `integrity-error`
(exit `5`) with a typed correction action. `compile_factory.py --verify-plan`
checks document and definition integrity only and deliberately does not claim
current repository or manifest authority.

Repository snapshots and resolved profiles are compiler-bound facts, not
caller-replaceable run inputs. Project manifests may narrow the trusted baseline
policy and pin eligible workflows; they cannot select a weaker baseline policy.

The JSON plan is the authoritative execution contract. Future terminal, Studio,
Planner, API, and agent integrations will render or consume the same versioned
facts; none should infer state by scraping human-oriented output.

Issue 64 Phase A adds strict v2 artifact, provenance, receipt, phase, input, and
allowlisted agent-context contracts without wiring execution. Its local helpers
verify deterministic integrity only: they do not issue or trust signatures,
stores, sanitizers, providers, workers, or run authority. See
[`artifact-provenance-phase-a.md`](../Documentation/Factory/artifact-provenance-phase-a.md).

The first workflow is deliberately read-only:
[`investigate-cratis-issue.factory.json`](../Workflows/investigate-cratis-issue.factory.json).
It exercises typed agent handoffs, deterministic evidence gates, write-scope
enforcement, and human acceptance before the factory is allowed to write source
or publish changes.

The temporary Stage 0 scripts remain only until native .NET differential parity
is independently accepted. Managed Factory orchestration, the .NET worker host,
and the TypeScript Pi adapter remain on implementation hold. Pi-specific types
must not appear in these definitions, the .NET worker protocol, Planner, or
Studio contracts.
