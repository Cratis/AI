# Fidelity check

## Contents

- Preconditions
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
  `cratis-screenplay-render-and-gap-fill`). Record the command, folder and version.
- The list of journeys comes from the evidence flows, each with its keep / change / remove
  decision. Only kept and changed journeys are walked; removed ones are listed as removed.
- The same test identities and example values as the original walk, on the new application only.
  Never repeat the walk against a system you do not own.

## Procedure

1. For each journey, replay the steps in the order observed, using the bounded walk rules of
   `../../cratis-screenplay-legacy-extraction/references/ui-observation.md` (budget, page text
   first, screenshots on state change).
2. At each step compare three things with the evidence rows: the visible state, the outcome of
   the action (success, the exact rejection text) and the read after the action.
3. Mark the journey **pass** when every kept step matches, or every difference is a decided
   change. Mark **fail** at the first undecided difference and say which step and which row.
4. Mark a journey **not run** with the reason when it was blocked (no identity, approval missing,
   run unavailable). Not run is never pass.

## Runnability

Passing `screenplay test` does not show that Stage can run the model. After `cratis run`:

1. Read `GET /stage/status`; the state must not be `unsupported`.
2. Execute one command over HTTP. A refusal naming an unsupported model format version means the
   toolchain is out of range: update it before changing the model. Send date-time values in the
   full round-trip form with fractional seconds and offset.
3. If a construct is refused (clock rules, application triggers, query-fed pickers), keep a
   runnable variant without it and record each dropped rule in `event-model.md` as a platform gap
   to file. Never keep an unrunnable rule as if it worked.
4. Check the toolchain is current (`gh release view` on the CLI, Screenplay and Stage
   repositories); across a major version run the documented migration, for example
   `screenplay migrate`.

## Result table

| journey | steps | result | first difference | evidence ids | next action |
|---|---|---|---|---|---|
| Reserve a berth | 5 | pass | none | E1, E2, E5 | none |
| Renew a membership | 3 | fail | step 2: no rejection shown for expired card | E8 | synthesis: add refusal |

Report counts: journeys walked, passed, failed, not run, removed.

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
- Keep walks read-only unless writes were approved for the target. Writes on the new
  application still need approval naming it.
- A pass list is not a coverage claim: report what was not walked.
