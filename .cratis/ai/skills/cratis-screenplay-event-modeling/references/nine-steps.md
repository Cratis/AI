# The nine-step workflow design process

Follow all nine steps for each workflow. Do not skip steps, do not combine them,
and do not start workflow 2 while workflow 1 is incomplete — **discovery is
design**. Each step has a defined Screenplay output; produce it.

## Step 1 — Identify the user goal

Ask until the goal is unambiguous: *"What exactly is the user trying to
accomplish? What does success look like? What would make this fail?"*

**Output:** the `feature` name and its `description`.

```screenplay
module Invoicing
  feature InvoiceManagement
    description "Registering and managing the lifecycle of invoices"
```

`description` is the optional **first body line** of a module, feature, slice,
persona or command; at most one. Use a fenced ``` block when one line is not enough.

## Step 2 — Brainstorm events

Sticky-note style, no ordering yet. *"What facts need recording? What happened
that we care about? What would an auditor want to know?"* Keep asking *"what
else?"*

Past tense, business language, facts: `InvoiceRegistered`, `PaymentReceived`.

**Domain facts vs runtime context.** Events must be true regardless of which
machine replays them. A working directory, PID or hostname is runtime context and
does not belong in an event.

**Output:** a list of `event` names. Shapes come later.

## Step 3 — Order events chronologically

Arrange into the timeline — the plot. *"What happens first? And then what
happens?"* Identify the happy path **and** the alternative and error paths.

**Output:** the order the slices will be written in. Note that folder round-trip
does not preserve declaration order, so the timeline is documentation, not
structure.

## Step 4 — Create wireframes

These need not be the real UI. Their purpose is a complete accounting of what a
user can **see** and what they can **do** at each interaction point.

```
+-------------------------------+
|  Register Invoice             |
+-------------------------------+
|  Customer:  [dropdown]        |
|  Lines:     [list]            |
|  Total:     $XX.XX            |
|                               |
|  [Register]                   |
+-------------------------------+
```

Every field traces to an **event field** (something displayed) or a **command
input** (something provided). If you cannot trace a field, something is missing.

**Concurrency check:** *"Can there be more than one of these in progress at the
same time?"* If yes, the wireframe shows a list or table, not a single-item view.

**Output:** the `screen` declarations, at Level 1 (intent) for now —
`data <ReadModel> via query <Query>` plus `action <Command>`.

## Step 5 — Identify commands

For each event: *"What triggered this? Who issued that command? What information
did they provide? Under what circumstances would this NOT happen?"*

Commands are imperative and present tense: `RegisterInvoice`, `ProcessPayment`.
**Commands can fail; events cannot.**

**Output:** the `command` declaration with its properties, exactly one
`identifier` property, `authorize`, and `produces`.

```screenplay
slice StateChange RegisterInvoice
  command RegisterInvoice
    invoiceId     InvoiceId identifier
    invoiceNumber InvoiceNumber
    authorize CanManageInvoice
    validate
      invoiceNumber not empty  message "Invoice number is required"
    produces InvoiceRegistered
      invoiceId     = invoiceId
      invoiceNumber = invoiceNumber
      registeredAt  = $context.occurred
```

The "under what circumstances would this NOT happen" answers become `validate`
rules, `authorize` policies, `constraint` declarations, and the rejection
specifications.

## Step 6 — Design read models

Read models exist to support what wireframes display and what automations need.
For each actor at each point, and for each automation: *"What does this person
need to see? What information do they need to decide? What does this automation
need to determine its next action?"*

Verify **every** field traces back to an event:

```
InvoiceListReadModel:
  invoiceId      <- InvoiceRegistered.invoiceId
  invoiceNumber  <- InvoiceRegistered.invoiceNumber
  status         <- InvoiceRegistered, InvoiceSent, InvoicePaid
```

**Concurrency check per field:** if the domain supports concurrent instances, use
a collection type, not a singular value.

**Output:** the `readmodel` shape and the one `projection` or `reducer` that
builds it. **Exactly one thing may build a read model** — two builders is a
compile error (`PLAY0191`).

```screenplay
slice StateView InvoiceList
  readmodel InvoiceListReadModel
    invoiceNumber InvoiceNumber
    status        InvoiceStatus
  projection InvoiceList => InvoiceListReadModel
    from InvoiceRegistered key invoiceId
      status = "draft"
    from InvoiceSent
      status = "sent"
  query ListInvoices => InvoiceListReadModel[]
```

**Do not model infrastructure preconditions as read models.** "Does the directory
exist?" is not domain state.

## Step 7 — Find automations

*"Does anything happen automatically after this event? What business rules trigger
other processes? Does the system need to check anything before acting?"*

**All four components are required for a true automation:** a triggering
occurrence, state it consults, conditional logic, and a resulting command or
event. **Test:** *"Can this automatic response ever be skipped or vary based on
system state?"* If no, it is co-production — one `StateChange` slice with several
`produces` blocks, not an `Automation` slice.

**Output:** the `reaction`, in an `Automation` slice.

```screenplay
slice Automation ChaseOverdueInvoices
  reaction OverdueChaser
    when InvoiceRegistered
      invoiceId
      dueDate
      invokes MarkInvoiceOverdue
        invoiceId = invoiceId
    where dueDate < today
```

`produces` and `invokes` are indented **inside** the trigger; only `description`
and `where` sit at reaction level. Outdenting an effect gives `PLAY0137`.

`produces` appends a fact nothing can refuse. `invokes` asks for a command, which
may still validate and reject. The words are different on purpose.

Every automation needs a **termination condition**. Watch for infinite loops.

## Step 8 — Map external integrations

*"Does this workflow receive data from outside? Does it send data outside?"* Note
names and purposes only — no APIs, webhooks or protocols yet.

**Ask:** *"Is this integration specific to THIS workflow, or would every workflow
need it?"* If every workflow needs it, it is cross-cutting infrastructure, **not**
a `Translate` slice.

**Output:** the `capture` in a `Translate` slice, and any `trigger` declaration
for a name only an integration knows.

```screenplay
trigger BuildFinished
  repository
  outcome
```

A `trigger` declares that the name exists and what an occurrence hands the
reaction — deliberately **not** what makes one occur.

## Step 9 — Decompose into vertical slices

List every slice grouped by type. A good slice is a complete interaction,
independently valuable, testable in isolation, small enough for 1–2 days.

Bad slices: *"Set up database"* (technical, no user value), *"Implement invoicing"*
(too broad), *"Create Invoice table"* (implementation detail).

**Slice independence.** Slices sharing an event schema are **independent** —
connected by the event contract, not by execution order. A `StateChange` slice is
specified by asserting on produced events; a `StateView` slice is specified with
synthetic `given` events. Neither needs the other implemented first. Do not build
artificial dependency chains.

**Output:** the complete `feature` → `slice` tree, ready for the specifications.

## Facilitation questions quick reference

| Topic | Questions |
| --- | --- |
| Domain discovery | What does the business do? Who are the actors? What are the major processes? What external systems exist? Which workflow is most critical? |
| Events | What facts need recording? What happened here? Would the business need to know this? |
| Timeline | What happens first? And then? Can these happen in parallel? |
| Commands | Who initiates this? User-triggered or automatic? What intent does this represent? |
| Read models | What does this actor need to see? What queries do users run? Can multiple instances be active at once? |
| Automations | Does anything happen automatically? What business rules apply? Can this response ever be skipped? |
| Edge cases | What if this fails? What if the user cancels? What if the external system is down? |
