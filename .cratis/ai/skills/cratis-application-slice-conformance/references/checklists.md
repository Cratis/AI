# Final checklists

Reconcile in both directions with each list. Moved here from the render workflow; it gives
the renderer no right to browse managed output or implement rejected semantics.

## Contract reconciliation
- Every modeled command field, event and payload field, rule, authorization gate, projection
  dependency, query behaviour and specification has a realization.
- Every business field, default, rule, filter or outcome in code has contract authority;
  otherwise stop and ask. Framework metadata is infrastructure and must not change the domain
  contract.
- Unrelated contracts stay as they were.
- Descriptions explain intent; they do not license contradictions or undocumented defaults.

## State Change
- Keep event-source identity and production destinations; add no duplicate identity payload
  unless the model needs it.
- Derive decision state from authoritative facts, no larger than the rules need; replay and
  decisions are deterministic and free of external effects.
- Name where each invariant is enforced atomically, including claims spanning sources. A stale
  view or a caller-supplied status is not enforcement; a state-dependent rule the model marks
  not enforced today needs a protected read or concurrency scope in code (where each rule
  belongs: `rules/vertical-slices.md`, "The decision matrix").
- Keep validation messages; separate validation rejection from authorization denial.
- Test the specified repeat behaviour: once-only occurrence, rejected retry, idempotent
  success and external-effect delivery are different guarantees.
- Verify command registration, transport mapping and inherited authorization against
  repository conventions, not a copied route template.
- No business rule in code that the contract does not state.

## State View
- Keep field types, precision, optionality, identity and key selection; add no
  processing-time values or business defaults absent from the model.
- Every read-model property has a source, and the subscribed events equal the modeled
  events; do not subscribe to every nearby event. Honour the actual sources, joins, removals
  and auto-mapping.
- Keep population, later updates and removal; a partial update leaves other fields unchanged.
- Verify query cardinality, filters, caller scope and authorization; do not turn a list into
  a keyed lookup or the reverse.
- Verify registration and event consumption in the target runtime, and replay or rebuild
  behaviour; state any consistency limitation.

## Automation and Translation
- Each field of the produced command or event maps from the trigger event, an injected read
  model or a contract mapping, and from nothing else.
- No filter condition the contract does not state.
- The repeated-delivery behaviour in the contract has a specification: what happens when the
  trigger arrives twice.
- Outside calls follow `cratis-engineering-effect-boundaries`; the reaction side is
  `cratis-chronicle-reactor`.

## Chronicle runtime guarantees
Follow the owning corpus skill. Verify the actual namespace, subject, constraint scope,
guarded-read admission, migrations and replay. A passing generated specification suite proves
none of these. Unsupported semantics remain gap-fill scope, never hidden customizations.

## Evidence
- Map every accepted specification to its executed test or test family (name and qualified
  address kept; splitting is fine if all assertions survive).
- Passing all existing tests cannot show that missing denial, competing-claim, branch or
  removal cases are covered; check applicability upstream with `cratis-screenplay-scenario-coverage`.
- Use isolated fixture state; tests never depend on another test's writes.
- For storage, transaction, registration or migration claims, use the repository's integration
  route with real configuration. Report runner, configuration and per-specification outcomes
  apart from integration results; skipped and unexecuted cases stay visible.
- Record deliberate divergences and their approval; never call them equivalent behaviour.
