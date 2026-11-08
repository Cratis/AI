# Synthesis rules

How black-box signals become candidate Screenplay elements. Signals are hypotheses: each result
is a proposal with evidence ids, decided later by a person. The translation rules for code
signals (tests, generic engines, reference data, ordering) are in
`../../cratis-screenplay-legacy-extraction/references/signal-to-intent.md`; do not repeat them.

## Contents

- Signal to element
- Naming
- Writing through MCP
- Specifications
- Slices and flows
- Stop conditions

## Signal to element

| Signal | Candidate | Notes |
|---|---|---|
| Observed form submit, or a mutating request (`POST`, `PUT`, `PATCH`, `DELETE`) | a command and a past-tense event | name the business decision, not the verb; one command per decision a person makes |
| Several requests from one user action | one command; the others are reads or consequences | keep the order seen in the capture |
| What a screen lists or shows | a read model and a query | built for the screen, not mirrored from tables; each displayed value traces to a command input, a query result or a derivation, else `unknown` |
| Filters, sorting, search boxes | query parameters on that query | |
| Before and after state pairs | specifications | given the state before, when the command, then the event and the view after |
| Rejection or validation message | a refusal rule on the command, with the exact text kept | one specification per observed refusal |
| Denied or hidden for a role | `authorize` plus a denied specification | only when two roles were observed; otherwise `unknown` |
| Navigation and journeys | slices and flows | a journey groups slices; a page is not a slice boundary |
| An email, file or call to another system seen after a command | a reaction or translation | only with an evidenced trigger; see `cratis-screenplay-automations-and-translations` |
| Server-sent state change without a user action | an automation candidate | usually `unknown` until the trigger is evidenced |

## Naming

- Events are past-tense business facts. A CRUD mirror (`CustomerUpdated`, `OrderSaved`,
  `RecordChanged`) hides intent. Split by intent: what did the person decide? When the
  evidence shows only that fields changed, propose the most likely intents as separate
  candidates, mark each `Inferred`, and ask.
- Use the visible labels and document terms as the business vocabulary; one name per concept.
- Commands name the decision (`ReserveBerth`), not the endpoint (`PostReservation`).
- Strongly typed identities and values come from the field names and shapes in the evidence
  (`cratis-screenplay-command-surface`); do not use raw strings and numbers for domain values.

## Writing through MCP

All writes use the Screenplay MCP server of `cratis-screenplay-model-authoring`: pick the
`propose-*` tool for the edit, read the proposal (`read-proposal`) for its diagnostics and
before/after, run `run-specifications` with the proposal id, then `apply` the reviewed
proposal. The contract and the refusal handling belong to that skill; this skill adds only:

- One slice per loop, so a refusal names one cause.
- A diagnostic is a finding. Fix the model or record the gap; never edit the file by hand to get
  past it, and never weaken protection to make it compile.
- Notes: record each open unknown as an anchored `question` note, and the evidence ids in the
  slice `description`.

## Specifications

- A specification needs both sides seen: the state before and the state after. One side alone is
  an `unknown`, not a specification.
- Use observed values for given and expected data; replace personal data with fixtures.
- A UI success proves a state change was shown. It does not prove uniqueness, idempotency or
  atomicity: those stay `unknown` until a capture or a person confirms them.
- For which scenarios a slice needs (refusals, retries, races, removal), use
  `cratis-screenplay-scenario-coverage`.

## Slices and flows

- Group evidence by the journey observed, then split at decisions: one slice per decision or per
  view. Three to twelve states per flow is typical.
- A read model is shaped by the screens that use it. Where two screens need conflicting shapes,
  make two read models.
- Where the capture shows ordering (create, then list, then edit), keep it as the flow, and
  state which ordering is observed and which is assumed.

## Stop conditions

Stop and ask rather than synthesize when:

- an element would rest on a single `Inferred` row with no corroboration, and it carries a rule,
  authorization or money;
- two sources conflict and the difference changes behavior;
- the model would need protection (`pii`, `secret`, authorization) that the evidence does not
  show: model it as an open question, never silently drop it.
