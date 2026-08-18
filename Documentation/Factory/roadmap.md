# Factory roadmap and investment gates

The factory should grow through measured vertical slices. Thresholds can be
recalibrated after a baseline, but a missed gate stops expansion and redirects
investment to knowledge, contracts, or evaluation quality.

## Stage 0 — constitution and baseline

Deliver:

- Product/ownership decisions and the CLI non-interference contract.
- Versioned workflow, harness, envelope, gate, evidence, profile, policy, and
  project schemas.
- Threat model, PII retention design, and Pi adapter boundary.
- A 20–30 task benchmark drawn from real Cratis work.
- Baselines from the current Claude/Planner worker and a well-instructed single
  agent.
- Named owners and CODEOWNERS for framework/client packs.
- Human and machine interface rules, core journey prototypes, and usability
  baselines.

Continue only when the differentiating layer is demonstrably Cratis-specific,
contracts have no Pi leakage, and CLI integration duplicates no command
semantics.

Experience gate: representative developers can run repository discovery, explain
every selection and exclusion, and act on blockers without maintainer
assistance; text and compact JSON conformance tests agree on every material
fact.

Evaluation gate: foundation CI currently requires all 10 executable
discovery/preflight cases from the 40-case catalog (`full-executable-catalog`).
This is a conformance gate, not completion of the Stage 0 benchmark. Stage 0
benchmark completion and any release claim based on the whole catalog require
`full-catalog`, an exact trusted catalog hash and case-ID set, and 40/40
selected passing cases. A successful subset or 10/10 executable result cannot
satisfy that gate.

The current Python Stage 0 implementation is a temporary executable
specification and differential-parity oracle for maintainers. It is not the
supported product runtime. G0 has not passed, and managed runtime implementation
remains on hold.

Native authority is delivered in independently accepted slices. Canonical JSON
and hashing are the accepted first slice. Native closed-set Draft 2020-12 schema
validation is the accepted second slice; its private static-rebasing design
contains the confirmed JsonSchema.Net 8.0.5 embedded-resource build failure
without package-global state, reflection, lazy evaluation, a dependency change,
or altered accepted semantics.

The definition/workflow semantic compiler is the third slice. It is implemented
but **not accepted**: `Source/Factory.Core/Definitions` carries the compiler and
the closed 13-kind route table, `Source/Factory.Core.Specs/for_DefinitionCompiler`
carries its specifications, and a deletion-bound differential parity harness
still compares it against the temporary Python oracle. Frozen-tree acceptance
has not happened, and #67, #47, and G0 remain open, so nothing downstream may
treat this slice as authority yet. See
[`../../Factory/DefinitionWorkflowCompilation.md`](../../Factory/DefinitionWorkflowCompilation.md).

Across all three slices the native work still does not implement repository
discovery, preflight, evaluations, a CLI, Planner orchestration, workers,
providers, or publishing.

### P0 native authority prerequisite — planned

Before Stage 1 implementation can begin:

- `Source/Factory.Core`, `Source/Factory.Evaluations`, and
  `Source/Factory.Cli` must provide the authoritative native .NET semantics and
  human/machine command surface.
- Native results must reach contractual differential parity with the temporary
  Python oracle across the same fixtures and adversarial vectors. Python is then
  removed rather than retained as a second engine.
- `Source/Planner/Factory` and its trusted server-side authority must own secret
  reference resolution, exact input materialization, sanitization, the
  capability broker, approvals, and publishing.
- The existing `cratis` CLI must remain a separate capability provider and gain
  no Factory, Pi, provider, session, or run-state dependencies.

The .NET worker, TypeScript Pi adapter, and Planner managed control plane remain
on **implementation hold** until this native boundary and the applicable input,
provider, isolation, protocol, and evidence authorities are accepted.

## Stage 1 — read-only Pi investigation pilot

After the implementation hold is lifted, implement the committed
`investigate-cratis-issue` workflow end to end:

- A .NET `Source/Factory.Worker` host that owns the phase protocol, budgets,
  cancellation, and normalized events, and uses the trusted capability broker
  only as an authenticated, run-scoped client.
- A thin, exact-pinned TypeScript `Source/Factory.Worker.Pi` adapter that maps
  between the Pi SDK and versioned JSON/JSONL without owning secrets,
  capabilities, publishing, or workflow state.
- Authenticated, ordered, idempotent harness events.
- Disposable workspace with no GitHub write credential.
- Typed investigation output and content-addressed evidence.
- Deterministic schema, artifact, budget, path, and clean-workspace gates.
- Chronicle run/phase/gate facts and trusted server-side authority in
  `Source/Planner/Factory`.
- Planner-owned presentation or issue comment after human acceptance.
- Shadow comparison with the existing Claude investigation path.

Exit criteria:

- Duplicate callbacks produce no duplicate facts or side effects.
- Wrong-run credentials fail; skipped sequence numbers conflict.
- Worker death is reconciled within the lease timeout.
- Invalid output is corrected in the same Pi session within a fixed limit.
- The worker and Pi adapter hold no publisher credential and cannot resolve
  secrets or call capabilities except through the authenticated broker.
- Every accepted reproduction has executable evidence.
- No accepted run changes source, exceeds scope, leaks fixture PII, or lacks a
  required gate.
- At least ten historical investigations report quality, latency, cost,
  correction count, and human edit distance against baseline.
- At least 80% of pilot users complete the investigation without maintainer
  intervention and can locate scope, status, gates, evidence, and next actions
  in under one minute.

## Stage 2 — one golden application stack

Support `.NET + Arc + Chronicle + React + Components` only:

- Screenplay-to-application proposal workflow.
- One vertical-slice implementation workflow.
- Read-only Chronicle diagnosis.
- Automatic version-aware profile selection and progressive skill loading.
- Dedicated branch/worktree, deterministic checkpoint/publisher, and
  pull-request approval policy.

Exit criteria:

- 100% of known commands execute as code phases.
- Every run has complete phase, gate, approval, and evidence records.
- Required gates never use placeholders or pass when unavailable.
- No out-of-scope writes in adversarial tests.
- No persisted credentials or known PII fixtures.
- At least 70% accepted end-to-end tasks or a material improvement over
  baseline.
- Median human correction is under 15 minutes for accepted tasks.
- Existing CLI installation and active context remain unchanged.

If this cannot beat a single well-instructed agent after instrumentation and
deterministic gates, improve the corpus and evaluators before adding
choreography.

## Stage 3 — managed Planner pilot

- Keep Claude and Pi adapters side by side behind the same .NET protocol host
  and server-side trusted authority.
- Route a controlled set of real work through both behind a feature flag.
- Split planning, building, gates, review, and publishing into durable phases.
- Add stop, steer, retry, resume, cancellation, lease reconciliation, and
  duplicate-delivery tests.
- Render the phase/gate/evidence timeline in Planner.

Continue after at least 25 real work items when merge rate and review burden are
no worse than today, time to acceptable pull request improves materially,
resilience tests pass, and there are zero high-severity credential,
authorization, repository, or PII incidents.

## Stage 4 — Studio proposal loop

- Export versioned Screenplay bundles from Studio.
- Run against an immutable model revision.
- Return model/code diffs, diagnostics, gates, provenance, and unresolved
  decisions as a `ChangeProposal`.
- Apply accepted proposals optimistically; rebase or regenerate when
  collaborative state moved.
- Replace broad autonomous mode with workflow capability grants.

Do not begin with invisible direct mutation of the collaborative model.

## Stage 5 — bounded expansion

Add verified Kotlin/Java Chronicle, TypeScript Chronicle, and Elixir Chronicle
client profiles, framework-contribution profiles, controlled runtime operations,
and eventually deployment one evaluated capability class at a time. React with
Arc.React and Cratis Components remains the supported frontend profile unless
Cratis ships and evaluates another frontend surface.

Low-risk automatic pull-request creation and later auto-merge require sustained
evidence. Production writes and deployment remain separately governed.

## Pi maintenance policy

- Keep Pi SDK integration only in `Source/Factory.Worker.Pi`; no Pi type crosses
  its versioned JSON/JSONL boundary.
- Pin exact Pi and extension versions in released worker artifacts.
- Run the complete compatibility/evaluation matrix before upgrading.
- Contribute missing hooks upstream before carrying patches.
- Normalize Pi events immediately in the .NET worker protocol host.
- Allow only approved, provenance-checked extensions in hosted workers.

Fork Pi only after an essential production requirement cannot be implemented
through public extension/SDK surfaces, upstream will not accept the required
hook, and Cratis has carried multiple production-critical core patches across at
least two release cycles. Until then, a fork buys merge work rather than
differentiation.

## Success metrics

- End-to-end accepted-run and first-pass gate rates.
- Pull-request merge rate, review rounds, and human correction minutes.
- Escaped defects and rollbacks.
- Out-of-scope writes, denied tool attempts, and PII/security violations.
- Cost and wall time per accepted change.
- Context consumption and schema-repair attempts.
- Version/profile misclassification and invented API rate.
- Reproducibility of deterministic acceptance across repeated runs.

Model output that lacks deterministic acceptance evidence is not a successful
factory run.
