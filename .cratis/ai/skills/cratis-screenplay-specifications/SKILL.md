---
name: cratis-screenplay-specifications
description: Pin behavior in a Cratis Screenplay `.play` model with given/when/then `specification` blocks — prior events and read-model state, the caller, the command or appended event under test, expected events, read-model state, query results, rejections and denials, plus what the reference execution actually runs. Use when writing acceptance criteria for a slice, specifying a rejection or an authorization denial, or deciding whether a rule belongs in a specification or in the type system. Do not use for C# or TypeScript test code.
license: MIT
---

# Screenplay specifications

A `specification` is the acceptance criterion for a slice, written in the same
document as the behavior it pins. Given/when/then, in business language, with
concrete data.

## Locate the model

Look first in `.cratis/screenplay/` at the repository root. This is the
conventional home for consumer-owned `.play` source; do not invent another
location or search the whole repository before checking it.

`cratis ai install` manages `.cratis/ai/`, not `.cratis/screenplay/`. Never
hand-copy Screenplay source between repositories. Keep Markdown that explains,
questions or navigates the model in the repository's documentation; the `.play`
source is the single flow model.

## Verified product sources

| Package | Version | Purpose |
| --- | --- | --- |
| `Cratis.Screenplay` | `4.30.0` | Parser, semantic binder, reference execution |

Checked against the Screenplay repository at tag `v4.30.0` (commit `969b6b7`):
`Documentation/screenplay/{specifications,policies,constraints,readmodels,diagnostics}.md`.
The worked example below compiles with zero diagnostics, binds to ESM v2, and
all six specifications pass the reference runner at that tag. Reverify before
claiming another version behaves the same.

## The vocabulary

| Construct | Meaning |
| --- | --- |
| `given <EventType>` | prior state, established by replaying events before the action |
| `given readmodel <ReadModelType>` | prior read-model state, established directly — a **complete** instance including its identifier |
| `given caller` | the caller: `authenticated`, `role "<r>"`, repeatable `claim "<type>" = "<value>"`; empty means unauthenticated |
| `when <CommandType>` | run a command |
| `when append <EventType>` | append one event: constraints and projections run, the command and reactions do not |
| `then <EventType>` | an expected new event |
| `then events in any order` | compare the new events without regard to order |
| `then readmodel <ReadModelType> [exactly]` | read-model state afterwards — must state the identifier |
| `then query <Query> [exactly]` | query results for explicit `arguments`; one `result` per row; none means empty |
| `then error "<message>"` | a validation or constraint rejection, for that reason |
| `then error` | a validation or constraint rejection, reason unnamed |
| `then denied` | an authorization denial (`Unauthorized`) |
| `for <value>` | the event source of a `given`/`then` event, or of the `when` command or appended event |
| `<property> = <value>` | a literal, `null`, or a one-line JSON-shaped object or list: `lines = [{"sku":"A-1","quantity":2}]` |

Rules the binder enforces:

- **At most one action** — `when` or `when append` (`PLAY0358`). Without an
  action, assert only `then readmodel` or `then query` (`PLAY0352`).
- **`then` contains either events or an error — never both.** A rejection
  specification has exactly one rejection and no success outcome.
- **`then denied` stands alone**: not with events, errors or state assertions
  (`PLAY0388`). For a query, pair it with one `then query` that has `arguments`
  and no `result`.
- **Authorized commands and queries need `given caller`** (`PLAY0389`). The runner
  never invents a caller.
- **`null` only in optional read-model values.** A `null` in a command or event
  value is `PLAY0350`: an optional fact is a separate event.

`PLAY0358` is a syntax error. `PLAY0350`, `PLAY0352`, `PLAY0388`, `PLAY0389` and
the one-rejection rule (`PLAY0273`) are reported only when the model binds, so
`screenplay --warnaserror` does not show them. Check executable diagnostics
(the MCP authoring tools) as well.

## How outcomes are compared

- **Events:** the complete set of new events, in authored order, unless
  `then events in any order` is stated. The count is always exact.
- **Read models and query rows:** only the asserted properties must match
  (subset); add `exactly` to require every property. Row count and order are
  always exact. A missing property does not match an asserted `null`.
- **Rejections:** `then error "<message>"` matches the message whatever the rule's
  validation severity; no form asserts severity. Bare `then error` never matches
  a denial. Quote a localized key: `then error "$strings.invoices.reasonRequired"`.

## Worked example

A command with an authorization gate, a validation rule and a uniqueness
constraint, and a read model fed by its event. The `for` values select ESM v2.

```screenplay
concept InvoiceId : Uuid
concept InvoiceNumber : String
policy IsAccountant
  require role "Accountant"
module Invoicing
  feature Registration
    slice StateChange RegisterInvoice
      command RegisterInvoice
        invoiceId     InvoiceId identifier
        invoiceNumber InvoiceNumber
        authorize IsAccountant
        validate
          invoiceNumber not empty message "Invoice number is required"
        produces InvoiceRegistered
          for invoiceId
          invoiceNumber = invoiceNumber
      event InvoiceRegistered
        invoiceNumber InvoiceNumber
      constraint UniqueInvoiceNumber
        unique invoiceNumber on InvoiceRegistered
      specification RegisteringAnInvoice
        given caller
          authenticated
          role "Accountant"
        when RegisterInvoice
          invoiceId     = "9c858901-8a57-4791-81fe-4c455b099bc9"
          invoiceNumber = "INV-000123"
        then InvoiceRegistered
          for "9c858901-8a57-4791-81fe-4c455b099bc9"
          invoiceNumber = "INV-000123"
        then readmodel InvoiceSummary
          invoiceId     = "9c858901-8a57-4791-81fe-4c455b099bc9"
          invoiceNumber = "INV-000123"
      specification RejectingAnEmptyInvoiceNumber
        given caller
          authenticated
          role "Accountant"
        when RegisterInvoice
          invoiceId     = "9c858901-8a57-4791-81fe-4c455b099bc9"
          invoiceNumber = ""
        then error "Invoice number is required"
      specification RejectingANumberAnotherInvoiceHolds
        given caller
          authenticated
          role "Accountant"
        given InvoiceRegistered
          for "0f5f5f7f-0f6f-4f47-9f39-5c1f2f0a1a9f"
          invoiceNumber = "INV-000123"
        when RegisterInvoice
          invoiceId     = "9c858901-8a57-4791-81fe-4c455b099bc9"
          invoiceNumber = "INV-000123"
        then error
      specification DenyingACallerWithoutTheRole
        given caller
          authenticated
        when RegisterInvoice
          invoiceId     = "9c858901-8a57-4791-81fe-4c455b099bc9"
          invoiceNumber = "INV-000123"
        then denied
      specification ProjectingAnAppendedInvoice
        when append InvoiceRegistered
          for "9c858901-8a57-4791-81fe-4c455b099bc9"
          invoiceNumber = "INV-000123"
        then query InvoiceById
          arguments
            invoiceId = "9c858901-8a57-4791-81fe-4c455b099bc9"
          result
            invoiceNumber = "INV-000123"
    slice StateView InvoiceLookup
      readmodel InvoiceSummary
        invoiceId     InvoiceId
        invoiceNumber InvoiceNumber
      query InvoiceById => InvoiceSummary?
        by invoiceId InvoiceId
      projection InvoiceSummaries => InvoiceSummary
        from InvoiceRegistered
          invoiceId     = $eventSourceId
          invoiceNumber = invoiceNumber
      specification LookingUpAnExistingInvoice
        given readmodel InvoiceSummary
          invoiceId     = "9c858901-8a57-4791-81fe-4c455b099bc9"
          invoiceNumber = "INV-000001"
        then query InvoiceById
          arguments
            invoiceId = "9c858901-8a57-4791-81fe-4c455b099bc9"
          result
            invoiceNumber = "INV-000001"
```

- `RejectingANumberAnotherInvoiceHolds` needs `for`: without it the `given`
  event lands on the command's own event source, and re-claiming your own value
  is not a violation.
- `ProjectingAnAppendedInvoice` exercises the projection without running the
  command. Put `for`-bearing specifications in the slice whose command produces
  the event; placed in the view slice, binding fails with `PLAY0273`.
- `LookingUpAnExistingInvoice` has no action: it checks established state only.

## Rejections and denials say different things

`then error "<message>"` says **rejected, for this reason** — pin it when the
message is the point. Bare `then error` says **rejected, for a reason this
specification does not name**; the reason lives in the specification's name.
`then denied` says **this caller may not do this**, which is decided before any
validation runs. Write the bare form rather than `then error ""`.

**Views cannot reject events.** A projection never refuses an event; there are no
error cases for one. (A `when append` can still be refused by an append-time
constraint — that is the constraint speaking, not the view.)

## Business rule or type system?

Before writing an error specification, apply this test:

1. Does the error depend on **existing system state** — what events occurred?
   → business rule → write the specification.
2. Can the type system make the invalid state unrepresentable?
   → in Screenplay that means a `concept` with its own `validate` block, and the
   rule travels with every use → **not** a specification.
3. Would a different business plausibly have a different rule here?
   → business rule → specification.

**Write specifications for:** *"Cannot cancel an already-paid invoice"*,
*"Cannot withdraw more than the balance"*, *"Maximum 100 lines per invoice"*.

**Do not write specifications for:** *"Invoice number must match INV-000000"*,
*"Name cannot be empty"*, *"Discount must be between 0 and 100"* — those belong on
the concept.

## Application-boundary coverage

Every slice should carry at least one specification whose action is what a real
caller does and whose `then` is observable at that same boundary — produced
events, read-model state, query results, a rejection or a denial. A specification
satisfiable only by an internal function describes a unit, not a slice acceptance
criterion.

## Reference execution — what actually runs

Screenplay's reference runner executes specifications against an immutable
in-memory world: no Arc, no Chronicle, no database, no network. Every downstream
target has one normalized behavior to match.

- It runs what binds: declarative validation and `require` over command
  properties, conditional production, literal tags, declarative policies,
  `unique` constraints, and projections as Chronicle lowers them. The
  `cratis-screenplay-model-authoring` language reference lists what binds.
- A specification that needs **opaque code** — a bodied reducer, a rule with a
  body, a fenced `validate` block, a code policy — returns **unsupported** and
  never passes. Authorization is evaluated first, so a `then denied` case still
  runs when a portable policy decides it. Other specifications in the model run
  normally.
- Unsupported reachable declarative constructs block the whole execution plan
  rather than running partially.
- Reactions never run, not even after `when append`.
- A rejection leaves the world unchanged; an accepted action commits once, then
  the read models and queries are compared.

Unsupported is not passed. Report it as "needs a target", not as green.

## Quality checklist

For every specification:

- [ ] Concrete, realistic values — never "valid user" or "some amount".
- [ ] Tests exactly one behavior, independent of other specifications.
- [ ] Business language matching the event-model vocabulary.

For command specifications:

- [ ] Every `given` event and the `when` command state all required fields.
- [ ] `given caller` is present whenever the command is authorized, with a
      `then denied` case for a caller who must be refused.
- [ ] `then` contains **either** events **or** an error, never both.
- [ ] A collision between two event sources uses `for` on the `given` event.
- [ ] Error cases test business rules, not format validation.

For view specifications:

- [ ] `given readmodel` is a complete instance with its identifier.
- [ ] `then readmodel` states the identifier and the properties that matter; add
      `exactly` only when extra properties must fail the assertion.
- [ ] No error cases — views cannot reject.

## Verify

- [ ] `screenplay <model> --warnaserror` reports zero errors and zero warnings.
- [ ] Executable diagnostics are clean too: `PLAY0350`, `PLAY0352`, `PLAY0388`,
      `PLAY0389` and `PLAY0273` are only reported at binding.
- [ ] Every slice has at least one boundary specification.
- [ ] The rejections and denials are specified, not only the happy path.
- [ ] No `given`/`when`/`then` clause names an element the model does not declare.
- [ ] An unsupported run is reported as unsupported, never as passing.

## Route near misses

- The rules being specified: `cratis-screenplay-command-surface`.
- The projections being asserted on: `cratis-screenplay-projections`.
- Naming and scoping specifications generally: `cratis-specification-by-example`.
- C# specifications for hand-written Cratis code: `cratis-specifications-csharp`.
