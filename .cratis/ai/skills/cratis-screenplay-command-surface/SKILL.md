---
name: cratis-screenplay-command-surface
description: Write the write side of a Cratis Screenplay `.play` model — the `command` block and its `identifier`, `reads`, `validate`, `authorize`, `produces`, `handler` and `concurrency` clauses, plus `event`, `constraint`, `policy`, `persona`, `concept`, `type` and `seed`. Use when declaring or changing a command, an event shape, a validation or authorization rule, an append-time constraint, or a strongly-typed value in Screenplay. Do not use for projections, queries, screens, captures or reactions.
license: MIT
---

# The Screenplay write surface

Everything that changes the system: the `command` that expresses intent, the
`event` it appends, the rules that can refuse it, and the strongly-typed values
they are all built from.

## Verified product sources

| Package | Version | Purpose |
| --- | --- | --- |
| `Cratis.Screenplay` | `4.12.1` | Parser, validator, diagnostics |

Read from the Screenplay repository at tag `v4.12.1` (commit `122eee8`), against
both the documentation and `Source/DotNET/Screenplay/Parsing/`. Reverify before
claiming another version behaves the same.

## The command block

```screenplay
command RegisterInvoice
  description "Registers a new invoice with its lines and payment terms"
  invoiceId      InvoiceId identifier
  invoiceNumber  InvoiceNumber
  lines          InvoiceLine[]
  note           String?
  reads InvoiceList by invoiceNumber
  authorize CanManageInvoice
  validate
    invoiceNumber not empty                 message "Invoice number is required"
    invoiceNumber matches "^INV-[0-9]{6}$"  message "Must look like INV-000000"
  produces InvoiceRegistered
    invoiceId    = invoiceId
    registeredAt = $context.occurred
  concurrency
    eventSource
    events InvoiceRegistered, InvoiceCancelled
```

Type modifiers: `<Type>[]` for a collection, `<Type>?` for optional.

⚠️ **The parser enforces no clause order.** The order above is the house
convention and the order a reader expects; the compiler accepts any. Keep to it.

⚠️ **`produces` and `handler` are mutually exclusive** — declaring both is an
error. Everything else may repeat except `description` (one) and `concurrency`
(one).

## `identifier` — the stream boundary decision

Exactly one command property may carry `identifier`. It names the value the
runtime resolves the event source id from, so **choosing it is choosing the stream
boundary** — the highest-consequence decision in the slice.

- A second `identifier` on the same command is an error: *only one property can be
  the identifier*.
- `identifier` on an **event** property is an error: *an event never carries its
  event source id*. It travels in the event context.

## `reads` — state the command decides against

```screenplay
reads InvoiceList by invoiceNumber
```

`by <property>` names the command property the read model is looked up by; it is
optional. A command may read several read models, but **each one only once** —
a duplicate is an error.

This is a deliberate Cratis divergence from generic Event Modeling, which forbids
read-model-to-command edges. Use it for a genuine consistency boundary, and pair
it with `concurrency` so the decision is enforced at append time rather than
merely consulted. Do not use it to fetch data the caller could supply.

## `validate` — the complete rule vocabulary

Fourteen rule kinds (`ValidationRuleKind`), each taking an optional
`message "<text>"`:

| Rule | Example |
| --- | --- |
| `not empty` | `name not empty` |
| `max <n>` / `min <n>` | `reason max 500`, `quantity min 1` |
| `> <v>` / `>= <v>` / `< <v>` / `<= <v>` | `quantity > 0`, `discountPct <= 100` |
| `== <v>` / `!= <v>` | `currency == "NOK"`, `status != "draft"` |
| `length == <n>` | `currency length == 3` |
| `matches <regex>` | `invoiceNumber matches "^INV-[0-9]{6}$"` |
| `all > <v>` / `all >= <v>` | `lines.quantity all > 0` |
| `rule <Name>` | `orgNumber rule BeAValidOrganizationNumber` |

`matches` accepts either a named pattern (`email matches email`) or a quoted
regex, which is why the reference lists it on two rows while the parser has one
kind for it.

A `rule <Name>` may carry an indented `file <path>` or an inline code block as its
body. A rule with no body is a complete statement that the rule exists.

**Whole-command rules** use `require <condition>` with an optional indented
`message`, sharing the condition grammar with `produces … when` and `where`.

**Put format rules on the `concept`, not the command.** A concept carries its own
`validate` block and every use inherits it — that is Screenplay's type system, and
a rule that travels is worth more than one that is repeated.

## `authorize`

```screenplay
authorize IsAccountant
          or IsCustomerSelf

authorize (IsAccountant or IsFinance) and OwnsInvoice
```

Policy names are PascalCase. `and` binds tighter than `or`; parentheses group.
A continuation line extends the clause.

⚠️ **Two adjacent policies synthesize an implicit `and`.** `authorize A B` means
`A and B`. Write the operator explicitly so the reader does not have to know this.

## `produces`

Every mapping source form: a command property (`= invoiceNumber`), a context value
(`= $context.occurred`, `= $context.identity.id`, `= $context.identity.claims.x`,
`= $context.causedBy.subject`, `= $context.causation.type`, `= $context.tenant`),
an environment variable (`= $env.REGION`), a literal (`= "draft"`, `= 0`), or a
template (`` = `${firstName} ${lastName}` ``).

- **`for <expression>`** says which event source the event lands on. **At most one
  per `produces`** — *an event is appended to one event source*.
- **`tag`** lines apply tags to this append. Tags also exist on the `event`
  declaration, where they apply to every append of that type.
- **Several unconditional `produces` blocks** are allowed — that is co-production,
  and it is what an automation is *not*.
- **`produces when <condition>`** takes the event name on the next indented line:

```screenplay
produces when isProForma == true
  ProFormaInvoiceIssued
    invoiceId = invoiceId
```

## `concurrency`

Five dimensions, each at most once, and at most one `concurrency` block per
command:

| Dimension | Scopes the check to |
| --- | --- |
| `eventSource` | the command's own event source id |
| `sourceType <Name>` | an event source type |
| `streamType <Name>` | an event stream type |
| `streamId <Name>` | an event stream id |
| `events <A>, <B>` | the listed event types |

An unknown dimension is an error naming all five.

## `constraint` — append-time invariants

Exactly one of three forms per constraint:

```screenplay
constraint UniqueInvoiceNumber
  unique invoiceNumber on InvoiceRegistered

constraint OneRegistrationPerInvoice
  unique event InvoiceRegistered

constraint InvoiceStatusTransition
  file Constraints/InvoiceStatusTransition.cs
```

A constraint with no body is an error naming the three forms. Use a constraint
when two concurrent appends must not both win — a `validate` rule cannot do that.

## `concept` and `type`

```screenplay
concept InvoiceId : Uuid
concept DiscountPercentage : Decimal
  validate
    >= 0    message "A discount cannot be negative"
    <= 100  message "A discount cannot exceed 100 percent"
concept PersonName : String @pii
  pii reason "Billing contact name; lawful basis: contract performance."
concept InvoiceStatus : Enum
  draft
  sent
  paid
```

The seven primitives are `Uuid`, `String`, `Int`, `Decimal`, `Bool`, `Date` and
`DateTime`. `Enum` is **not** one of them — it is a separate concept kind, which
is why the compiler says *expected … or Enum* rather than listing it among them.
Attributes `@pii` and `@sensitive`, each with at most one `reason`; a
reason for an attribute the concept does not declare is an error. **Compliance is
inherited** — a property typed with a `@pii` concept is PII everywhere.

⚠️ **Enum trap.** A value literally named `validate` is read as an empty validate
block. Write `@validate` for the value; the compiler warns when it sees the
ambiguity.

Use `type <Name>` for a composite shape (several properties) that events and
commands reference; use `concept` for a single wrapped primitive.

## `policy` and `persona`

```screenplay
policy IsAuthenticated
  require authenticated
policy CanManageInvoice
  require role "InvoiceManager"
    or role "Accountant"
policy OwnsInvoice
  require claim "sub" matches subject

persona Accountant
  description "Handles invoicing and collections"
  policy IsAccountant
```

Three condition forms: `authenticated`, `role "<name>"`, and
`claim "<name>" matches subject | <value>`. A policy must declare a `require`
condition or an inline code block.

## `seed`

```screenplay
seed
  for "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    CustomerRegistered
      name = "Acme Corp"
```

Events append to that event source in declaration order, using the same mapping
expression grammar as `produces`. Several `seed` blocks accumulate.

## `$context`

Four contexts, and **what each omits is load-bearing** — read
[context.md](references/context.md) for the full member lists, the declarative
`$context.` paths, and `$causedBy` / `$env` / `$strings`.

| Context | For | Deliberately omits |
| --- | --- | --- |
| Command | a command handler | — |
| Query | a query performer | — |
| Rule | a validation rule | **`Identity`** — validation does not see roles or claims |
| Policy | an authorization policy | **`CausedBy`, `Causation`** |

## Verify

- [ ] `screenplay <model> --warnaserror` reports zero errors and zero warnings.
- [ ] Exactly one command property carries `identifier`, and no event property does.
- [ ] Format rules live on the `concept`; state-dependent rules are specifications.
- [ ] Every `authorize` combining policies writes `and`/`or` explicitly.
- [ ] Any `reads` that decides a rule is paired with a `concurrency` block.
- [ ] Personal data is `@pii` on the concept, with a reason.
- [ ] No event carries an optional property covering two situations.

## Route near misses

- Deciding *which* commands and events exist: `cratis-screenplay-event-modeling`.
- Building read models from these events: `cratis-screenplay-projections`.
- Pinning the rejections: `cratis-screenplay-specifications`.
- The admitted-versus-parsed boundary: `cratis-screenplay-model-authoring`.
