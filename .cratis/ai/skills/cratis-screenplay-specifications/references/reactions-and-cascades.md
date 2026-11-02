## Contents

- Reactions and cascades (ESM v6)
  - An outbound publication is stated by its own Translate slice
  - `PLAY0285` and the slice boundary

## Reactions and cascades (ESM v6)

From ESM v6 an action sets reactions off: after a command, an append, a clock
tick, a trigger or a capture record, each new fact runs the reactions to its event,
and what those append or invoke runs more, until nothing is left. **A specification
runs its own slice only** (decision 0115, ESM v34, applies to every model): only the
reactions, captures and outbound publications declared in the slice that holds the
specification run. `then` events compare the facts of that slice; another slice's
reaction, capture or publication never runs, so its facts cannot appear in `then`.
A chain across slices is proved link by link, each slice stating its own link.

```screenplay expect PLAY0469
concept InvoiceId : Uuid
module Collections
  feature Invoices
    slice StateChange SendInvoice
      command SendInvoice
        invoiceId InvoiceId identifier
        produces InvoiceSent
          for invoiceId
          invoiceId = invoiceId
      event InvoiceSent
        invoiceId InvoiceId
      specification SendingAnInvoice
        when SendInvoice
          invoiceId = "9c858901-8a57-4791-81fe-4c455b099bc9"
        then InvoiceSent
          for "9c858901-8a57-4791-81fe-4c455b099bc9"
          invoiceId = "9c858901-8a57-4791-81fe-4c455b099bc9"
    slice Automation Reminders
      reaction ReminderScheduler
        description "Schedules a reminder when an invoice is sent"
        when InvoiceSent
          invoiceId
          produces ReminderScheduled
            for invoiceId
            scheduledAt = $context.occurred
      reaction ReminderSender
        description "Asks for the reminder to go out"
        when InvoiceSent
          invoiceId
          invokes SendReminder
            invoiceId = invoiceId
      event ReminderScheduled
        scheduledAt DateTime
      specification SchedulingAReminderWhenAnInvoiceIsSent
        given clock "2026-10-02T09:00:00Z"
        when append InvoiceSent
          for "9c858901-8a57-4791-81fe-4c455b099bc9"
          invoiceId = "9c858901-8a57-4791-81fe-4c455b099bc9"
        then ReminderScheduled
          for "9c858901-8a57-4791-81fe-4c455b099bc9"
          scheduledAt = "2026-10-02T09:00:00Z"
        then invokes SendReminder
          invoiceId = "9c858901-8a57-4791-81fe-4c455b099bc9"
    slice StateChange SendReminder
      command SendReminder
        invoiceId InvoiceId identifier
        produces event ReminderSent
      specification SendingAReminder
        when SendReminder
          invoiceId = "9c858901-8a57-4791-81fe-4c455b099bc9"
        then ReminderSent
          for "9c858901-8a57-4791-81fe-4c455b099bc9"
```

- A specification whose action is a command goes in the slice that declares that
  command, here `SendInvoice`, not in the `Automation` slice that reacts: a command
  from another slice is `PLAY0273` "command is unresolved in its slice" at binding.
  The command's specification states the command's own facts; it does not state
  `ReminderScheduled`, which the other slice's reaction appends.
- `then invokes <Command>` states the hand-over to a command another slice owns
  (ESM v34, Screenplay 4.246.0). That command is decided against the world, so its
  refusals reach the reaction's `on refused` branches, but its facts belong to its
  own slice and are not kept; `SendReminder`'s own specification states `ReminderSent`.
  Each `then invokes` names the command and the values passed, and only the stated
  values are compared. When at least one is stated, the invocations the slice's
  reactions made must match them exactly in count and order (any order under
  `then events in any order`); a refused invocation counts too. A specification
  that states none compares no invocations. `PLAY0815`: the line is not
  `then invokes <Command>`. `PLAY0816`: "Specification '<name>' states 'then invokes
  <Command>', but no reaction of its slice '<slice>' invokes '<Command>'" (no
  reaction declared in the specification's own slice invokes it).
- A reaction invocation without a declared actor has no caller and a gated
  command denies. Reaction `runs as system role "<Role>"` supplies the
  authenticated system actor (ESM v10); `given caller` does not. Each command is
  atomic, not the cascade. Checked actor scenario and CLI/Stage limitations:
  captures-and-reactions `references/invocation-identity.md`.
- The clock is UTC and exact. An `every` or `at` occurrence fires once when it is
  due after `given clock` and at or before `when clock`; `when clock` needs
  `given clock`, so the same instant twice fires nothing.
- A reached reaction with a code body (`file` or inline) returns unsupported, as
  does a reaction that never settles. The reference stops at 1,000 new facts per
  scenario and 10,000 due occurrences per clock advance.
- A model that uses these forms selects ESM v6 (`schemaVersion: 6`). Stage
  renders supported event-triggered Automation, but not Translate,
  captures, non-event triggers or opaque bodies (`-024`), claim-reading/opaque `runs as` gates (`-034`), legacy filters (`-035`)
  or mixed effects (`-037`). Single-hop reaction append specs render; deeper appends
  remain `-011`. Keep refused scope as gap-fill against this contract: `cratis-screenplay-render-and-gap-fill`.

### An outbound publication is stated by its own Translate slice

When an outbound Translate slice publishes a public event from the private events a command
produces, the command's specification does not state that public event: the publication is
another slice's behavior and does not run. State the public event in the outbound `Translate`
slice's specification (decision 0115, which amends 0098). Stating it in the command's
specification is refused by `PLAY0285` as unreachable and fails at run time.

### `PLAY0285` and the slice boundary

`PLAY0285` (a specification's expected event contradicts every producer of its `when`
command) runs in the syntax pass, with no binding. It follows only the reactions,
invocations and publications declared in the specification's own slice, and its message is
"Specification outcome '<event>' cannot be produced by '<command>' from the stated 'when'
values under its declared mappings". It is no longer tool skew: a specification that states
an event another slice's reaction appends is wrong, so move the `then` to the slice that
owns the reaction (`when append` the triggering fact) or state the hand-over with
`then invokes`. Do not delete the assertion to turn the model green. A compiler older than
4.246.0 still runs every slice's reactions; record which tool gave which verdict and see
`cratis-screenplay-toolchain`.
