---
name: cratis-software-factory
description:
    PLATFORM OPERATOR SKILL — for people building and running the Cratis
    delivery platform itself, not for writing a feature in a Cratis
    application. Plan, review, or operate governed agent workflows for Cratis
    applications and framework repositories. Use whenever work involves the Cratis Software
    Factory, Pi or another coding harness, Planner/Studio automation,
    multi-phase agent delivery, Screenplay-to-code generation, factory
    workflows/profiles/policies/contracts, autonomous Cratis development, or
    evaluating whether a task is safe and measurable enough for factory
    execution.
---

# Cratis Software Factory

Use Cratis-specific semantic and deterministic capabilities to turn an objective
into typed proposals, verified artifacts, and an acceptance decision. Keep the
harness replaceable and the existing `cratis` CLI unchanged.

## Preserve the architecture

- Humans own intent and acceptance.
- Deterministic code owns graph state, retries, capabilities, gates, approvals,
  commits, publishing, and runtime operations.
- Agents perform bounded judgment inside one phase.
- Pi is a harness adapter, not the factory or a source of Cratis semantics.
- `cratis` is an introspected capability provider, not the factory runtime.
- Skills influence behavior but never grant tools, writes, networks,
  credentials, or approvals.
- Phase completion is not run acceptance.

Read [references/boundaries.md](references/boundaries.md) before changing
product/repository boundaries or invoking the CLI. Read
[references/workflow-design.md](references/workflow-design.md) when creating or
reviewing a workflow. Read
[references/profiles-security-and-pii.md](references/profiles-security-and-pii.md)
when resolving a stack, accessing Chronicle, handling PII, or granting any
capability. Read
[references/read-only-investigation.md](references/read-only-investigation.md)
for diagnosis involving source, Chronicle, subjects/identities, or other
sensitive runtime evidence.

## 1. Establish scope and authority

During ordinary human-driven planning, follow the repository instructions in the
active workspace, inspect the dirty worktree, and preserve user changes. During
a compiled Factory phase, treat the bound request and its declared
classified/sanitized input artifacts as the complete agent-visible authority. Do
not discover or read `.agents/PROJECT.md`, credentials, repository-global notes,
or undeclared files by default. Identify whether the repository is a Cratis
application, a Cratis framework, a modeling workspace, or an operational target
from the supplied evidence.

Separate the user's objective from permissions. A request to plan, investigate,
or review does not authorize source edits, GitHub writes, runtime mutation,
deployment, or production access.

Planning may continue without a concrete repository or runtime target, but
execution may not. Runtime/source claims remain explicitly provisional or
blocked until the immutable revision, exact environment/scope, and required
grants exist.

For application behavior, model event vocabulary and invariants before
implementation. Use the `event-modeling` skill when events or ownership are
unclear. Use the specialized Cratis implementation and specification skills only
in the phases that need them.

## 2. Resolve a minimal capability profile

Resolve in precedence order: explicit override → `.cratis/factory.json` → Studio
configuration → dependency/repository evidence → safe fallback.

Compose only what the phase needs:

```text
purpose
+ application | framework | modeling | operations
+ .NET | Kotlin | Java | TypeScript | Elixir
+ React/Arc/Components | no Cratis frontend
+ installed versions
+ task-specific skills
+ environment policy
```

Record negative capabilities only when repository evidence shows a Cratis
capability is unavailable. React with Arc.React and Cratis Components is the
supported Cratis frontend; do not create profiles for frontend integrations
Cratis does not ship.

If capability discovery is required, execute
`cratis llm-context -o json-compact` and validate against
`cratis llm-context --schema`. Do not infer or duplicate CLI commands from
memory.

## 3. Compile the workflow

Make dependencies explicit as a directed acyclic graph of `human`, `agent`, and
`code` phases.

For every phase specify:

- Stable ID and purpose.
- Typed inputs and output schema.
- Logical role or deterministic capability.
- Exact write, network, and secret scopes.
- Timeout, budget, maximum attempts, and correction policy.
- Gates and evidence needed before downstream work.

Turn every known command into a code phase. Builds, Screenplay compilation,
analyzers, specifications, frontend checks, browser assertions, artifact
hashing, Git operations, and publishing are not agent tasks.

Use one agent phase when one is enough. Add a separate reviewer only when
independent read-only judgment improves a material decision. Never add agents
merely to simulate an organization.

## 4. Enforce policy before execution

Use deny-by-default policy. Protect the workflow, contracts, policy, gates, and
`.git` from agent writes. Execute commands as argument arrays, not shell
strings.

Never let an agent run `cratis context set`, `context set-value`, `llm use`,
`llm clear`, `update`, or `init`. Never expose `--yes`; trusted code may add it
only after policy and independent approval resolve the exact operation and
scope.

Managed execution requires a disposable non-root workspace, immutable base
revision, default-deny network, short-lived phase credentials, protected paths,
output limits, and a deterministic publisher. If those controls are unavailable,
downgrade to planning/read-only work or report the workflow as blocked—do not
claim sandboxed autonomy.

A request not to mutate a target also excludes replay, retry, repair, and local
writes against that target. A synthetic disposable reproduction is a different
target and requires explicit scope; never assume it is authorized by a read-only
request.

## 5. Run bounded phases

Snapshot workflow, source/model revision, resolved profile/skills,
worker/harness/model, CLI/package versions, policy, and input hashes before
starting.

Pass context between phases only through schema-valid envelopes and
content-addressed artifact references. Do not use hidden cross-role conversation
state or implicit repository-global project notes.

When an agent output is malformed or a gate failure is safely repairable, send
one targeted correction to the same phase session. The deterministic runner owns
the attempt limit. A new role gets a new session and only the approved
envelope/evidence.

Agents produce proposals, patches, findings, and metadata. Trusted code performs
commits, pushes, pull requests, merges, deployments, replays, migrations, and
other durable side effects.

## 6. Gate claims with fresh evidence

Run every applicable repository-specific gate. Unavailable required gates are
`blocked`; placeholder commands and self-reported success are never evidence.

At minimum verify:

- Output schema and artifact hashes.
- Changed paths against the write set, including untracked files and path
  escapes.
- Screenplay/compiler/analyzer correctness where applicable.
- Debug and Release builds and specifications for Cratis .NET work.
- Frontend lint, tests, compile/build, and visual behavior when changed.
- Protected files, dependencies, generated artifacts, and secrets.
- Budget, capability, approval, and data-classification compliance.

Run acceptance is the conjunction of required gate outcomes and approvals, not
the success status of the last phase.

A diagnosis without an existing semantic specification, compiler/analyzer check,
or reproducible deterministic observation may be accepted only as a provisional
hypothesis. Definitive root-cause acceptance remains blocked until semantic
evidence exists; creating that evidence is a separately authorized
implementation workflow.

## 7. Return an evidence-backed result

Report:

- Objective and immutable source/model revision.
- Workflow/profile/policy/harness versions or hashes.
- Phase and gate outcomes, including blocked checks.
- Changed artifacts and their hashes/classification.
- Approvals and durable side effects performed by trusted code.
- Residual risks, open decisions, and what was not verified.
- Cost, duration, correction count, and human follow-up needed when available.

Persist sanitized facts and artifact references. Do not put raw prompts,
credentials, source archives, event/read-model payloads, identities, subjects,
or full transcripts into an immutable event log by default.

## Completion checklist

- [ ] The CLI remains a capability provider; no factory state or harness
      dependency was added to it.
- [ ] The selected profile is evidence-based, version-aware, minimal, and
      records exclusions.
- [ ] Known commands and side effects are deterministic code phases.
- [ ] Agent phases have bounded capabilities and schema-backed outputs.
- [ ] Required gates executed real checks and acceptance is explicit.
- [ ] PII, secrets, telemetry, and provider routing follow classification
      policy.
- [ ] The final result distinguishes verified evidence, agent judgment, and
      unresolved work.
