---
name: cratis-screenplay-command-surface
description: Write the write side of a Cratis Screenplay `.play` model — the `command` block and its `identifier`, `reads`, `validate`, `authorize`, `produces`, `handler` and `concurrency` clauses, plus `event`, `constraint`, `policy`, `persona`, `concept`, `type` and `seed`. Use when declaring or changing a command, an event shape, a validation or authorization rule, an append-time constraint, or a strongly-typed value in Screenplay. Do not use for projections, queries, screens, captures or reactions.
license: MIT
---

# The Screenplay write surface

Everything that changes the system: the `command` that expresses intent, the
`event` it appends, the rules that can refuse it, and the strongly-typed values
they are all built from.

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
| `Cratis.Screenplay` | `4.31.0` | Parser, validator, diagnostics, semantic binder |

Checked against the Screenplay repository at tag `v4.31.0` (commit `355dffb`):
`Documentation/screenplay/{commands,constraints,policies,context,concepts,diagnostics}.md`
and decisions 0001 and 0003. Every example below compiles with that version's
compiler. Reverify before claiming another version behaves the same.

"Parses" and "runs" are different claims. The executable profile, and what
each construct binds to, is in the `cratis-screenplay-model-authoring` language
reference.

## The command block

Excerpt: the concepts, the `InvoiceLine` type, the policy and the event are
declared elsewhere in the model.

```screenplay
command RegisterInvoice
  description "Registers a new invoice with its lines and payment terms"
  invoiceId      InvoiceId identifier
  invoiceNumber  InvoiceNumber
  lines          InvoiceLine[]
  note           String?
  authorize CanManageInvoice
  validate
    invoiceNumber not empty                 message "Invoice number is required"
    invoiceNumber matches "^INV-[0-9]{6}$"  severity warning message "Must look like INV-000000"
  produces InvoiceRegistered
    invoiceId    = invoiceId
    registeredAt = $context.occurred
```

Type modifiers: `<Type>[]` for a collection, `<Type>?` for optional.

⚠️ **The parser enforces no clause order.** The house order is description,
properties, `reads`, `authorize`, `validate`, `produces`/`handler`, `concurrency`.
Keep to it.

⚠️ **`produces` and `handler` are mutually exclusive** — declaring both is an
error. Everything else may repeat except `description` (one) and `concurrency`
(one). A `handler` parses but does not bind to the executable model yet
(`PLAY0268`); prefer `produces` when the model must run.

## `identifier` — the stream boundary decision

At most one command property may carry `identifier`. It names the value the
runtime uses as the event source id, so **choosing it is choosing the stream
boundary** — the highest-consequence decision in the slice. Leave it out only
when the runtime should allocate a fresh `Uuid` (a command that creates
something whose identity the caller does not supply).

- A second `identifier` on the same command is an error: *only one property can be
  the identifier*.
- `identifier` on an **event** property is an error: *an event never carries its
  event source id*. It travels in the event context.

## `reads` — state the command decides against

Excerpt: the `Account` read model, its projection and its keyed query are
declared elsewhere.

```screenplay
command TransferFunds
  sourceId      AccountId
  destinationId AccountId
  amount        Decimal
  reads Account as source by sourceId
  reads Account as destination by destinationId
  validate
    require source.balance >= amount
      message "The source account does not cover the transfer"
```

`by <property>` names the command property the read model is looked up by.
`as <alias>` names one read: a command that reads a view more than once needs an
alias on **every** read (`PLAY0410`), aliases are unique (`PLAY0411`) and must not
match a command property (`PLAY0412`). A `require` path uses the alias, or the
view name when that view is read once.

⚠️ **`reads` is not a protected read.** It documents the read-model-to-command
arrow of the event model; nothing checks at append time that the state is still
current. The executable model rejects every `reads` and `concurrency` with
`PLAY0271`, and `require` over a read-model path with `PLAY0268`, until
decision-consistent reads exist (Screenplay #129, decision 0003). Adding a
`concurrency` block does not fix this: its scope is not the read's watermark, and
decision 0003 plans to make the combination an error once protected reads ship.
When a rule depends on state:

- if it is uniqueness, declare a `unique` constraint (below);
- otherwise state the rule, and say in review that the target implementation
  must enforce it consistently. Do not claim the model guarantees it.

Do not use `reads` to fetch data the caller could supply.

## `validate`

Each rule takes an optional `severity information|warning|error` and then an
optional `message "<text>"` (or `$strings.<key>`). The default severity is `error`.

| Rule | Example |
| --- | --- |
| `not empty` | `name not empty` |
| `max <n>` / `min <n>` | `reason max 500` (length on text), `quantity min 1` (value on numbers) |
| `> <v>` / `>= <v>` / `< <v>` / `<= <v>` | `quantity > 0`, `discountPct <= 100` |
| `== <v>` / `!= <v>` | `currency == "NOK"`, `status != draft` |
| `length == <n>` | `currency length == 3` |
| `matches email` | the only named pattern; any other name is `PLAY0366` |
| `matches "<regex>"` | ECMAScript; matches **any substring** unless anchored with `^…$`; an invalid pattern is `PLAY0367` |
| `all > <v>` / `all >= <v>` | `lines.quantity all > 0` |
| `rule <Name>` | `orgNumber rule BeAValidOrganizationNumber` |

⚠️ **Validation severity is not compiler severity.** Every failed rule and
`require` rejects the command, at `information` and `warning` too; severity only
tells the UI how to present the failure.

**Whole-command rules** use `require <condition>` with an indented `message` and
optional `severity`, sharing the condition grammar with `produces … when`:
`and` binds tighter than `or`, parentheses group. A conditional rule is an
implication: `require isExtension == false or newEndDate > endDate`.

**Rules whose logic is code.** A bare `rule <Name>` records that a rule exists but
has no portable meaning (`PLAY0268`). Give it a body when the logic can live in the
model — a `file` or a tagged ` ```csharp ` fence indented under the rule, or a
fenced `validate` block for cross-field rules. Excerpt, inside a command:

```screenplay
validate
  orgNumber rule BeAValidOrganizationNumber message "Must be a valid organization number"
    file Validations/BeAValidOrganizationNumber.cs
```

A bodied rule or fenced block binds as opaque code (ESM v3): the reference runner
reports it unsupported, and a target must supply the implementation. Prefer a
declarative rule when one can say it.

**Put format rules on the `concept`, not the command.** A concept carries its own
`validate` block and every use inherits it — that is Screenplay's type system, and
a rule that travels is worth more than one that is repeated.

## `authorize`

Excerpt: the policies are declared at the top of the model.

```screenplay
authorize IsAccountant
          or IsCustomerSelf

authorize (IsAccountant or IsFinance) and OwnsInvoice
```

Policy names are PascalCase. `and` binds tighter than `or`; parentheses group.
A continuation line extends the clause.

⚠️ **Two adjacent policies synthesize an implicit `and`.** `authorize A B` means
`A and B`. Write the operator explicitly so the reader does not have to know this.

- Several `authorize` lines on one command or query combine with AND, in authored
  order. (Before v4.29.0 all but the last were silently dropped.)
- `authorize` on an enclosing `module` or `feature` is ANDed with the command's
  own gate; an `or` inside one gate never bypasses another gate.
- Evaluation short-circuits left to right, module → feature → command. If it
  reaches a policy implemented in code, the reference runner reports the outcome
  unsupported; it never guesses allow or deny.

## `produces`

- **Mapping sources** that bind to the executable model: a command property
  (`= invoiceNumber`), a literal (`= "draft"`, `= 0`), `$context.occurred`, and
  the caller's audit identity (`$context.identity.id`/`.name`/`.userName`, the
  same values as `$context.causedBy.*`). The last two select ESM v2.
  `$context.tenant`, claims, roles, causation, `$env.` values, templates and
  computed expressions parse but block binding (`PLAY0268`).
- **`for <identifier>`** on an indented line names the event source the event is
  appended to. At most one per `produces`. To bind, it must name the command's
  `identifier` property (`PLAY0273` otherwise); fanning out to another event
  source parses but does not run today.
- **`tag`** lines apply literal tags to this append. Tags also exist on the
  `event` declaration, where they apply to every append of that type.
- **Several unconditional `produces` blocks** are allowed — that is co-production,
  and it is what an automation is *not*.
- **`produces when <condition>`** takes the event name on the next indented line.
  Conditions over command properties and constants bind; each is evaluated
  independently, and when all are false the command is accepted with no events.
  Excerpt:

```screenplay
produces when isProForma == true
  ProFormaInvoiceIssued
    invoiceId = invoiceId
```

## `concurrency`

Five dimensions, each at most once, and at most one `concurrency` block per
command. It mirrors Chronicle's `ConcurrencyScope` for a target implementation;
the executable model does not bind it (`PLAY0271`), and it does not protect a
`reads` decision.

| Dimension | Scopes the check to |
| --- | --- |
| `eventSource` | the command's own event source id |
| `sourceType <Name>` | an event source type |
| `streamType <Name>` | an event stream type |
| `streamId <Name>` | an event stream id |
| `events <A>, <B>` | the listed event types |

An empty block or an unknown dimension is an error.

## `constraint` — uniqueness at append time

Chronicle's constraints enforce **uniqueness only**. Excerpt: the events are
declared in the same model.

```screenplay
constraint UniqueInvoiceNumber
  unique invoiceNumber on InvoiceRegistered
  released by InvoiceCancelled
  ignore casing
  message "That invoice number is already in use"

constraint OneRegistrationPerInvoice
  unique event InvoiceRegistered
```

- `unique <p>[, <p>…] on <Event>` — a value (or composite value, in order) held by
  one event source is unavailable to every other. Repeat the line for other
  events sharing the claim. The same event source may re-claim its own value; a
  null value claims nothing. The property must be declared directly on the event
  (`PLAY0391`).
- `unique event <Event>` — the event occurs at most once per event source.
- `released by <Event>` (repeatable) frees the claim; `ignore casing` applies to
  property rules only (`PLAY0393`); `message` replaces the default violation text —
  never put the colliding value in it.
- **The name is the identity.** It is unique across the application (`PLAY0392`),
  and renaming a constraint starts a new, empty index.
- Chronicle updates the uniqueness index after the append commits; do not describe
  it as an atomic index-and-append guarantee.

⚠️ **Do not use `constraint … file <Path>` for other rules.** It can only name a
hand-written Chronicle `IConstraint`, which can only declare uniqueness; it warns
(`PLAY0396`) and the executable model rejects it. A state transition rule
belongs in `validate`/`require`. Use a constraint when two concurrent appends must
not both win — a `validate` rule cannot do that.

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
inherited** — a property typed with a `@pii` concept is PII everywhere. The
executable model does not bind compliance attributes yet (`PLAY0268`); keep them,
because the classification is the point.

⚠️ **Enum trap.** A value literally named `validate` is read as an empty validate
block. Write `@validate` for the value; the compiler warns when it sees the
ambiguity.

Use `type <Name>` for a composite shape (several properties) that events and
commands reference; use `concept` for a single wrapped primitive.

## `policy` and `persona`

```screenplay
policy IsAuthenticated
  require authenticated
policy IsAccountant
  require role "Accountant"
policy CanManageInvoice
  require role "InvoiceManager"
    or role "Accountant"
policy OwnsInvoice
  require claim "sub" matches subject
policy IsAdultCustomer
  file Policies/IsAdultCustomer.cs

persona Accountant
  description "Handles invoicing and collections"
  policy IsAccountant
```

Three condition forms: `authenticated`, `role "<name>"`, and
`claim "<name>" matches subject | "<value>" | <path>`. A policy has **exactly one**
`require` line — continue the condition on deeper-indented lines instead of adding
a second (`PLAY0441`) — **or** one implementation (a tagged ` ```csharp ` block or
`file`), never both (`PLAY0440`). Declarative policies run in the reference
runner; a code policy binds as opaque ESM v3 and needs a target to evaluate it.
A `persona` is documentation for people; it blocks executable binding
(`PLAY0268`).

## `seed`

Excerpt: `CustomerRegistered` is declared in a slice.

```screenplay
seed
  for "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    CustomerRegistered
      name = "Acme Corp"
```

Events append to that event source in declaration order, using the same mapping
expression grammar as `produces`. Several `seed` blocks accumulate. Seeding is
operational metadata, not part of executable behavior (`PLAY0270`).

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
- [ ] At most one command property carries `identifier`, and no event property does.
- [ ] Format rules live on the `concept`; state-dependent rules are specifications.
- [ ] Every `authorize` combining policies writes `and`/`or` explicitly.
- [ ] No `reads` or `concurrency` is described as protecting a decision; the gap
      is stated.
- [ ] Constraints are `unique` forms; no `file` constraint stands in for another rule.
- [ ] Each policy has one `require` or one implementation, not both.
- [ ] Personal data is `@pii` on the concept, with a reason.
- [ ] No event carries an optional property covering two situations.

## Route near misses

- Deciding *which* commands and events exist: `cratis-screenplay-event-modeling`.
- Building read models from these events: `cratis-screenplay-projections`.
- Pinning the rejections and denials: `cratis-screenplay-specifications`.
- The parsed/bound/executed boundary: `cratis-screenplay-model-authoring`.
