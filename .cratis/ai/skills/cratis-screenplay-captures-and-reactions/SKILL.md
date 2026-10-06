---
name: cratis-screenplay-captures-and-reactions
description: Model the reactive edges of a Cratis Screenplay `.play` model — `capture` in the Change Data Capture Language for turning external data into events, and `reaction` plus `trigger` for work that runs when something happens, on a schedule, or on an integration signal. Use when integrating an external system, translating outside data into events, or declaring automatic follow-up work in a `.play` model. Do not use for commands, projections or screens.
license: MIT
---

# Captures and reactions

The two slice types that run without anyone pressing a button. A `capture` in a
`Translate` slice turns outside data into events; a `reaction` in an `Automation`
slice runs when something happens.

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
| `Cratis.Screenplay` | `4.31.0` | CDL parser, reaction and trigger parsers, diagnostics, semantic binder |
| `Cratis.Screenplay` | main `fd18129` | Command-only inline event boundary |
| `Cratis.Screenplay` | `4.66.0` (`c89198b`) | ESM v6: reactions, clock, trigger and capture specifications bind; `invokes` caller rule; probed with the standalone tool and its MCP server |

The update follows `commands.md`, `events.md` and `diagnostics.md` at that main
commit (after v4.52.0).

Historical baseline evidence: the original examples were checked against the Screenplay repository at tag `v4.31.0` (commit `355dffb`):
`Documentation/screenplay/{captures,captures/grammar,reactions,triggers,interactions,file-references,grammar,diagnostics}.md`
and decisions 0003, 0006 and 0009; those original examples compiled with that
version's compiler. The specification actions and ESM v6 text were checked at
`v4.66.0` (see its row above), and the complete examples here and in
`references/complete-examples.md` compile with the standalone 4.66.0 compiler.
Reverify before claiming another version behaves the same.

⚠️ **Which tool admits them depends on its Screenplay version.** The ESM level
decides, not the slice type:

- **Standalone `screenplay` 4.66.0 (ESM v1-v6, from 4.61.0):** `Automation` and
  `Translate` slices, reactions, declared triggers and captures bind, and the
  reference runner executes them. Probed: the complete example below is
  `executableReady` over `screenplay mcp`.
- **`cratis` 3.28.2 (bundles Screenplay 4.66.0, ESM v1-v6):** the same as the standalone
  tool. Probed: the complete examples validate with warnings as errors and are
  `executableReady` over `cratis screenplay mcp`. `cratis` 3.27.1 and earlier (Screenplay
  4.60.1, ESM v1-v5) failed an `Automation` or `Translate` slice at binding with `PLAY0268`
  (*Slice '<name>' of type '<type>' is not admitted by ESM v1*), reported reactions as
  *requires portable occurrence and effect semantics* and captures as *require a portable
  compiled CDL plan*, and gave a false `PLAY0285` on a specification that follows a reaction
  cascade (Cratis/cli#242).
- **Stage 4.24.1** admits ESM v1-v3 and renders no `Automation` or `Translate`
  slice. The automation is gap-fill, with the `.play` slice and its specifications
  as the contract: `cratis-screenplay-render-and-gap-fill`.

Model them whenever the `.play` file is the deliverable, and say which tool bound
them. Versions and messages: `cratis-screenplay-toolchain` (`references/versions.md`).
Method (the four-part automation test, loops, translations versus automations):
`cratis-screenplay-automations-and-translations`.

**Specify what sets them off** (v4.48.0, checked at tag `v4.48.0`, commit
`3baf4a4`; execution from ESM v6, checked at `v4.66.0`): `when clock "<instant>"`
for a reaction on `every` or `at`, `when trigger <Trigger>` with its values for one
on an application trigger, and `given capture` / `when capture <Capture>` with the
source record's fields for a capture, then the events that should follow.
`given clock` fixes the occurrence time, so values mapped from `$context.occurred`
can be asserted. Excerpt of the complete example below:

```screenplay excerpt
specification IssuingTheWeeklyDigest
  given clock "2026-10-05T07:00:00Z"
  when clock "2026-10-05T07:30:00Z"
  then DigestIssued
    for "weekly"
    issuedAt = "2026-10-05T07:30:00Z"
```

Under `cratis` 3.27.1 and earlier these actions parsed and were checked against the application
but bound to nothing (`PLAY0268` names ESM v6, decision 0022); on 3.28.2 they bind. Either way
no command runs them: report such a specification as authored, not executed. Clock rules: the clock is UTC and exact; an
occurrence fires once when it is **due after `given clock` and at or before
`when clock`**, in time order; intervals count from the Unix epoch; `when clock`
needs `given clock`, so equal instants fire nothing. Limits: 10,000 occurrences per
advance, 1,000 new facts per scenario. Spec grammar and outcome comparison:
`cratis-screenplay-specifications`.

## Complete example (ESM v6)

One document with every construct below: an application trigger, a reaction on an
event, on a trigger (with `where` and `invokes`), on a view read and on the clock, and
a capture with its specifications. The excerpts later in this skill have their own
complete parent documents in `references/complete-examples.md`.

```screenplay
concept InvoiceId : Uuid
trigger PaymentFileArrived
  description "The bank's payment file listed a payment for an invoice"
  invoiceId InvoiceId
  amount Decimal
module Collections
  feature Invoices
    slice StateChange SendInvoice
      command SendInvoice
        invoiceId InvoiceId identifier
        amount Decimal
        produces InvoiceSent
          for invoiceId
          invoiceId = invoiceId
          amount = amount
          sentAt = $context.occurred
      event InvoiceSent
        invoiceId InvoiceId
        amount Decimal
        sentAt DateTime
    slice StateChange CloseInvoice
      command CloseInvoice
        invoiceId InvoiceId identifier
        reason String
        validate
          reason not empty message "A reason is required"
        produces InvoiceClosed
          for invoiceId
          reason = reason
      event InvoiceClosed
        reason String
      constraint OnlyClosedOnce
        unique event InvoiceClosed
    slice StateView InvoiceBalances
      readmodel InvoiceBalance
        invoiceId InvoiceId
        outstanding Decimal
      query InvoiceBalanceById => InvoiceBalance optional
        by invoiceId InvoiceId
      projection InvoiceBalances => InvoiceBalance
        from InvoiceSent
          invoiceId = $eventSourceId
          outstanding = amount
    slice StateChange SendPaymentReminder
      command SendPaymentReminder
        invoiceId InvoiceId identifier
        produces PaymentReminderSent
          for invoiceId
          reminderNumber = 1
      event PaymentReminderSent
        reminderNumber Int
    slice Automation Reminders
      reaction RemindOnDueDate
        description "Reminds the customer when an invoice falls due unpaid"
        when InvoiceFellDue
          invoiceId
          reads InvoiceBalance as balance by invoiceId
          invokes SendPaymentReminder
            invoiceId = invoiceId
      reaction ReminderScheduler
        description "Schedules a reminder when an invoice is sent"
        when InvoiceSent
          invoiceId
          produces ReminderScheduled
            scheduledAt = $context.occurred
      reaction PaymentImporter
        description "Closes an invoice the bank file shows as paid"
        when PaymentFileArrived
          invoiceId
          amount
          invokes CloseInvoice
            invoiceId = invoiceId
            reason = "paid"
        where amount > 0
      reaction WeeklyDigest
        description "Issues the collections digest every Monday morning"
        at 07:30 on Monday
          produces DigestIssued
            for "weekly"
            issuedAt = $context.occurred
      event InvoiceFellDue
        invoiceId InvoiceId
      event ReminderScheduled
        scheduledAt DateTime
      event DigestIssued
        issuedAt DateTime
      specification SchedulingAReminderWhenAnInvoiceIsSent
        given clock "2026-10-02T09:00:00Z"
        when append InvoiceSent
          for "9c858901-8a57-4791-81fe-4c455b099bc9"
          invoiceId = "9c858901-8a57-4791-81fe-4c455b099bc9"
          amount = 120
          sentAt = "2026-10-02T09:00:00Z"
        then ReminderScheduled
          for "9c858901-8a57-4791-81fe-4c455b099bc9"
          scheduledAt = "2026-10-02T09:00:00Z"
      specification ClosingAPaidInvoice
        when trigger PaymentFileArrived
          invoiceId = "9c858901-8a57-4791-81fe-4c455b099bc9"
          amount = 120
        then InvoiceClosed
          for "9c858901-8a57-4791-81fe-4c455b099bc9"
          reason = "paid"
      specification IssuingTheWeeklyDigest
        given clock "2026-10-05T07:00:00Z"
        when clock "2026-10-05T07:30:00Z"
        then DigestIssued
          for "weekly"
          issuedAt = "2026-10-05T07:30:00Z"
    slice Translate LegacyInvoiceSync
      capture LegacyInvoiceCapture
        source api
          api   LegacyInvoicingApi
          route /invoices
          poll  5m
        key id
        map
          status = status translate
            "sendt"  => sent
            "betalt" => paid
        append LegacyInvoicePaid
          tag legacy
          when status from "sent" to "paid"
            paidAt = $context.occurred
      event LegacyInvoicePaid
        paidAt DateTime
      specification SeeingALegacyPayment
        given clock "2026-10-02T12:00:00Z"
        given capture LegacyInvoiceCapture
          id     = "inv-42"
          status = "sendt"
        when capture LegacyInvoiceCapture
          id     = "inv-42"
          status = "betalt"
        then LegacyInvoicePaid
          for "inv-42"
          paidAt = "2026-10-02T12:00:00Z"
```

## `capture` — the Change Data Capture Language

Captures live in `Translate` slices and are the anti-corruption layer: external
shapes in, domain events out. Excerpt; complete document: `references/complete-examples.md`,
"Capture with `source`, `map`, `append` and `children`".

```screenplay excerpt
slice Translate LegacyInvoiceSync
  capture LegacyInvoiceCapture
    source api
      api   LegacyInvoicingApi
      route /invoices
      poll  5m
    key id
    map
      status = status translate
        "utkast" => draft
        "sendt"  => sent
        "betalt" => paid
    append InvoiceStatusChanged
      tag legacy
      when status
        invoiceId = $.id
        status    = $.status
        changedAt = $context.occurred
    append InvoicePaidFromSent
      when status from "sent" to "paid"
        invoiceId = $.id
    children lineItems identified by lineNumber
      append InvoiceLineItemAdded
        when added
          invoiceId  = $.id
          lineNumber = $.lineNumber
```

**`source <kind>`** with indented settings. The documented kinds and settings are
`api` (`api`, `route`, `poll`), `webhook` (`path`) and `message` (`topic`).
⚠️ The grammar is **open** — the parser accepts any kind and any setting name as
free-form name/value pairs, so a typo is not caught. The three kinds are
convention, not enforcement.

**`key <property>`** names the source property identifying an instance. From ESM v6
a capture without a `key` does not bind (`PLAY0268`). In a specification the
reference is handed records (`given capture`, `when capture`) and never contacts a
`source`, which stays realization metadata; events append to the event source the
record's `key` names, and `$context.occurred` is the scenario's `given clock`.

Declaring an event's external origin on the `event` itself is accepted as
Screenplay decision 0009 but **not in the language**; a `capture` in a
`Translate` slice is how outside data enters a model today.

**`map`** reshapes before events are appended: direct rename
(`productName = name`), a backtick template, `translate` with indented
`"source" => target` entries, and `split <source> by "<sep>"` with indented target
properties.

**Mapping sources:** `$.` for a value from the current source item, `$context.` for
capture context, `$env.` for an environment variable, plus literals and templates.

**`append <Event>`** with optional `tag` lines and one `when` clause:

| `when` form | Appends when |
| --- | --- |
| `when added` | an item appears in the source |
| `when removed` | an item disappears from the source |
| `when <Path>` | that property changes |
| `when <Path> from <v> to <v>` | that property makes that exact transition |
| `when <a> or <b> [or <c>]` | any of those properties change |
| `when <a> and <b> [and <c>]` | all of those properties change |
| ``when `<expression>` `` | a raw template expression is true (captured verbatim; from ESM v6 the reference evaluates fields, literals, `==`, `!=`, the ordering operators, `&&`, `||`, `!` and parentheses, and an expression outside that grammar does not bind) |

⚠️ **`or` and `and` cannot be mixed in one clause** — `when a or b and c` is a
compile error. Split it into two `append` blocks.

**`children <collection> identified by <path>`** and **`nested <path>`** each take
an optional `map` and any number of `append` blocks.

## `reaction`

Excerpt; complete document: `references/complete-examples.md`,
"Reaction on a declared trigger with `where` and `invokes`".

```screenplay excerpt
slice Automation NotifyOnBuildFailure
  reaction NotifyOnFailure
    description "Tells the owning team when a watched build fails"
    when BuildFinished
      repository
      outcome
      invokes SendFailureNotice
        repository = repository
        outcome    = outcome
    where outcome == "failed"
```

A reaction declares **at least one trigger**; everything under a trigger is
optional.

⚠️ **Indentation decides what is a trigger and what is an effect.** `produces`,
`invokes`, `file` and inline code belong **inside** the trigger block, indented
under `when`/`every`/`at`. Only `description` and `where` sit at reaction level.
Outdenting an effect gives *Expected a trigger in reaction body, got 'invokes …'*
(`PLAY0137`) — the compiler is looking for another trigger where the effect is.

### What sets it off

| Form | Runs |
| --- | --- |
| `when <Name>` | on that event, declared trigger, or registered trigger |
| `every <n> seconds\|minutes\|hours\|days` | on that interval (`n` ≥ 1) |
| `at HH:mm` | every day at that time |
| `at HH:mm on <Weekday>` | every week on that day |
| `at HH:mm on day <n>` | every month on that day (`n` is 1–31) |

Time is strictly `HH:mm`. Weekday is the full English name.

### The values a reaction takes

A bare name under a trigger says the reaction **uses** that value from the
occurrence. This is a **selection, not a declaration** — the shape belongs to the
event or trigger. Taking a value the occurrence does not carry is reported.

### `where` — narrowing

`where` uses the same condition grammar as `produces … when` and `require`:
`==`, `!=`, the ordering operators, `contains` for a substring anywhere,
`starts with` for one at the beginning, combined with `and`, `or` and parentheses.

⚠️ **`where` belongs to the reaction, not to one trigger** — it says which
occurrences are worth running for, whatever set them off. A second `where` on one
reaction is an error; combine with `and`/`or` instead.

### Effects — `produces` vs `invokes`

Inline `produces event <Name>` is command-only (`PLAY0474` in a reaction).
Declare reaction-produced events separately and use plain `produces <Name>`.
Do not extend the inline command destination default or its repairs to reactions.

Excerpt; complete document: `references/complete-examples.md`,
"Reaction with `produces` and `invokes`":

```screenplay excerpt
reaction Provisioner
  when InvitationAccepted
    workspaceId
    produces WorkspaceProvisioned
      for workspaceId
      workspaceId = workspaceId
    invokes SendWelcomeMail
      workspaceId = workspaceId
      template    = "welcome"
```

A `produces` without `for` appends to the event source of the event that set the
reaction off. A clock, application or built-in trigger has no such event, so what it
produces needs `for` - a value the trigger carries, or literal text.

**The different word is the point.** `produces` requests a fact append, subject to
append-time constraints. `invokes` asks for a command, which additionally runs the
command's authorization, validation and requirements, and may reject.
Using `produces` for both would say those are the same kind of consequence.

**Who is the caller of an `invokes`?** Nobody. In the reference execution the invoked
command runs its full pipeline - authorization, validation, requirements,
constraints - **with no caller**; a command that needs one rejects, and the
rejection ends the scenario. Each invoked command is atomic, but the cascade is not,
so facts accepted earlier remain. There is no syntax for a trusted identity today
(Screenplay#383, open): never invent `runs as` or a `given caller` for a reaction.
Say so in the model: a `description` on the reaction that names the trusted actor
the target must use. At code level a rendered or hand-written target runs such a
command as the system with `[ExecuteCommandsAsSystem]` (Arc 20.56.0 and later, so
also in a rendered application's Arc 22.25.0). An authorized command a reaction
invokes needs that decision made explicit, in the model's description and in the
gap-fill code, not left to a rejection nobody expected. Cascades and their
specification limits: `cratis-screenplay-specifications`.

Both are declarations of *what happens*, not of how — a trigger can state its
consequences **and** carry a `file` or an inline block in a tagged fence
(` ```csharp `) that implements them. That code is an implementation attachment:
the model lists it (role, owner, content hash) but never runs it.

### What it decides from — trigger `reads`

An automation decides from state. A trigger names the views it consults with
`reads <View> [as <alias>] [by <trigger value>]` — the same word and meaning as
a command's `reads`: the state the behavior decides from. Excerpt; complete
document: `references/complete-examples.md`, "Trigger `reads` on an event and on the
clock" (authoring-valid; the `file` bodies stop it binding at ESM v6).

```screenplay excerpt
slice Automation ChaseOverdueInvoices
  reaction RemindOnDueDate
    description "Reminds the customer when an invoice falls due unpaid"
    when InvoiceFellDue
      invoiceId
      reads InvoiceBalance as balance by invoiceId
      invokes SendPaymentReminder
        invoiceId = invoiceId
        channel   = "email"
      file Reactions/RemindOnDueDate.cs
  reaction SweepOverdueInvoices
    description "Re-checks every overdue invoice each morning"
    at 08:00
      reads OverdueInvoice
      file Reactions/SweepOverdueInvoices.cs
```

- `reads` sits **under a trigger**, beside the values it takes and its effects.
  Each trigger declares its own.
- **`by` names a value that trigger takes** (`invoiceId` above). Naming anything
  else is warning `PLAY0442`.
- **Clock triggers read whole views.** `every` and `at` take no values, so
  `reads <View>` works under them but `by` is error `PLAY0443`.
- **Aliases follow the command rules.** A view read more than once needs an
  alias on every read (`PLAY0410`), aliases are unique per trigger (`PLAY0411`),
  and an alias must not match a trigger value (`PLAY0412`). A view no projection
  in the document produces is warning `PLAY0177`.
- **`reads` is a directive in a trigger body.** A trigger value named `reads` is
  written `@reads`. A bare `reads` line is error `PLAY0175`, and
  `reads <PrimitiveType>` is warning `PLAY0444`; both messages name the escape.
- `for each <View>` is reserved for a future view-driven trigger. It is not a
  trigger today (`PLAY0137`).

⚠️ **Declared, not enforced.** A trigger `reads` gives no runtime protection. From
ESM v6 the binder refuses to treat it as one: a trigger with `reads` that **produces
directly**, or whose effect is an opaque body (`file` or an inline block), fails
binding, because its decision dependency cannot be protected. A reaction that only
`invokes` a command binds, and the decision, and any protection, belong to that
command's own reads. Command `reads` give none yet either (`PLAY0271`, #129).
Decision 0006 leaves `where` over read paths out of scope, and `where` needs
every operand to resolve from the trigger's declared scalar occurrence shape (listed in
the input selection or not; nested paths and read aliases fail binding): keep the logic that uses the state in
the invoked command or the implementation. Under `cratis` 3.27.1 and earlier none of this
bound at all (`PLAY0268`); `cratis` 3.28.2 binds it like the standalone tool.

## `trigger`

```screenplay
concept Repository : String

trigger BuildFinished
  description "CI reported a finished build on a watched repository"
  repository Repository
  outcome String
```

A trigger declares two things: **that the name exists**, and **what an occurrence
hands the reaction**. It deliberately declares nothing about what makes one occur —
that belongs to whatever produces it, and keeping it out is what lets the set stay
open. The type on a value is optional; a bare name is already a useful statement.

**Name resolution, in order:** events the document declares or imports → triggers
the document declares → triggers registered with the compiler, plus the built-in
host signals. A registration wins over a built-in of the same name. Only when all
three miss is the name reported unknown — a **warning** (`PLAY0248`), because the
name may be known outside the document. A malformed reaction body is an error.

**Built-in triggers:** `Startup` and `Shutdown`. The clock is built in too, but
with its own syntax rather than a name.

⚠️ **An application trigger is not a UI event.** What a button click, a form
submit or entering a screen does is an *interaction*: an `on click` / `on submit`
/ `on enter` clause or a named `behavior`, never a declared `trigger` (see
`cratis-screenplay-ui-composition`). The two meet in two places: an interaction
can observe a declared trigger with `on <Trigger>` and fire one with
`raise <Trigger>`. A trigger named after a built-in interaction kind (`click`,
`submit`, `enter`, …) is an error (`PLAY0326`).

⚠️ Under a reaction trigger, `description`, `file`, `produces`, `invokes` and
`reads` are directives, so a value with one of those names is written with `@`
(`@file`, `@reads`).

**Registration** (for a name only an integration knows) happens through the
compiler's language registry, either name-only or with a shape. ⚠️ Stating **no**
values and stating **none** are different claims: a definition with no value list
says the registration does not describe the shape, so what a reaction takes is left
alone; one with an **empty** list says an occurrence carries nothing, so taking
something is reported. `Startup` and `Shutdown` are registered the second way.

## Guidance, verbatim

> - Reactions that only translate events into other events belong in `Translate`
>   slices when driven by external data (captures); event-to-event automation stays
>   in `Automation` slices.
> - Keep reaction logic small; anything substantial belongs in a `file` reference
>   where it can be tested on its own.
> - Describe the reaction before you implement it — a document full of `file` lines
>   and nothing else tells a reader nothing.
> - A name that only an integration knows belongs in a `trigger` declaration, so the
>   document says what the reaction is handed rather than leaving the reader to guess.

## Verify

- [ ] `screenplay <model> --warnaserror` reports zero errors and zero warnings
      (standalone 4.66.0, or `cratis` 3.28.2 or later). Under `cratis` 3.27.1 or earlier expect
      `PLAY0268` at binding and a false `PLAY0285` on cascade specifications, and report them
      as tool skew.
- [ ] The tool that bound the model is named (Screenplay 4.61 or later, so standalone or
      `cratis` 3.28.2 or later, for ESM v6 constructs); no tool runs the specifications.
- [ ] Each automation has all four components — occurrence, state consulted,
      conditional logic, resulting command or event. If it always fires
      unconditionally it is co-production, not an automation.
- [ ] Every reaction has a termination condition and cannot loop forever.
- [ ] `produces` is used for facts and `invokes` for intents, never interchangeably.
- [ ] No `when` clause mixes `or` and `and`.
- [ ] Cross-cutting infrastructure is **not** modeled as a `Translate` slice.
- [ ] Every name a reaction takes is carried by the event or trigger.
- [ ] Each trigger `reads` the views its automation decides from; `by` names a
      value the trigger takes, and clock triggers read without `by`.
- [ ] Nobody reports trigger or command `reads` as protected; UI clicks are
      interactions, not triggers.
- [ ] Every `invokes` of an authorized command names the trusted actor in a
      description; no caller is invented for a reaction.

## Route near misses

- Deciding whether a behavior is an automation at all: `cratis-screenplay-event-modeling`.
- Automation, translation and loop-safety method, and the trusted-actor decision: `cratis-screenplay-automations-and-translations`.
- Specifying clocks, triggers, captures and cascades: `cratis-screenplay-specifications`.
- Which tool binds ESM v6 and what each reports: `cratis-screenplay-toolchain`.
- Hand-built code for an automation Stage does not render: `cratis-screenplay-render-and-gap-fill`.
- The commands a reaction invokes: `cratis-screenplay-command-surface`.
- Hand-written C# Chronicle reactors: `cratis-chronicle-reactor`.
