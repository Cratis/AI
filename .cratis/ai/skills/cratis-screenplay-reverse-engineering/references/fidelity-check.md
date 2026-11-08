# Fidelity check

After the model runs, walk the observed journeys again on the running application and compare.
The check measures how closely the re-imagined app reproduces what was kept; it is not a proof
of equivalence, and changed or removed slices are expected to differ.

## Contents

- Preconditions
- Procedure
- Result table
- Feeding gaps back
- Limits

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

## Result table

| journey | steps | result | first difference | evidence ids | next action |
|---|---|---|---|---|---|
| Reserve a berth | 5 | pass | none | E1, E2, E5 | none |
| Renew a membership | 3 | fail | step 2: no rejection shown for expired card | E8 | synthesis: add refusal |

Report counts: journeys walked, passed, failed, not run, removed.

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
