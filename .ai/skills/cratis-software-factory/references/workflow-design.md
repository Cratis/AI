# Workflow design reference

## Phase kinds

<!-- markdownlint-disable MD013 -->

| Kind  | Use for                                                                                 | Must not do                                               |
| ----- | --------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Human | Intent, model acceptance, elevated-operation approval, final acceptance                 | Carry worker tools, networks, or secrets                  |
| Agent | Ambiguous modeling, investigation, bounded implementation, review                       | Own graph transitions, retries, publishing, or acceptance |
| Code  | Compilation, generation, build/test, hashing, policy, Git/publishing, runtime operation | Substitute a model judgment for a deterministic check     |

<!-- markdownlint-enable MD013 -->

Every phase declares stable ID, dependencies, typed inputs/output, capabilities,
budget, attempt limit, and gates. Workflows name roles rather than models;
scheduling maps roles and risk to provider/model availability.

## Core contracts

Snapshot a harness request with run/attempt IDs and exact content-hash bindings
to the compiled workflow, phase ID and ordinal, repository snapshot, resolved
profile composition, effective policy and optional project manifest, selected
agent definition, compiled capability grants, typed inputs, budgets, and output
schema. Bind the replaceable harness/provider/model selection without granting
it authority. Compute `requestHash` over Factory canonical JSON v1 with
`requestHash` omitted. Never embed secret values.

The request is a traceability projection of an already authority-verified
compiled workflow, not an authorization token. Agents consume only the
classified and sanitized artifacts explicitly declared in `inputs`;
repository-global notes such as `.agents/PROJECT.md`, credentials, and
undeclared files are not implicit context.

Normalize harness activity into ordered events: session start/resume, progress,
tool request/start/complete, approval request/resolve, artifact/checkpoint,
usage, result, failure, and cancellation. Authenticate with a run-scoped token,
deduplicate by event ID, enforce sequence, and reject cross-run or post-terminal
delivery.

Phase results carry status, summary, content-addressed artifacts/evidence,
changed files, findings, risks, and notes. Gate reports carry pass/fail/blocked
outcome, checks, sanitized evidence references, and duration.

Generate language types and prompt-facing schemas from one JSON Schema source.
Do not hand-maintain parallel definitions.

## Correction loop

1. Agent submits a result through the schema-backed result tool.
2. Code validates schema, write scope, artifacts, budgets, and deterministic
   gates.
3. If repairable, code returns a concise failure report to the same session.
4. Agent corrects within the remaining attempt/budget limit.
5. Exhaustion fails the phase; it never manufactures acceptance.

Session identity includes harness/model, role prompt, skill/profile, tool
policy, workflow, source revision, and policy hashes. Any incompatible change
starts a new session.

## Flagship model-first workflow

```text
intent
→ agent proposes Screenplay only
→ code compiles Screenplay
→ read-only domain/PII review
→ human/policy model approval
→ Stage renders deterministically
→ agent fills approved gaps
→ code runs analyzers/build/specs/frontend/Stage checks
→ read-only review
→ code checkpoints and publishes
→ human acceptance
```

For existing source, begin with deterministic Screenplay generation and
reconciliation. Never silently overwrite human code during round trips.
