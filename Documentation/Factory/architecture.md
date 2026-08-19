# Factory architecture

## Governing rule

Humans own intent and acceptance. Deterministic code owns the workflow, durable
state, permissions, retries, gates, and side effects. Agents own bounded
reasoning inside individual phases.

Pi owns the inner coding loop of a Pi-backed agent phase. It never owns the
cross-phase graph.

## Equal human and machine interfaces

Humans and software agents are equal consumers of the Factory. Every operation
must therefore have one versioned structured contract and two projections over
it:

- The machine interface uses JSON Schema, deterministic JSON or JSONL, stable
  identifiers and diagnostic codes, canonical content hashes, explicit
  capability decisions, idempotency keys, and non-interactive commands.
- The human interface renders the same facts as concise explanations,
  recommendations, approval choices, evidence timelines, and actionable
  diagnostics.

Structured facts are authoritative. Human-facing prose must not contain state
that is absent from the machine contract, and machines must never need to scrape
terminal text, Markdown, or UI labels. Text and JSON output for the same
operation must cite the same run, phase, evidence, decision, and content hashes.

The first native deterministic substrate is `Cratis.Factory.Core`: bounded
canonical JSON and hashing, followed by immutable local-only Draft 2020-12
schema resource sets. Both consume caller bytes in process and own no repository,
network, process, provider, or publishing capability. Later discovery,
compilation, evaluation, CLI, Planner, and worker slices consume these contracts;
they do not replace their integrity or validation semantics.

The independently accepted schema slice contains the confirmed JsonSchema.Net
8.0.5 embedded-resource build failure through private static rebasing. Factory
preflights and rewrites exact local edges, builds each resource with inert
Factory-owned identifier handlers and a fresh complete `Fetch = null` registry,
then verifies the built graph structurally. It does not rely on package-global
state, reflection, lazy evaluation, a dependency change, or altered accepted
semantics.

The accepted weighted corpus contains 63 reusable schema documents, 135 cases,
and 24 deterministic generator kinds. `GetClosure` includes embedded
resources reached through schema applicators and then closes every admitted
resource's references transitively. Validation uses only private local
registries that process-global registration cannot influence, and UUID is the
only asserted format. The accepted contract and its platform caveats are
defined in [`Factory/SchemaValidation.md`](../../Factory/SchemaValidation.md).

Local commands should default to safe interactive text for a terminal while
supporting an explicit compact JSON mode, JSONL for event streams, stable exit
codes, and stdin/file inputs. Hosted APIs and MCP tools use those same contracts
rather than a second semantic implementation.

## System shape

```text
Studio                                  Planner / Factory UI
intent · Screenplay · proposal diff     work · runs · approvals · evidence
             └──────────────┬────────────────────────┘
                            ▼
              Factory control plane (C# / Chronicle)
              graph · leases · policy · retry · ledger
                    │          │          │
             agent phase   code phase  human phase
                    │          │          │
              Factory.Worker   │       approval API
              Pi/Claude adapters
                    │          │
                    └────┬─────┘
                         ▼
              deterministic capability plane
              cratis CLI · Screenplay · Stage
              build/test/analyzers · browser · git
```

Planner already separates Docker/Kubernetes through `IWorkerRuntime`; keep that
abstraction. Harness selection is a different concern:

```text
Factory phase scheduler
    → harness descriptor selects image, protocol, and provider mapping
    → IWorkerRuntime chooses Docker or Kubernetes
    → the worker implements Pi, Claude, or a future harness adapter
```

Pi types stay inside the Pi adapter. Planner, Studio, workflows, stored facts,
and external contracts use only the versioned schemas under `Contracts/v1`.

## Bounded contexts

### Work intake

Normalize local requests, GitHub issues, Studio proposals, alerts, and API calls
into an objective, immutable source/model revision, constraints, classification,
requested workflow, priority, and budget. Intake does not contain a
model-specific prompt.

### Workflow catalog

Store immutable, versioned DAG definitions. A phase declares its kind,
input/output schema, role or deterministic capability, dependency edges,
write/network/secret scope, attempt limit, timeout, and gates. Begin with data
definitions validated by JSON Schema; do not create a new workflow programming
language.

### Runs and phases

Snapshot the workflow hash, source revision, resolved profile and skill hashes,
harness/worker/Pi versions, provider/model, CLI and Cratis package versions,
policy version, and input artifact hashes. Every phase attempt is independently
observable and restartable. Context crosses phases only as typed envelopes and
immutable artifact references.

### Profile resolution

Resolve capabilities in this order:

1. Explicit run override.
2. Project `.cratis/factory.json` manifest.
3. Studio project configuration.
4. Installed dependencies and repository evidence.
5. Repository profile metadata.
6. A safe minimal fallback.

Compose a profile from purpose, framework/application mode, language/client,
frontend, task-specific packs, installed versions, and policy. Resolve per
phase: an investigator, builder, reviewer, and publisher should not receive the
same tools or knowledge.

Negative capabilities are first-class, but they describe unavailable Cratis
capabilities rather than invented ecosystem combinations. React with Arc.React
and Cratis Components is the supported Cratis frontend profile; other frontends
are outside that profile unless a real package and evaluated capability pack
exists.

### Workspace and artifacts

Code prepares a disposable non-root container, immutable base commit, dedicated
branch/worktree, protected paths, allowed write set, and checkpoint. Agents
produce patches and metadata. Code validates, commits, pushes, opens pull
requests, merges, and deploys after policy approval.

Artifacts are content-addressed references carrying kind, SHA-256, and data
classification. They are not shared mutable handoff files.

### Policy and approvals

Policy grants capabilities; skills can never grant a capability. Every phase
receives explicit filesystem, tool, network, secret, time, token, cost, and
attempt budgets. An agent cannot approve its own elevated action, alter the gate
evaluating its run, or obtain `--yes` directly.

### Gates and evidence

A gate verifies a claim with deterministic evidence. Examples include Screenplay
compilation, generated-output provenance, write-scope integrity, Arc/Chronicle
analyzers, Debug and Release builds, specifications, frontend checks, browser
assertions, runtime diagnostics, artifact hashes, and protected-file checks.

An unavailable required gate is `blocked` or `failed`, never passed. Schema
failures and repairable gates may return a targeted correction to the same
harness session within a fixed limit; the factory owns that loop.

## Harness protocol

`HarnessRequest` is the content-addressed traceability projection of an already
authority-verified compiled plan. It binds the exact compiled-workflow hash and
versioned workflow reference, phase ID and ordinal, repository-snapshot hash,
resolved-profile hash and ordered composition references, effective-policy and
optional project-manifest hashes, selected agent-definition hash, exact compiled
capability grants, immutable workspace, typed classified/sanitized inputs,
finite budgets, replaceable harness/model selection, and output schema.
`requestHash` is the Factory canonical JSON v1 hash with `requestHash` omitted.

Those bindings detect stale or substituted requests; they do not authorize a
worker, provider, tool, secret, or side effect. Agents receive only the
artifacts explicitly declared as workflow inputs. Repository-global notes such
as `.agents/PROJECT.md`, credentials, and undeclared files are not implicit
context. A future broker must independently enforce the compiled grants and
resolve secret references without embedding secret values.

`HarnessEvent` normalizes session, message, tool, approval, artifact,
checkpoint, usage, result, failure, and cancellation events. Delivery must be
authenticated with a run-scoped credential, idempotent by event ID, ordered by
sequence, size-bounded, and rejected after the terminal state.

`PhaseEnvelope` and specialized outputs such as `InvestigationResult` carry
summaries, changed paths, classified artifact/evidence references, findings,
risks, and explicit next-phase notes. Final prose is presentation, not the
machine contract.

`GateReport` separates pass, fail, and blocked outcomes and records individual
checks, sanitized evidence references, and duration.

## Model-first application workflow

The flagship application workflow should become:

1. Human or Studio defines intent.
2. A modeling agent proposes only a Screenplay patch.
3. Code compiles Screenplay and returns diagnostics.
4. A read-only reviewer checks domain coherence, event ownership, PII/subject
   identity, tenancy, and completeness.
5. Human or explicit autonomy policy accepts the model.
6. Stage renders deterministically.
7. A builder fills only approved imperative gaps.
8. Code runs analyzers, Debug/Release builds, specifications, frontend checks,
   and Stage scenarios.
9. A read-only reviewer checks the objective, diff, and evidence.
10. Code checkpoints and publishes a pull request.
11. A human accepts or requests a bounded correction.

Existing applications can enter from source through
`cratis screenplay generate`, reconcile compiler diagnostics, and then use the
same forward workflow. Regeneration must never silently overwrite human code.

## Evidence ledger

Chronicle stores durable workflow facts, decisions, approvals, hashes, usage
summaries, and outcomes. Large logs, patches, and raw artifacts live in
encrypted, access-controlled object storage with explicit retention. Do not put
raw prompts, source archives, credentials, event/read-model payloads, or model
transcripts into an immutable event log by default.

OpenTelemetry correlates run → phase → agent session → turn/tool call and gate
execution. Persist sanitized identifiers and outcomes, not full user content.
