# Fidelity check

## Contents

- Preconditions
- Behavior ledger
- Procedure
- Runnability
- Result table
- Use it as a user
- Feeding gaps back
- Limits

After the model runs, walk the observed journeys again on the running application and compare.
The check measures how closely the re-imagined app reproduces what was kept; it is not a proof
of equivalence, and changed or removed slices are expected to differ.

## Preconditions

- The model was accepted or is explicitly named as a draft, and a run exists
  (`cratis run <model folder>`, or a rendered application started per
  `cratis-screenplay-render-and-gap-fill`). Record the command, folder, model commit, toolchain
  version and the evidence captures used (name or hash), so the result can be reproduced.
- The list of journeys comes from the evidence flows, each with its keep / change / remove
  decision. Only kept and changed journeys are walked; removed ones are listed as removed.
- The same test identities and example values as the original walk, on the new application only.
  Never repeat the walk against a system you do not own.

## Behavior ledger

Before the walk, list each kept observed behavior (command accepted, rejection with its text,
read after write, visibility rule) as a row: an id, its evidence ids and the case kinds the
evidence shows (positive, refusal, malformed, repeat). A journey passes only when every row it
covers has a walked case on the running app; a row with no walked case is **open**, never pass.
A model change revises the affected rows, and an earlier pass does not carry over.

## Procedure

1. For each journey, replay the steps in the order observed, using the bounded walk rules of
   `../../cratis-screenplay-legacy-extraction/references/ui-observation.md` (budget, page text
   first, screenshots on state change).
2. At each step compare three things with the evidence rows: the visible state, the outcome of
   the action (success, the exact rejection text) and the read after the action.
3. Mark the journey **pass** when every kept step matches, or every difference is a decided
   change. Mark **fail** at the first undecided difference and say which step and which row.
4. Mark a journey **not run** with the reason when it was blocked (no identity, approval missing,
   run unavailable). Mark it **undecided** when an observation was unreadable, truncated or
   nondeterministic, and name the missing observation. Not run and undecided never count as pass.
5. **Negative control.** For each pass-critical check, show it can fail: run it once against the
   state before the action, or with a deliberately wrong value, and expect a fail. A check that
   passes both ways verifies nothing; drop it.
6. **Probe the original (optional).** Only where the original is owned or permitted and reads are
   approved, replay a few read cases the capture did not make on both systems and diff status,
   fields, order and values. Normalize ids and clocks only where the evidence shows they are
   generated. Writes need the usual approval; unobserved parts are listed, not counted as agreement.

## Runnability

Passing `screenplay test` does not show that Stage can run the model. After `cratis run`:

1. Read `GET /stage/status`; the state must not be `unsupported`.
2. Execute one command over HTTP. A refusal naming an unsupported model format version means the
   toolchain is out of range: update it before changing the model. Send date-time values in the
   full round-trip form with fractional seconds and offset.
3. If a construct is refused (clock rules, application triggers, query-fed pickers), the complete
   model stays the deliverable: keep the refused rule in it and report the blocked scope as a
   platform gap in `event-model.md`. To walk the rest, run a copy without the refused construct;
   that copy exists only for the run and the walk and is never accepted, rendered or handed over
   as the model.
4. Check the toolchain is current (`gh release view` on the CLI, Screenplay and Stage
   repositories); across a major version run the documented migration, for example
   `screenplay migrate`.

## Result table

| journey | steps | result | first difference | evidence ids | next action |
|---|---|---|---|---|---|
| Reserve a berth | 5 | pass | none | E1, E2, E5 | none |
| Renew a membership | 3 | fail | step 2: no rejection shown for expired card | E8 | synthesis: add refusal |

Report counts: journeys walked, passed, failed, undecided, not run, removed.

## Use it as a user

A journey table can pass while the app is unusable. Walk the main journeys in a real browser
(the browser tools, or the Lens extension for switching sandbox users) the way someone who
knows the original product would. A script or HTTP harness does not replace this.

- Start where a user starts: `/`, the sidebar and the home link. Check that each lands on the
  screen it names, not on a command form, and that the landing screen is the first sidebar item.
- **Click every action for real**, as each sandbox user: is it enabled after a row is selected,
  does the dialog open and is it visible, do Cancel and Escape close it, does submit give success
  or a readable message (not engine text), does the list refresh. Watch the console and network
  for errors, and for validation errors shown before the user typed anything.
- **Freeze check.** If nothing shows after a click, test whether the app root is inert with no
  visible dialog (an off-screen or unstyled dialog); Escape usually recovers. A page left
  unresponsive is a platform bug to record.
- **Privacy and visibility.** As a second user, check that public feeds and pickers do not list
  another user's private records and that owner-only actions are refused or hidden.
- Pickers and rows show display values; a command asks nothing the user cannot know.
- Create the data you need through the UI. Typing a generated id, an empty list after a restart,
  or a missing input in a dialog are findings.
- At each step, note what a user of the original would miss or want: a filter, a default view
  (archived items hidden), a column that renders badly, a confusing label, an error that shows
  internal text.
- Record each finding as **bug**, **missing feature** or **wish**, and classify its owner:
  **model** (fix now, then re-walk), **skill** (missing guidance) or **platform** (the Screenplay
  language or compiler, the Stage runtime or UI, or the CLI). Check the owning repository for an
  existing issue before drafting a new one, and keep local paths out of the draft.

| step | expected (original) | actual | kind | owner | next action |
|---|---|---|---|---|---|
| Sidebar "Projects" | project list | "New project" form | bug | platform | issue: landing screen |
| New project | type a title | asked for a GUID | bug | model | generate the id |

## Feeding gaps back

- A fail returns to synthesis with its evidence ids: add or change the slice through the MCP
  loop, re-run, and re-walk only that journey.
- A run blocked by Stage or the renderer is a finding for `cratis-screenplay-render-and-gap-fill`
  and `cratis-stage-rendering-and-sandbox`; do not hand-edit around it.
- A new behavior seen on the running app that has no evidence row is not a gap in the original;
  record it as a model addition for the human to decide.

## Limits

- **Only claim effects the capture confirms.** A journey that passes shows the visible states
  and responses matched what was captured. It says nothing about rules, concurrency or data the
  capture never exercised.
- **Authority must match the claim.** A visible UI result cannot close a claim about a server
  rule, uniqueness, authorization or concurrency. Such a row needs a probe that exercises the rule
  (second identity, repeat, boundary) or stays unknown; a static-only row cannot close a runtime
  claim.
- An effect not confirmed by a later read (create without read-back, update with side effects) is
  recorded as **withheld** with the reason and what to observe next, and is not specified as
  fact. Re-observe at most twice; stop on a side effect or a contradiction.
- Keep walks read-only unless writes were approved for the target. Writes on the new
  application still need approval naming it.
- A pass list is not a coverage claim: report what was not walked.
