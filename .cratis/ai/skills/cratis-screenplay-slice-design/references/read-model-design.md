# Read-model design

## Start from the consumer

List every consumer before designing any read model: each screen area a person looks at, and
each automation that needs to decide something. A read model exists for a consumer; a read
model nobody uses is a question.

For each consumer: what does it show or decide, for which instance or set, and for whom? How
stale may it be, and what does a stale answer cost? For each field: what does the person decide
or do with it? A field with no decision behind it is a question, not a requirement.

A screen that acts on an existing instance needs a view: it supplies the identifier the command
needs and the state the person decides on. Only a creation screen with nothing to show is
exempt; state the exemption.

## Components

- A component is an area of a screen a person would describe as one thing ("the locker list",
  "my request status"). Most screens have one.
- One read model per component. Split when a person would point at two areas and name them
  differently, or when one area needs facts from many events and another needs only one or
  two - they change for different reasons and at different speeds.
- A homogeneous list is one component.

## Fan-in per field

For each read-model field, count the events that set it. More than about three is a signal to
look at, not a rule: a status fed by a long lifecycle is normal. Ask whether the field mixes
concerns that should be separate views, and whether every contributing event is genuinely a
change to *this* value. Report a problem only when it has a consequence (coupling, a view that
must change whenever unrelated facts change).

## Builder and freshness

Observable delivery does not make a materialized projection decision-consistent; a protected
decision needs a guarded read (`rule-layers.md`, `cratis-screenplay-streams-and-consistency`). Prefer a
declarative projection (mappings, event joins, counters, bounded children, removals); a join
consumes event facts, not another read model. Use a reducer when prior-state, attempt or
ordering guards cannot be expressed declaratively. Review every writer of a property: AutoMap
can introduce updates from other events. Use variants only when lifecycle stages have different
shapes. Keep growing histories in a separate view; never combine several people's PII under
one read-model instance (compose queries across person-scoped views instead).

Every `from` event must set or affect a field (AutoMap counts); otherwise drop it or record why
it stays.

## Query shape follows the business view

| The person... | Design-mode query | Executable/renderable scope |
|---|---|---|
| opens one thing | `XById => RM optional` + `by xId XId` | same (the only shape that binds today) |
| scans a list | `ListX => RM[]` (optionally `observable`, `filter`) | keep the list for design; add the keyed query; record V3 blocked by the list |
| sees their own rows | list with scope/`from` on the caller | as above; access rules are part of the view, enforced by the target |
| sees a site-wide figure | singleton read model, `from <Event> key literal "global"` on every `from` (a projection-level `key` routes nothing, PLAY0381; example in Screenplay `projections/keys.md`, "Literal keys") | check the binding (V3, `cratis-screenplay-toolchain`) |

- `observable` when people are expected to see others' or automation's changes while looking
  (worklists, status awaiting an outside answer); one-shot otherwise. Design mode only
  (PLAY0268). If access can be revoked mid-session, record that the target re-checks per emission.
- Never model paging or page size (no syntax, Screenplay#140). State the order in the query
  `description` ("oldest first"); an unbounded list is a review question.
- A gated keyed query needs its own denial spec.

Never drop a list query from a design model just to make it bind; record the capability gap.
The keyed query also defines the read model's identity: its `by` property must be a read-model
property, filled with `$eventSourceId` (or a `key` on another stream's event).

## No clock-relative state

"Overdue", "expired", "due in 3 days" are true now and false later; a view changes only when a
fact arrives. Store the deadline (business-supplied) and compare at the query or screen edge.
Record a fact only when passing the deadline is itself a business fact (a fee charged, a
reminder sent): a clock-triggered reaction (`cratis-screenplay-automations-and-translations`).

## Who may see what

- `by` and `filter` are values the caller chooses. Anything the caller must not choose (their
  own identity, the tenant) comes from context (`from $context...`), never from a filter.
- `scoped to global` reaches past the tenant; treat it as a review question.
- A compiling query is not access control; the target realises it.

## Collections and many-at-once

Ask for each field: can there be more than one at the same time? If yes, the view is a list or
has children, not a single value.

## Building it

- Same-named event properties fill read-model properties automatically (AutoMap,
  case-sensitive); map explicitly when names differ or when AutoMap would copy a value you do
  not want.
- Status words are literals per event (`state = "waiting"` on the request event).
- Removal is a fact: `remove with <Event>` when the business ends the instance's visibility.
- Projection mechanics (keys, joins, children, counters): `cratis-screenplay-projections`.
- A read model that is not built from events uses a query `performer`; its data is outside the
  model's lineage - say where it comes from.

## Omissions are decisions

If a view must stop showing cancelled items, use `remove with <Event>` and pin it with
`then no readmodel <RM> for "<key>"`. If it keeps them, map a status literal from that event
instead. The slice `description`, the projection and every spec of the view must agree.
A complete example (marina berths; the `then no readmodel` assertion needs the keyed
query, which is why the view has one):

```screenplay
domain Harbourlight.Berths

concept BookingId : Uuid
concept BerthName : String
  validate
    not empty  message "A berth needs a name"
concept BookingState : Enum
  open
  cancelled

policy IsAuthenticated
  require authenticated

module Berths
  description "Berth bookings for one marina"
  authorize IsAuthenticated
  feature Bookings
    slice StateChange BookBerth
      description "A skipper books a berth"
      command BookBerth
        bookingId BookingId identifier
        berth BerthName
        produces BerthBooked
          for bookingId
          berth = berth
      event BerthBooked
        berth BerthName
      specification BookingABerth
        given caller
          authenticated
        when BookBerth
          bookingId = "3b0c7a14-5d2e-4f61-8a9b-0c1d2e3f4a01"
          berth = "Pier 2, berth 14"
        then BerthBooked
          for "3b0c7a14-5d2e-4f61-8a9b-0c1d2e3f4a01"
          berth = "Pier 2, berth 14"

    slice StateChange CancelBooking
      description "A skipper cancels a booking they no longer need"
      command CancelBooking
        bookingId BookingId identifier
        produces BookingCancelled
          for bookingId
      event BookingCancelled

    slice StateView OpenBookings
      description "The harbour office lists bookings that still hold a berth. BerthBooked sets berth: the booking enters the list. BookingCancelled removes it: a cancelled booking never shows."
      readmodel OpenBooking
        bookingId BookingId
        berth BerthName
      query OpenBookingById => OpenBooking optional
        by bookingId BookingId
      projection OpenBookings => OpenBooking
        from BerthBooked
          bookingId = $eventSourceId
          berth = berth
        remove with BookingCancelled
      screen OpenBooking
        title "Open booking"
        data OpenBooking via query OpenBookingById
        action CancelBooking
      specification CancelledBookingLeavesTheList
        given caller
          authenticated
        given BerthBooked
          for "3b0c7a14-5d2e-4f61-8a9b-0c1d2e3f4a01"
          berth = "Pier 2, berth 14"
        given BookingCancelled
          for "3b0c7a14-5d2e-4f61-8a9b-0c1d2e3f4a01"
        then no readmodel OpenBooking for "3b0c7a14-5d2e-4f61-8a9b-0c1d2e3f4a01"
```

## Checks before handing off

- The StateView slice `description` gives, per contributing event, the fields it sets and why
  (see `LockerBoard` in `worked-example.md`); extend it whenever a `from` is added.
- Every consumer has its read model; every read model has a consumer.
- Every field traced (`field-lineage.md`).
- Executable/renderable scope: one keyed query per read model, `by` property mapped from
  `$eventSourceId` or a key.
- Design-only shapes listed with the V3 code they cause.
