---
name: cratis-screenplay-specifications
description: Pin behavior in a Cratis Screenplay `.play` model with given/when/then `specification` blocks — prior events and read-model state, the command under test, expected events, read-model state, query results and rejections, plus what the reference execution actually runs. Use when writing acceptance criteria for a slice, specifying a rejection, or deciding whether a rule belongs in a specification or in the type system. Do not use for C# or TypeScript test code.
license: MIT
---

# Screenplay specifications

A `specification` is the acceptance criterion for a slice, written in the same
document as the behavior it pins. Given/when/then, in business language, with
concrete data.

## Verified product sources

| Package | Version | Purpose |
| --- | --- | --- |
| `Cratis.Screenplay` | `4.12.1` | Parser, semantic binder, reference execution |

Read from the Screenplay repository at tag `v4.12.1` (commit `122eee8`), against
`Documentation/screenplay/specifications.md` and
`Source/DotNET/Screenplay/Parsing/SpecificationParser.cs`. Reverify before
claiming another version behaves the same.

## The vocabulary

| Construct | Meaning |
| --- | --- |
| `given <EventType>` | prior state, established by replaying events before the command runs |
| `given readmodel <ReadModelType>` | prior read-model state, established directly |
| `when <CommandType>` | the command under test — **at most one**; a second is a compile error |
| `then <EventType>` | an event expected to be produced |
| `then readmodel <ReadModelType>` | the read-model state expected afterwards |
| `then query <Query>` | ordered query results for explicit arguments |
| `arguments` | the values supplied to the query |
| `result` | one expected query result; repeat for many |
| `then error "<message>"` | a rejection, for the named reason |
| `then error` | a rejection, for a reason this specification does not name |
| `<property> = <value>` | a property value, using the `produces` expression grammar |

`given`, `then`, `then readmodel`, `then query` and `then error` are each zero or
more.

## Command specifications

```screenplay
specification RegisteringADraftInvoice
  given CustomerRegistered
    customerId = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    name       = "Acme Corp"
  when RegisterInvoice
    invoiceId     = "9c858901-8a57-4791-81fe-4c455b099bc9"
    customerId    = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    invoiceNumber = "INV-000123"
  then InvoiceRegistered
    invoiceId     = "9c858901-8a57-4791-81fe-4c455b099bc9"
    invoiceNumber = "INV-000123"
```

**`then` contains either events or an error — never both.**

## Rejections — two forms, and they say different things

```screenplay
specification RejectingAnInvoiceWithNoLines
  when RegisterInvoice
    invoiceId = "9c858901-8a57-4791-81fe-4c455b099bc9"
  then error "An invoice must have at least one line"
```

`then error "<message>"` says **rejected, for this reason** — pinning a constraint
violation or a validation message down deliberately.

```screenplay
specification RejectingAnInvoiceWhoseNumberIsAlreadyTaken
  given InvoiceRegistered
    invoiceNumber = "INV-000123"
  when RegisterInvoice
    invoiceNumber = "INV-000123"
  then error
```

Bare `then error` says **rejected, for a reason this specification does not name**.
Most specifications are this kind — the reason lives in the specification's name.

## View specifications

```screenplay
specification SendingADraftInvoice
  given readmodel InvoiceListReadModel
    invoiceId = "9c858901-8a57-4791-81fe-4c455b099bc9"
    status    = "draft"
  when ChangeInvoiceStatus
    status = "sent"
  then readmodel InvoiceListReadModel
    status = "sent"
```

**Views cannot reject events.** There are no error cases for a projection.

## Query specifications

```screenplay
specification LookingUpARegisteredProject
  when RegisterProject
    projectId = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    name      = "Screenplay"
  then query ProjectById
    arguments
      projectId = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    result
      projectId = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
      name      = "Screenplay"
```

Results are compared **in order**. `then query` with no `result` block asserts the
query returns nothing.

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

Every slice should carry at least one specification whose `when` is the command a
real caller issues and whose `then` is observable at that same boundary — produced
events, read-model state, or query results. A specification satisfiable only by an
internal function describes a unit, not a slice acceptance criterion.

## Reference execution — what actually runs

Screenplay supplies a framework-neutral reference path: no Arc, no Chronicle, no
database, no filesystem, no network. It executes against an immutable in-memory
world so every downstream target has one normalized behavior to match.

> The minimum evaluator currently admits the RegisterProject-style vertical:
> `not empty` validation, unconditional event production, one affected read-model
> instance, optional snapshot lookup, and exact ordered specification results.
> Unsupported reachable capabilities **block plan creation** rather than producing
> a partial or stubbed execution.

A rejected execution returns the unchanged world. An accepted one commits its
facts and projected state once, then evaluates the requested queries against that
state.

⚠️ **`for <event-source-value>` is reserved for ESM v2.** The parser, printer and
syntax tree preserve it, but ESM v1 binding reports blocking diagnostic
`PLAY0268`. It cannot execute or render silently. Avoid it in a model that must
run today.

## Quality checklist

For every specification:

- [ ] Concrete, realistic values — never "valid user" or "some amount".
- [ ] Tests exactly one behavior, independent of other specifications.
- [ ] Business language matching the event-model vocabulary.

For command specifications:

- [ ] `given` contains only events, each with all its fields.
- [ ] `when` contains exactly one command with all its inputs.
- [ ] `then` contains **either** events **or** an error, never both.
- [ ] Error cases test business rules, not format validation.

For view specifications:

- [ ] `given readmodel` is the complete state before.
- [ ] `then readmodel` is the complete state after.
- [ ] No error cases — views cannot reject.

## Verify

- [ ] `screenplay <model> --warnaserror` reports zero errors and zero warnings.
- [ ] Every slice has at least one boundary specification.
- [ ] The rejections are specified, not only the happy path.
- [ ] No `given`/`when`/`then` clause names an element the model does not declare.
- [ ] No `for <event-source-value>` in a model that must reach a runtime.

## Route near misses

- The rules being specified: `cratis-screenplay-command-surface`.
- The projections being asserted on: `cratis-screenplay-projections`.
- Naming and scoping specifications generally: `cratis-specification-by-example`.
- C# specifications for hand-written Cratis code: `cratis-specifications-csharp`.
