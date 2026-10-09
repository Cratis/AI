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

Look first for the project's existing `.play` files: the folder holding them is the
model. A new model goes under the repository's `Source/` or `src/` folder, else in a
`Screenplay/` folder at the repository root; never under `.cratis/`, which holds
configuration and the shared AI corpus only. This is the
conventional home for consumer-owned `.play` source; do not invent another
location or search the whole repository before checking it.

`cratis ai install` manages `.cratis/ai/`, never model files. Never
hand-copy Screenplay source between repositories. Keep Markdown that explains,
questions or navigates the model in the repository's documentation; the `.play`
source is the single flow model.

## Verified product sources

| Package | Version | Purpose |
| --- | --- | --- |
| `Cratis.Screenplay` | `4.31.0` | Original examples and executable boundaries |
| `Cratis.Screenplay` | main `fd18129` | Inline events, repairs and canonical `optional`; changed examples compiled |
| `Cratis.Screenplay` | `4.66.0` (`c89198b`) | Binding behaviour of `handler`, code attachments, `persona` and compliance attributes: `Semantics/SemanticModelBinder*.cs`, `Diagnostics/DiagnosticCodes.cs` |
| `Cratis.Screenplay` | `4.68.0` (`79801bf`) | Current pin: generated values and responses (ESM v7): decisions 0025 and 0026, `commands.md`, `Semantics/Versions.cs`, `SemanticModelBinder.CommandProductions.cs` |

The update follows `commands.md`, `events.md`, `types.md`, `diagnostics.md`,
`mcp/authoring-tools.md` and decision 0023 at that main commit (after v4.52.0).
Compilation checks syntax and model consistency, not reference execution.

Checked against the Screenplay repository at tag `v4.31.0` (commit `355dffb`):
`Documentation/screenplay/{commands,constraints,policies,context,concepts,diagnostics}.md`
and decisions 0001 and 0003 established the original baseline. Changed examples
use the newer main commit above; do not attribute their verification to the old tag.

"Parses" and "runs" are different claims. The executable profile, and what
each construct binds to, is in the `cratis-screenplay-model-authoring` language
reference.

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
executable model does not bind compliance attributes (`PLAY0268`, "compliance attributes
require portable data-subject semantics"), so a `@pii` model stops at authorable (V1);
keep the attribute, because the classification is the point, and never drop it to bind
or render.

`@pii` is personal data (erasable); `@sensitive` is an **operational secret** (API key,
token, a company's bank account number): encrypted at rest without erasure and withheld
from the causation chain (Screenplay decision 0034, Screenplay#384). C# providers render
`@sensitive` as `[Encrypted]` + `[NotAudited]`, `@pii` as `[PII]`, and `@pii @sensitive`
as `[PII]` only, because Chronicle rejects `[PII]` with `[Encrypted]` (`CHR0053`); Stage
renders this from v4.29.0. The executable model still stops at `PLAY0268` for either.

⚠️ **Identifiers are neither `@pii` nor `@sensitive`.** Chronicle rejects `[PII]` on an
event source id (`CHR0034`) and `[Encrypted]` on one (`CHR0052`); Screenplay reports
`PLAY0515` for `@pii` from Screenplay 4.69.1 and for `@sensitive` from 4.84.1, on a
command identifier, an explicit `for` destination or an event source identifier; earlier
versions compile it silently and only Chronicle catches it. Keep the stream identity a surrogate `Uuid`
concept and carry the personal value (name, email) as a separate `@pii` property and a
secret as a `@sensitive` property.

⚠️ **Enum trap.** A value literally named `validate` is read as an empty validate
block. Write `@validate` for the value; the compiler warns when it sees the
ambiguity.

Use `type <Name>` for a composite shape (several properties) that events and
commands reference; use `concept` for a single wrapped primitive.

## The command block

Excerpt: the concepts, the `InvoiceLine` type, the policy and the event are
declared elsewhere in the model.

```screenplay
command RegisterInvoice
  description "Registers a new invoice with its lines and payment terms"
  invoiceId      InvoiceId identifier
  invoiceNumber  InvoiceNumber
  lines          InvoiceLine[]
  note           String optional
  authorize CanManageInvoice
  validate
    invoiceNumber not empty                 message "Invoice number is required"
    invoiceNumber matches "^INV-[0-9]{6}$"  severity warning message "Must look like INV-000000"
  produces InvoiceRegistered
    for invoiceId
    registeredAt = $context.occurred
```

Type modifiers: `<Type>[]` for a collection, `<Type> optional` for absence.
`Type[] optional` makes the whole collection optional, not its items. Legacy
`Type?` still parses with information `PLAY0479`; use its repair or editor quick
fix to migrate. `--warnaserror` does not reject information diagnostics.
`reads X optional` is not supported yet.

⚠️ **The parser enforces no clause order.** The house order is description,
properties, `reads`, `authorize`, `validate`, `produces`/`handler`, `concurrency`.
Keep to it.

⚠️ **`produces` and `handler` are mutually exclusive** — declaring both is an
error. Everything else may repeat except `description` (one) and `concurrency`
(one). A `handler` parses but **never binds**, with or without an `implementation`
or `hint`: the binder reports `PLAY0268` ("handler requires a constrained
implementation attachment"), and a `handler` is not one of the opaque bodies below.
Prefer `produces` when the model must run or render.

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

The rule vocabulary (`not empty`, `min`/`max`, comparisons, `length`, `matches`, `all`, `rule <Name>`) is in
[references/validate-rules.md](references/validate-rules.md): read it when choosing or writing a rule form.

⚠️ **Validation severity is not compiler severity.** Every failed rule and
`require` rejects the command, at `information` and `warning` too; severity only
tells the UI how to present the failure.

**Whole-command rules** use `require <condition>` with an indented `message` and
optional `severity`, sharing the condition grammar with `produces … when`:
`and` binds tighter than `or`, parentheses group. A conditional rule is an
implication: `require isExtension == false or newEndDate > endDate`.

**Rules whose logic is code.** A bare `rule <Name>` has no portable meaning (`PLAY0268`) and a bodied rule binds only as
opaque code. Read [references/validate-rules.md](references/validate-rules.md) when a rule's logic must live in a `file`
or fenced code body.

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

## Inline events and destinations

`produces event` introduces a new generation-1 event. Plain `produces X` without `for` does not infer the identifier:
state `for` explicitly on every production targeting it.
Read [references/inline-events.md](references/inline-events.md) when declaring an event inline in `produces event`,
choosing or omitting `for` on a production, or fixing `PLAY0469`-`PLAY0478`.

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
  Compare an enumeration with a member bare (`status == sent`) or quoted
  (`status == "sent"`); the bare form binds from v4.48.0, so quote it when a model
  must bind on an older version.
  Excerpt:

```screenplay
produces when isProForma == true
  ProFormaInvoiceIssued
    for invoiceId
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

An empty block or an unknown dimension is an error. Omitting `concurrency` does
not mean unchecked appends: Chronicle's default optimistic concurrency applies
to the routed scope. This does not make command `reads` protected.

## Generated values and responses (ESM v7)

A `generated` property and a `returns` response need standalone `screenplay` 4.68.0; the cratis CLI reports
`PLAY0268` and Stage refuses them, so such a command is **not rendered yet**: hand-write it.
Read [references/generated-values-and-responses.md](references/generated-values-and-responses.md) when adding or
reviewing `generated` properties, `returns` responses, or decision 0023 constructs.
Read `cratis-screenplay-toolchain/references/generated-responses-example.md` when adding generated command values or response assertions and you need a complete compiled example.
Read `cratis-screenplay-toolchain/references/sources-and-streams.md` when authoring named event sources, streams or command routes that require hand-written realization.

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

## `policy` and `persona`

A policy has **exactly one** `require` line (`PLAY0441`) **or** one implementation, never both (`PLAY0440`). Read [references/policy-persona-seed.md](references/policy-persona-seed.md) when
declaring a policy, a persona, or a `seed` block.

## `$context`

Four contexts, and **what each omits is load-bearing** — when writing a code body or a context/expression mapping, read
[context.md](references/context.md) for the full member lists, the declarative
`$context.` paths, and `$causedBy` / `$env` / `$strings`.

| Context | For | Deliberately omits |
| --- | --- | --- |
| Command | a command handler | — |
| Query | a query performer | — |
| Rule | a validation rule | **`Identity`** — validation does not see roles or claims |
| Policy | an authorization policy | **`CausedBy`, `Causation`** |

## Verify

- [ ] Standalone `screenplay <model> --warnaserror` (4.68.0) reports zero errors and zero
      warnings; or `cratis screenplay validate --warnings-as-errors` on the model folder
      (3.28.2 and 3.28.3 bundle Screenplay 4.66.0, ESM v6 at most; before 3.28.2 bundled 4.60.1, ESM v5
      or lower). Name which tool produced the result.
- [ ] No unintended `PLAY0478` or `PLAY0479` information remains.
- [ ] At most one command property carries `identifier`, and no event property does.
- [ ] Format rules live on the `concept`; state-dependent rules are specifications.
- [ ] Every `authorize` combining policies writes `and`/`or` explicitly.
- [ ] No `reads` or `concurrency` is described as protecting a decision; the gap
      is stated.
- [ ] Constraints are `unique` forms; no `file` constraint stands in for another rule.
- [ ] Each policy has one `require` or one implementation, not both.
- [ ] Personal data is `@pii` on the concept, with a reason; no identifier concept is `@pii`;
      operational secrets are `@sensitive` (never `@pii`), and no identifier concept carries either.
- [ ] No `handler` where the model must bind, and no bodied construct described as
      runnable or renderable without saying which tool admits it.
- [ ] No event carries an optional property covering two situations.

Read `cratis-screenplay-toolchain/references/versions.md` when selecting a compiler or determining which executable or renderable subset admits a construct.

Versions, tool capabilities and the executable and renderable subsets: `cratis-screenplay-toolchain` (`references/versions.md`). Where a construct sits in the
method: `cratis-screenplay-modeling-lifecycle` and `cratis-screenplay-slice-design`.

## Route near misses

- Deciding *which* commands and events exist: `cratis-screenplay-event-modeling`.
- Building read models from these events: `cratis-screenplay-projections`.
- Pinning the rejections and denials: `cratis-screenplay-specifications`.
- The parsed/bound/executed boundary: `cratis-screenplay-model-authoring`.
