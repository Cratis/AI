# Realization and gap-fill

The `.play` revision is the contract; this file says what that means once code is needed. It is
the automation-and-translation addendum to `cratis-screenplay-render-and-gap-fill`; read that
skill for the admission, publication and ownership rules.

## What Stage does not do
Stage 4.73.1 renders no Automation or Translate slice, reaction or capture (Stage#79): each reaction
or capture refuses with `STAGE-ESM-024` (plus `-034` runsAs, `-035` filters, `-037` mixed effects). So the
automation or translation is hand-written delivery with the model as its contract. (History: cratis
3.28.2 and 3.28.3 refused such a model whole with `STAGE-ESM-016`, and 3.27.1 stopped earlier with PLAY0268.)

A reaction that both `produces` events and `invokes` commands stays one modeled reaction. Hand-write one
reactor that returns the events and the commands: Arc 22.72.0 and later append the events first as one
batch, then run the commands in order, with no transaction across them (a retry can repeat both, so keep
both repeatable); the Stage scaffold pins Arc 22.68.0, whose command handler accepts a collection only when every element is a command, so a rendered app needs a proven dependency override to Arc 22.72.0 or later. Never split the reaction to dodge `STAGE-ESM-037`. A `Customizations/` file never makes a
rejected model renderable, and never claim a whole-application V5 from a subset. Choose the route
with `cratis-screenplay-render-and-gap-fill`.

## Where the pieces go (hand-written)
| Model element | Realization | Skill |
|---|---|---|
| reaction `when <Event>` with `invokes` or `produces` | Chronicle reactor returning commands or events | `cratis-chronicle-reactor` |
| trusted actor for `invokes` | `[ExecuteCommandsAsSystem("<role>")]` on the reactor plus a policy requiring the role (Arc, since v20.56.0; available in Stage 4.51.3's rendered Arc 22.50.5) | `cratis-chronicle-reactor` |
| clock trigger, application trigger | scheduler or host signal that raises the occurrence | `cratis-engineering-effect-boundaries` |
| call to an outside system | adapter behind an effect boundary, keyed by the idempotency key in the model | `cratis-engineering-effect-boundaries` |
| capture source (webhook, poll, topic) | adapter that authenticates, parses and appends | `cratis-engineering-effect-boundaries` |
| replay versus recovery redelivery | `[OnceOnly]` for replay; a receipt keyed by `ReactorDelivery.Id` for recovery | `cratis-chronicle-reactor` |

Stage 4.51.3 rendered apps pin Arc 22.50.5/Chronicle 19.32.0, so
`[ProtectedDecision]` and `DecisionRead<T>` are available to gap-fill, not
Stage-emitted enforcement. Admit the projection/key and enroll the read in the
active unit of work; never edit managed `Directory.Packages.props`.

## Faithful realization
A realization may choose the reactor, scheduler or queue mechanism. It may not: drop pending
visibility, add filters the model does not state, guess a field, or weaken authorization. Specify
the event-to-command mapping at the reaction boundary (a command-only spec does not exercise it).
An unsupported realization is a gap reported to delivery, never a silent change to the model.
After writing it, check it element by element against the slice with
`cratis-application-slice-conformance`.
