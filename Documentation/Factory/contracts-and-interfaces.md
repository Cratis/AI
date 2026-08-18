# Factory contracts and interfaces

## One semantic system, two projections

The Factory is designed for humans, scripts, IDEs, services, and other AI
agents. They use the same operations and versioned facts.

| Concern   | Machine projection                                | Human projection                                             |
| --------- | ------------------------------------------------- | ------------------------------------------------------------ |
| Discovery | `ResolvedProfile` JSON                            | Stack explanation, selected profiles, warnings, and blockers |
| Planning  | `CompiledWorkflow` JSON                           | Ordered phase, approval, policy, and gate summary            |
| Progress  | ordered `HarnessEvent` JSONL                      | Run timeline and live status                                 |
| Decisions | bound approval facts                              | Explicit accept, reject, and correction choices              |
| Evidence  | typed content-addressed references                | Links, summaries, and gate details                           |
| Failure   | stable diagnostic code, location, and exit status | Actionable explanation and suggested correction              |

Structured facts are authoritative. A UI or text command must not create hidden
state, and an automated consumer must not scrape display strings.

## Interface requirements

Every public Factory operation must provide:

- A versioned request and result schema.
- Deterministic compact JSON and a readable text projection.
- JSONL for ordered event streams.
- Stable identifiers, diagnostic codes, and exit-status semantics.
- Non-interactive stdin or file input and stdout output.
- Idempotency or content hashes wherever repetition could create a side effect.
- Explicit blocked, denied, approval-required, failed, and successful states.
- Classification and sanitized evidence references rather than raw secrets or
  PII.

The future `cratis-factory` command, Planner API, Studio integration, MCP
server, and harness adapters must call the same core implementation. None
receives a private interpretation of workflow or policy semantics.

## Operation result and diagnostic protocol

The shared v1 operation boundary is defined by:

- [`operation-result.schema.json`](../../Contracts/v1/operation-result.schema.json)
  for one authoritative operation outcome.
- [`diagnostic.schema.json`](../../Contracts/v1/diagnostic.schema.json) for
  stable codes, severity, structured locations, classified evidence references,
  retry disposition, and related action IDs.
- [`next-action.schema.json`](../../Contracts/v1/next-action.schema.json) for
  discriminated retry, input correction, input supply, option selection,
  command, detail inspection, and maintainer actions.
- [`operation_result.py`](../../Factory/scripts/operation_result.py) for
  canonical result construction, typed-result hashing, tamper verification,
  human and machine rendering, and exit-code mapping.

An operation result always names the operation and request hash, declares
whether side effects occurred, and has exactly one status:

| Status              | Exit code | Meaning                                                                               |
| ------------------- | --------: | ------------------------------------------------------------------------------------- |
| `success`           |         0 | The operation completed and the optional typed result is usable.                      |
| `invocation-error`  |         2 | Arguments or invocation shape were invalid.                                           |
| `blocked`           |         3 | No unsafe fallback was chosen; at least one typed next action is available.           |
| `invalid`           |         4 | An input, manifest, definition, or configuration is invalid.                          |
| `integrity-error`   |         5 | A content hash, signature, sequence, or immutable binding failed verification.        |
| `approval-required` |         6 | A human or authorized policy decision must be bound to the request before continuing. |
| `denied`            |         7 | Policy forbids the requested operation or capability.                                 |
| `unexpected`        |        70 | The operation failed outside its expected domain failures.                            |

Every non-success result has a diagnostic. Failure statuses contain an error
diagnostic, while `blocked` and `approval-required` results must contain a next
action. Stable diagnostic codes and action IDs are machine identifiers;
messages, titles, and descriptions are human projections and are never parsed as
protocol state.

An optional result is a typed wrapper containing `schemaId`, the canonical hash
of `value`, and `value` itself. `schemaId` must identify a trusted schema
shipped in `Contracts/v1`, and the value is validated against that schema before
hashing and again before rendering. The outer `contentHash` covers the complete
envelope with its own hash omitted. Builders and renderers validate the complete
operation schema and verify both hashes before emitting either projection.

A `run-command` action names a capability identity, exact argument array,
working directory, and declared effect. These fields are a proposal, not
authority: every command action is `requires-confirmation` or `human-only` and
always requires approval. A later capability broker must bind the capability
identity to trusted implementation and effective policy before execution.

Human-facing summaries, diagnostics, locations, evidence references, and actions
reject terminal control, bidirectional-override, zero-width format, and
line- and paragraph-separator characters. Inspection summary text includes the facts
required to understand the decision and next action without exposing content
hashes as visual noise; inspection `trace` text adds evidence and request,
result, definition, and envelope hashes. Action projections retain kind and
automation, command capability and approval state, and side-effect state. Typed
result values remain authoritative in the structured result and
operation-specific text projections expose their material human facts.

Before either projection is rendered, typed values are recursively checked for
C0, C1, Unicode bidirectional-control, Unicode zero-width format (`U+200B`-
`U+200F`, `U+FEFF`), and Unicode line- and paragraph-separator (`U+2028`,
`U+2029`) characters. Newlines are rejected
unless the trusted result contract marks that exact field with
`x-cratis-multiline`; that allowance admits only the newline itself, never a
line or paragraph separator. Every such field also has a finite length. The
check runs both when a typed result is built and when a supplied envelope is
verified, so recomputing hashes cannot turn unsafe display text into trusted
durable evidence.

## Approval identity and durable text

An approval records an opaque, run-scoped actor reference—not a user ID, email,
Chronicle `Subject`, account name, or hash of one of those values:

```json
{
  "protocolVersion": "1",
  "decisionId": "00000000-0000-4000-8000-000000000001",
  "runId": "00000000-0000-4000-8000-000000000002",
  "phaseAttemptId": "00000000-0000-4000-8000-000000000003",
  "requestHash": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  "decision": "accepted",
  "summary": "The bounded request is accepted.",
  "inlineTextClassification": "internal",
  "requestedCorrection": null,
  "decidedBy": {
    "kind": "human",
    "actorReference": "run-actor:1111111111111111111111111111111111111111111111111111111111111111"
  },
  "decidedAt": "2026-08-15T12:00:00Z"
}
```

The trusted approval service issues `actorReference` as a random mapping or a
keyed pseudonym scoped to one run and binds it to the run, phase attempt,
request, and decision. A plain SHA-256 of a stable identity is not acceptable:
it is enumerable and correlatable. If audit policy requires identity recovery,
the reverse mapping lives encrypted behind separate access control and
retention—not in the Factory ledger.

`inlineTextClassification` applies only to bounded inline summaries, findings,
decisions, paths, and similar display facts. It is deliberately not an
aggregate classification and therefore cannot understate a separately
classified artifact. Raw commands, tool arguments, logs, approval reasons,
failure details, phase handoff notes, source, and model content are represented
by `{ reference, contentHash, classification }`. Durable references use the
opaque `artifact:sha256:<64 lowercase hex>` form; display paths and URLs are not
artifact identities. Changed-file entries are normalized repository-relative
paths and cannot be absolute, URI-shaped, or traverse through `..`.

Machine renderers emit only one JSON document and a trailing newline. They do
not add headings or failure prose outside the envelope. Text projections consume
the same verified envelope. Stage 0 inspection, definition validation,
preflight, repository-authority verification, and deterministic evaluation use
this boundary.

## Factory canonical JSON v1

Content-addressed contracts use a deliberately small cross-runtime JSON subset:

- UTF-8 encoding.
- Object keys sorted lexicographically by Unicode code point.
- Compact separators with no insignificant whitespace.
- Strings are preserved without Unicode normalization; lone surrogate code
  points are rejected.
- Duplicate object keys are rejected while parsing.
- Integers are limited to JavaScript's interoperable safe range,
  `-9007199254740991` through `9007199254740991`.
- Floating-point values are rejected.
- Arrays preserve declared order.

A self-addressed document computes its SHA-256 over the canonical document with
`contentHash` omitted. A schema reference hashes the canonical transitive
closure of the root schema and every reachable external Factory schema, not
only the root file.

These constraints are implemented by the temporary
`Factory/scripts/canonical_json.py` oracle and the accepted native
`Cratis.Factory.Core` canonical JSON slice. The language-neutral conformance
vectors remain the shared cross-runtime contract.

The integrity-only v2 artifact/provenance checkpoint and its canonical vectors
are documented in
[`artifact-provenance-phase-a.md`](./artifact-provenance-phase-a.md). Version 2
is not an automatic upgrade path for v1 harness or compiled-workflow documents.

## Native JSON Schema boundary

`Cratis.Factory.Core` accepts immutable caller-supplied UTF-8 schema and
instance bytes plus exact logical schema identifiers. It loads a bounded,
closed Draft 2020-12 resource set and resolves references only against that
explicit set. Repository enumeration and schema selection remain caller
responsibilities; Core never infers authority from a filename, working
directory, `documentKind`, URI scheme, or content hash.

Public results use Factory-owned load and validation statuses, diagnostic codes,
severity and status values, safe structural locations, sorted closure
membership, and canonical set/closure identities. Library exceptions,
localized messages, raw values, untrusted property names, and filesystem paths
are not contract facts. URI and date-time formats remain annotations; UUID is
the only asserted format in this contract version.

Callers use `GetClosure` to select a top-level or embedded resource directly
without inventing an instance. The closure includes embedded resources reached
through schema applicators and follows every admitted resource's reference edges
transitively; unreachable embedded siblings remain outside it. Invalid
identifiers, valid-but-absent identifiers, bounded evaluation failures,
complete invalid verdicts, and diagnostic-cap outcomes remain distinct typed
statuses for automation.

The independently accepted private static-rebasing design contains the
confirmed JsonSchema.Net 8.0.5 embedded-resource build failure. Factory-owned
identifier handlers, exact rebased local edges, fresh complete `Fetch = null`
registries, and structural finalization preserve the explicit closure without
package-global state or evaluation-as-resolution. The weighted
63-document/135-case/24-generator contract and its exact maximum and maximum
plus one outcomes are accepted; work and concurrency limits remain per-call and
host-aggregate responsibilities respectively.

The exact supported keyword surface, closure rules, safe-location encoding,
limits, integrity construction, and migration deletion condition are defined in
[`Factory/SchemaValidation.md`](../../Factory/SchemaValidation.md).

## Harness request traceability

[`harness-request.schema.json`](../../Contracts/v1/harness-request.schema.json)
projects one selected agent phase from an already authority-verified compiled
workflow. It carries exact content hashes and versioned references for the
compiled workflow, selected phase and ordinal, repository snapshot, plural
resolved-profile composition, effective policy and optional project manifest,
selected agent definition, and the compiled capability grants. It also binds the
immutable workspace, declared classified/sanitized inputs, finite execution
limits, provider selection, and output schema. The legacy singular `profile`
shape is not accepted.

`requestHash` is the SHA-256 of Factory canonical JSON v1 with only
`requestHash` omitted.
[`harness_request.py`](../../Factory/scripts/harness_request.py) builds the
traceability projection from compiled fields and verifies schema validity, all
exact references, nested compiled hashes, ordered inputs, classification floors,
aggregate input size, phase timeout, and the self-hash. It deliberately accepts
the compiled workflow as a trusted input: callers must first perform
repository-authority preflight, not merely integrity verification.

The request and helper do not start a harness, authorize a provider, resolve a
credential, grant a capability, or execute a tool. A future broker/server must
authenticate the request, bind it to the authoritative run and attempt,
revalidate policy at dispatch, materialize only declared artifacts, enforce
filesystem/network/tool/secret scopes and budgets, and prevent
time-of-check/time-of-use substitution. Agents must not discover
repository-global notes or credentials as implicit context.

## Current executable interfaces

The Stage 0 implementation exposes:

```shell
python3 Factory/scripts/validate_factory.py --format text
python3 Factory/scripts/resolve_factory.py --repository <path> --format text
python3 Factory/scripts/resolve_factory.py --repository <path> \
  --detail explain --format text
python3 Factory/scripts/resolve_factory.py --repository <path> \
  --detail trace --format text
python3 Factory/scripts/resolve_factory.py --repository <path> --format json-compact
python3 Factory/scripts/preflight_factory.py --repository <path> \
  --format json --output /tmp/cratis-preflight.json
python3 Factory/scripts/preflight_factory.py --repository <path> \
  --verify-plan /tmp/cratis-preflight.json --format json-compact
python3 Factory/scripts/compile_factory.py --verify-plan <bare-compiled-workflow.json>
python3 Factory/scripts/evaluate_factory.py --format text
python3 Factory/scripts/evaluate_factory.py \
  --verify-result /tmp/cratis-factory-evaluation.json --format json-compact
```

Resolution and preflight compilation perform no model calls, network access,
repository writes, or runtime operations. Executable preflight requires a clean,
exact Git root and scans a bounded materialization of regular tracked files from
the exact commit. Ignored live files are not evidence; assume-unchanged,
skip-worktree, tracked links, dirty state, and concurrent changes are rejected.
Preflight output must be standard output or outside the source repository.

Inspection detail is projection-only: machine formats always contain the full
canonical result and detail does not affect the request hash. A bounded text
envelope is a property of specific commands, not of every public command.
`resolve_factory.py` at its default `--detail summary` stays within 24 visual
lines at 80 columns for every committed ecosystem fixture — 16 to 22 measured,
and the only such bound a test enforces. `validate_factory.py` occupies 13, and
`compile_factory.py` 22 without a supplied plan. Two commands exceed 24 by
design, because projecting a complete inventory is their purpose: a successful
`preflight_factory.py` run occupies 33 visual lines, naming every phase, budget,
and required gate, and `evaluate_factory.py` occupies 43, listing every catalog,
executable, selected, and executed case identifier. The non-success projections
of both stay within the envelope, at 13 to 23. The 80 columns are a soft-wrap
assumption used to count those visual lines, not a limit on physical line width:
the text projections perform no wrapping and do emit physical lines wider than
80 columns. `explain` adds every profile match rationale and complete recovery
detail; `trace` adds evidence and hashes.

The preflight JSON is an `operation-result`; its typed `result.value` is the
compiled workflow. Its text projection names the immutable revision, workflow,
agent phases, scopes, budgets, gates, approvals, and next legal action.
Repository-authority verification regenerates that value from the explicit
current repository, target, purpose, workflow selection, manifest, and trusted
baseline policy. Supplied plans that fail integrity or current-authority binding
return `integrity-error` (exit `5`) with a typed correction action. The
lower-level compiler verifier is explicitly integrity-only: it detects schema,
hash, definition, and deterministic recompilation tampering but cannot establish
that caller-supplied repository facts describe the current repository.
