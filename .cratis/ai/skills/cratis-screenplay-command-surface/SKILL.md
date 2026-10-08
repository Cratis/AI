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

A bodied rule or fenced block on a validation, rule or policy binds as opaque code
(ESM v3): the reference runner reports it unsupported, and a target must supply the
implementation. Two exceptions never bind: the command `handler`, and a `file`
constraint (the binder records the requirement, then rejects it with `PLAY0268`;
only `unique` constraints bind).
Stage 4.24 admits only pure reducer bodies, so such a body is gap-fill code there. Prefer a
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

## Inline events and destinations

Use `produces event` when the command introduces a new, generation-1 event.
This complete example declares its payload and mappings together:

````screenplay
concept ProjectId : Uuid
concept ProjectName : String
module Projects
  feature Naming
    slice StateChange RenameProject
      command RenameProject
        projectId ProjectId identifier
        name ProjectName
        produces event ProjectRenamed
          description "A project received a new name"
          documentation
            ```markdown
            Existing links retain the project's identity.
            ```
          tag audit
          name ProjectName = name
````

The omitted `for` means the command's required scalar identifier **only for
inline productions**, when every production targets that same source. Once a
production targets another source, every production must state `for`. Mixing
omitted inline and plain destinations also fails (`PLAY0470`); there is no
verified MCP repair for that diagnostic. Explicit syntax does not make cross-source
execution supported.

Plain `produces X` references a declared event; omitting `for` does not infer
the command's identifier. In ESM v2+, it inherits a sibling production's resolved
destination through the command destination default. An allocated identity is
used only when no production resolves a destination. State `for` explicitly on
every production targeting the identifier. `PLAY0478` offers advice and a
reviewed repair, not permission to silently retarget an append. Supply an
allocated identity to the executable model when allocation is intentional.

Inline declarations are slice-owned contracts, usable by other consumers.
Their `tag` lines are event-type tags; plain production tags apply at that one
append site. Both inline and standalone events accept a quoted description or
text/Markdown description fence, and one nonempty fenced Markdown `documentation`.
New events omit `id`. Only a rename preserving an old stored name needs
`id "<old name>"`; it does not replace the catalog's `EventContractId`.

| Diagnostic | What to change |
| --- | --- |
| `PLAY0469` | Do not copy the same-source command identifier into payload. Inline copies warn; plain copies with explicit `for` are information. Review persistence before changing a contract. |
| `PLAY0471` / `PLAY0472` | Remove a redundant name-equal `id`; an id must be one nonempty quoted value. |
| `PLAY0473` / `PLAY0474` | Avoid declaration/import collisions; inline events belong only in commands, never reactions. |
| `PLAY0475` | Extract the inline event before adding generations. |
| `PLAY0476` | Inline `origin` and unescaped system-assigned production metadata are forbidden. |
| `PLAY0477` | Use one nonempty Markdown documentation fence. |

MCP can declare a missing produced event (`PLAY0166`), add explicit routing
(`PLAY0478`), remove a redundant pin (`PLAY0471`), or remove an inline identifier
copy (`PLAY0469`). The last **changes the event contract**, retires a property,
refuses affected consumers/opaque implementations and is not fix-all. It does
not establish that stored data is safe to migrate. Use
`cratis-screenplay-model-authoring` for discovery, preview, extraction and rename.

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

A `generated` command property and a `returns` response bind and execute from the standalone
`screenplay` 4.68.0 (ESM v7, decision 0026; `commands.md` "Generated values and responses" at
`v4.68.0`). The cratis CLI 3.28.3 bundles 4.66.0 and reports `PLAY0268` for them, and Stage 4.24.2
refuses ESM v7 with `STAGE-ESM-016` (tracked in Stage#201), so a command that uses them is
**not rendered yet**: hand-write it (gap-fill) with the model as the contract. Complete compiled example:
`cratis-screenplay-toolchain` `references/generated-responses-example.md`.

```screenplay excerpt
command RegisterProject
  projectId ProjectId generated identifier
  receiptId ReceiptId generated
  name ProjectName
  returns
    projectId = projectId
    receiptId ReceiptId = receiptId
```

Rules (all read at `v4.68.0`):

- `generated` is command-only and needs a required, scalar concept backed by `Uuid` (not bare `Uuid`, not
  optional, not a collection). Modifier order is `Type optional generated identifier`.
- A generated value is not a request input, form field, invocation argument or ordinary specification value.
  The command runs authorization and validation first, then generates, then productions and the response, so
  authorization policies (also inherited and the implicit `subject` of a generated identifier), property rules
  and requirements cannot reference one (`PLAY0273`), and a concept with any validation rule cannot back a
  generated property (`PLAY0268`). Reactions map request inputs only.
- `returns <property>` is a scalar response; bare `returns` opens an ordered record of `<name> [<Type>] = <property>`
  fields over direct properties of this command. A type annotation must equal the source's type and
  optionality. Collections, read aliases, arithmetic and whole read models are not supported. At most one
  unconditional response, as a command sibling.
- A two-token `returns name` is a response when `name` is another property of this command; otherwise it is a
  property named `returns`. `returns @name` forces a response, `@returns Type` a property.
- A response exists only on acceptance. Rejection, denial or an unsupported outcome has none; a later reaction or
  scenario-query failure keeps the accepted facts and clears the response. A response-only command records no
  facts. Field names are an external contract: renaming one changes the revision.
- A generated identifier is the implicit destination of inline productions. A plain `produces` without `for` keeps
  its own allocation channel and a generation fixture never satisfies it.
- Generated values give no idempotency, retry or deduplication guarantee. Specifications supply fixtures and assert
  the response: `cratis-screenplay-specifications`.

Other decision 0023 constructs are still **authorable, never executable** (binding reports `PLAY0268`, so
they stop a model at V1): operations, and named event sources and streams with command routes
(`eventsource`, `stream`, `streamId`). **No supported ESM version admits them**, and they have no version number
yet (decision 0025 numbers a version only at its release-ready admission). Syntax or MCP acceptance is not proof of
execution. A model using sources, streams or routes can be authored and validated, but
not bound, run or rendered; hand-write the code with the model as contract
(`cratis-screenplay-toolchain` `references/sources-and-streams.md`). `derive` and `provide` have no documented syntax at that tag; treat them as
planned and do not write them.

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
`PLAY0515` (4.69.1 and later) for either on a command identifier, an explicit `for`
destination or an event source identifier. Keep the stream identity a surrogate `Uuid`
concept and carry the personal value (name, email) as a separate `@pii` property and a
secret as a `@sensitive` property.

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
A `persona` is authoring metadata: the binder reports it as information `PLAY0270`
(report-only) and it does not block binding; an unknown policy it lists is an error.

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

Versions, tool capabilities and the executable and renderable subsets: `cratis-screenplay-toolchain` (`references/versions.md`). Where a construct sits in the
method: `cratis-screenplay-modeling-lifecycle` and `cratis-screenplay-slice-design`.

## Route near misses

- Deciding *which* commands and events exist: `cratis-screenplay-event-modeling`.
- Building read models from these events: `cratis-screenplay-projections`.
- Pinning the rejections and denials: `cratis-screenplay-specifications`.
- The parsed/bound/executed boundary: `cratis-screenplay-model-authoring`.
