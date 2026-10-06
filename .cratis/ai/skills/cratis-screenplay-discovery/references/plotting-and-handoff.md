# Plotting the story and handing it on

Plotting arranges the discovered events as a narrative: what happens first, what depends on
what, what can happen instead, where it ends. In Screenplay the plot is written into the
model (slice and feature `description` text) and into STATE.md; files sort by name, so story
order is never carried by structure.

## 1. Sequence

Walk one workflow at a time, from its first trigger to every end. Ask, at each event:
what came before it, what made it happen, what is it only allowed under?

## 2. Record after / caused by / only if

Write these three into the `description` of the `StateChange` slice that produces the event:

```text
After:     BerthRequested
Caused by: Harbourmaster (decides)
Only if:   a free berth is at least as long as the boat (intent, not enforced in the model today)
```

- **After** is the story predecessor. A predecessor is not the same as a cause; record both.
- **Caused by** is a persona's action, a schedule, an outside party or another fact.
- **Only if** is intent. Later phases turn it into a rule layer, `reads` + `require`, a
  constraint, or a recorded target requirement (`cratis-screenplay-slice-design`,
  `cratis-screenplay-streams-and-consistency`), and into state-violation specs
  (`cratis-screenplay-scenario-coverage`). A rule that depends on stored state is stated
  intent and is marked not enforced in the model today; never copy state into a command input
  to make it look enforced.

A starting event has no *after*; it still has a cause.

## 3. Ask what can happen instead

At every event, not only at forks someone mentions:

- What can happen next *instead*, including nothing? Does "nothing" expire, or wait forever?
- Which next steps may happen in any order, and which must wait for each other? Unordered
  successors become automations or ordering specs later; say so in the feature description.
- On failure or refusal, what compensates, and is the refusal itself a fact the business must
  remember (a decision) or just a rejection (a scenario later)?

Classify each fork: *outcome branch* (one decision, mutually exclusive results: same feature,
sibling events) or *separate story* (the choice is made before the process starts and
everything after differs: its own feature).

Name every terminal state (completed, cancelled, expired, withdrawn) and every undo or
correction path. Each path with a way out feeds removal specs later (an ending removes the
thing from the views that listed it).

## 4. Plot output format

Put a compact story line in the feature `description` and report the plot per workflow:

```text
The plot: SeasonalBerths

1. BerthRequested         start; caused by BoatOwner
2. BerthAssigned          after 1; caused by Harbourmaster; only if a free berth fits
   BerthRequestDeclined   after 1; caused by Harbourmaster (instead of 2)
3. BoatArrived            after 2; caused by Harbourmaster
4. BoatDeparted           after 3; caused by schedule (season end)   terminal
   BerthAssignmentWithdrawn after 2, before 3; caused by Harbourmaster   terminal

Critical path:  1 -> 2 -> 3 -> 4
Decision points: after 1 (assign or decline); after 2 (arrive or withdraw)
Terminal facts: BerthRequestDeclined, BoatDeparted, BerthAssignmentWithdrawn
Wait states:    after 2, until the boat arrives (what if it never does? open question)
Compensation:   withdrawal frees the berth for the waiting list (open question)
```

For a diagram use `cratis-event-model-diagram`.

## 5. Plot checks

- Every event except a starting one has a predecessor *and* a cause.
- Dependencies and alternative paths are written down, not implied.
- Terminal states are clear; compensation and cancellation flows are complete.
- Every brainstormed event appears in the plot or in the set-aside list with the reason.
- The plot makes business sense when read aloud in order.

## Handoff packet to `cratis-screenplay-slice-design`

The structure and section order of the packet are in `cratis-screenplay-modeling-lifecycle`.
What discovery contributes:

| Section | Content |
|---|---|
| Workflows covered | per feature: goal, happy path, decision points, terminal facts |
| Subjects | what each event story is about and what tells two apart (for later `for`/streams) |
| Rules register | each rule, the slice it constrains, intent text, target enforcement if state-dependent |
| Denial candidates | every Cannot line with its pending resolution |
| Competition candidates | scarce things two parties may want at once; who wins |
| Duplicate candidates | requests that may arrive twice |
| Non-human causes | schedules, outside parties, own follow-up |
| Hotspots | where it goes wrong today |
| Set aside | non-events kept as view needs |
| Open questions | the blocking one first |
| Decisions and assumptions | kept apart; each assumption with its reason |
| Verdicts | V1 result with tool and version; V2 to V5 "not run: discovery phase" |

Seeds for later skills:

| Discovery item | Becomes (not decided here) |
|---|---|
| Cannot line | a gate and `then denied` spec, or a recorded gap |
| "Only if" | a rule layer / `require` / constraint, or a recorded target requirement |
| Competition candidate | a competing-claim spec; consistency design |
| Duplicate candidate | a duplicate or retry spec |
| Ending | removal from affected views |
