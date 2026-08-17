# Factory experience principles

## Product promise

A developer should be able to point the Factory at a repository, understand what
it discovered and why, choose a useful workflow, and retain control without
learning harness internals. An automated caller should be able to do the same
without a terminal, UI, or prose parser.

The experience is successful only when it reduces the time and judgment needed
to reach a trustworthy result. More agents, phases, or generated text are not
measures of quality.

## Human experience principles

### Start useful

The first command should perform safe discovery and explain:

- The repository mode and target path.
- Detected Cratis products, clients, languages, and versions.
- What was deliberately not inferred.
- The recommended agent and workflow for the stated purpose.
- Missing prerequisites, risks, and the exact next action.

No provider login or model selection is required for discovery, preflight, or
explaining a blocked route.

### Progressive disclosure

Default output should answer “what will happen and why?” in one screen.
Evidence, profile traces, schema hashes, policy intersections, and raw
diagnostics remain available through explicit detail levels and machine output.

### Safe choices, reversible control

Approvals name the action, effect, scope, evidence, cost, and reversibility.
“Allow” is never a vague permission. A user can stop, steer, retry, request
correction, inspect evidence, and resume without losing the run’s history.

### Honest uncertainty

Unknown repository mode, incompatible package versions, missing peers,
unavailable gates, or missing specialist agents produce visible blockers. The
Factory must not quietly choose a nearby profile or a generic agent.

### Useful failure

Every failure should identify:

- What failed.
- Whether any side effect occurred.
- The stable diagnostic code and affected phase or artifact.
- The evidence that supports the diagnosis.
- Whether retry, correction, configuration, or human judgment is appropriate.

### Accessibility and portability

Terminal output must remain readable without color and work well with screen
readers. Planner and Studio experiences require keyboard operation, meaningful
focus order, status text independent of color, and links to the same underlying
evidence. The local headless path remains fully capable when no graphical
surface exists.

## Machine and agent experience principles

- Every operation has versioned JSON request and result schemas.
- Compact JSON is deterministic; JSONL streams are ordered and resumable.
- Diagnostics have stable codes, structured locations, severity, and retry
  guidance.
- Commands support non-interactive execution and never prompt when a machine
  format is requested.
- Capability, approval, blocked, failure, and terminal states are explicit
  rather than inferred from exit text.
- Results carry immutable input, profile, policy, agent, workflow, schema, and
  evidence hashes.
- Repeated requests use idempotency keys or immutable request hashes.
- Human and machine projections cite the same identifiers and facts.

## Core journeys and acceptance tests

### Discover and explain

Given a repository and target, resolve the stack without model or network
access. A new Cratis developer should correctly answer what the Factory
selected, what it excluded, and why after reading the default output once.

### Investigate safely

Given a bounded problem, show the immutable revision, classification, permitted
evidence, budget, agent, gates, and approval points before execution. The
accepted result must include inspectable reproduction or diagnostic evidence and
no source changes.

### Deliver one vertical slice

For the golden stack, guide intent and event modeling through backend, generated
proxy barrier, specifications, React/Components behavior, independent review,
and a pull-request proposal. At each phase the user sees current status, next
step, blocking decision, and evidence—not harness conversation noise.

### Resume and understand

After interruption or worker death, reconstruct the same run from durable facts.
Human and machine callers receive the same terminal state, retry eligibility,
and next legal actions.

## Experience gates

Before Stage 1:

- Five developers unfamiliar with the implementation can run discovery and
  correctly explain its selection without assistance.
- Text and compact JSON outputs agree on all material facts in conformance
  tests.
- Every blocked fixture names a concrete next action.
- No discovery or preflight path asks for provider credentials.

Before Stage 2:

- At least 80% of pilot users complete a read-only investigation without
  maintainer intervention.
- Median time to first useful evidence is measured and improves over the current
  manual path.
- Users can locate the objective, active phase, capability scope, cost/usage,
  gates, and evidence in under one minute.
- Corrections preserve context and do not require restarting the investigation.

Before managed expansion:

- Usability sessions cover novice and expert developers, keyboard-only
  operation, failure recovery, and ambiguous profile selection.
- Human correction minutes, abandoned runs, approval comprehension, and trust
  ratings are tracked alongside merge rate, cost, and defects.
- API/MCP consumers pass contract, idempotency, ordering, and compatibility
  suites without relying on display text.

## Review discipline

Every executable slice receives four independent reviews:

1. Architecture: ownership, contracts, determinism, and evolvability.
2. Security and privacy: scopes, credentials, isolation, PII, provider policy,
   and tamper resistance.
3. Engineering: correctness, failure modes, tests, performance, and
   maintainability.
4. Developer experience: discoverability, cognitive load, explanations,
   accessibility, recovery, and usefulness.

A technically green slice can still fail its experience gate. A pleasant
interface can still fail its security or determinism gate. Promotion requires
all four.
