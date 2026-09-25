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
| `Cratis.Screenplay` | `4.31.0` | CDL parser, reaction and trigger parsers, diagnostics, semantic binder |

Checked against the Screenplay repository at tag `v4.31.0` (commit `355dffb`):
`Documentation/screenplay/{captures,captures/grammar,reactions,triggers,interactions,file-references,grammar,diagnostics}.md`
and decisions 0003, 0006 and 0009. Every example below compiles with that
version's compiler. Reverify before claiming another version behaves the same.

⚠️ **Neither slice type reaches the reference runtime.** The executable model
admits only `StateChange` and `StateView` slices, so an `Automation` or
`Translate` slice fails binding with `PLAY0268` (*Slice '<name>' of type '<type>'
is not admitted by ESM v1*), and so do reactions and declared triggers. A
specification's `when append` never runs reactions either. Model them when the
`.play` file is the deliverable; do not promise they execute.

## `capture` — the Change Data Capture Language

Captures live in `Translate` slices and are the anti-corruption layer: external
shapes in, domain events out. Excerpt: the module and feature around the slice,
and the events it appends, are declared elsewhere.

```screenplay
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

**`key <property>`** names the source property identifying an instance.

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
| ``when `<expression>` `` | a raw template expression is true (captured verbatim, unparsed) |

⚠️ **`or` and `and` cannot be mixed in one clause** — `when a or b and c` is a
compile error. Split it into two `append` blocks.

**`children <collection> identified by <path>`** and **`nested <path>`** each take
an optional `map` and any number of `append` blocks.

## `reaction`

Excerpt: `BuildFinished` is a declared trigger and `SendFailureNotice` a command
elsewhere in the model.

```screenplay
slice Automation NotifyOnBuildFailure
  reaction NotifyOnFailure
    description "Tells the owning team when a watched build fails"
    when BuildFinished
      repository
      outcome
      invokes SendFailureNotice
        repository = repository
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

Excerpt, inside an `Automation` slice:

```screenplay
reaction Provisioner
  when InvitationAccepted
    workspaceId
    produces WorkspaceProvisioned
      for workspaceId
      workspaceId = workspaceId
    invokes SendWelcomeMail
      workspaceId = workspaceId
```

**The different word is the point.** `produces` appends a fact, and nothing can
refuse it. `invokes` asks for a command, which may still validate and reject.
Using `produces` for both would say those are the same kind of consequence.

Both are declarations of *what happens*, not of how — a trigger can state its
consequences **and** carry a `file` or an inline block in a tagged fence
(` ```csharp `) that implements them. That code is an implementation attachment:
the model lists it (role, owner, content hash) but never runs it.

### What it decides from — trigger `reads`

An automation decides from state. A trigger names the views it consults with
`reads <View> [as <alias>] [by <trigger value>]` — the same word and meaning as
a command's `reads`: the state the behavior decides from. Excerpt, inside a
`feature`: the events, the command and the two read models (each built by a
projection) are declared elsewhere.

```screenplay
slice Automation ChaseOverdueInvoices
  reaction RemindOnDueDate
    description "Reminds the customer when an invoice falls due unpaid"
    when InvoiceFellDue
      invoiceId
      reads InvoiceBalance as balance by invoiceId
      invokes SendPaymentReminder
        invoiceId = invoiceId
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

⚠️ **Declared, not enforced.** Reactions still do not bind in the executable
model (`PLAY0268`), so trigger `reads` gives no runtime protection, and command
`reads` give none yet either (`PLAY0271`, decision 0003). A reaction that
`invokes` a command leaves the decision, and any protection, to that command's
own reads. Decision 0006 leaves `where` over read paths out of scope: keep the
logic that uses the state in the implementation, as both reactions above do.

## `trigger`

```screenplay
trigger BuildFinished
  description "CI reported a finished build on a watched repository"
  repository Repository
  outcome
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

- [ ] `screenplay <model> --warnaserror` reports zero errors and zero warnings.
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

## Route near misses

- Deciding whether a behavior is an automation at all: `cratis-screenplay-event-modeling`.
- The commands a reaction invokes: `cratis-screenplay-command-surface`.
- Hand-written C# Chronicle reactors: `cratis-chronicle-reactor`.
