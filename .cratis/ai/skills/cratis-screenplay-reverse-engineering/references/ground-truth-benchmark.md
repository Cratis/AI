# Ground-truth fidelity benchmark

Measures how closely a model rebuilt from observation matches an application whose own model is
known. Use it to judge a skill change: run the same app and the same inputs before and after, and
compare two scores. It needs an application you own, with its original model and source.

## Contents

- Rubric
- Scores
- Procedure
- Quirk classification
- Regression-suite convention

## Rubric

Compare the rebuilt model with the original, category by category, as an inventory: each original
item is exact, renamed, partial or missing; each rebuilt item with no original is extra.

| Category | Weight | Counted |
|---|---|---|
| Commands | .20 | names and fields |
| Events | .15 | names and fields |
| Read models and queries | .15 | fields, and queries |
| Screens | .15 | screens and their actions |
| Constraints and validation | .15 | rules on commands and concepts |
| Concepts | .10 | concept types |
| Specifications | .03 | scenarios |
| Hand-written rules | .07 | rules that live in code, not in the model |

Per category report recall (original items found) and precision (rebuilt items that exist in the
original). Score a category as `(structural exact + 0.5 x partial) / original items`; use recall
alone where precision is 1. Structural match compares names and base types; strict match also
compares concept types. Fidelity is `sum(weight x score)`.

## Scores

Two summary scores carry the result; quote only these:

- **Structure**: commands, events, read models, screens and concepts.
- **Rules**: constraints and validation, hand-written rules and specifications.

A model often gets the structure right and the rules wrong or missing; the split shows it.

## Procedure

1. **Blind run.** The runner rebuilds the model from the running app and its allowed inputs, with
   the original model and source hidden from it.
   Blind-run hygiene: the run under test never reads prior scoring, fidelity reports or the
   original model before its own model is final. Artifacts the original serves that restate its
   model (for a Stage/Arc original: the served scene and generated proxies) are excluded, or
   recorded as a separate evidence class and reported, because they inflate structure scores.
2. **Compare** on read-only copies of both models and the source. Read the generated source for
   behavior ground truth. Do not re-run the rebuilt model's own checks as part of the scoring.
3. **Classify quirks** (below) before counting a difference against the skill.
4. **Rerun after each skill change** on the same app with the same inputs and weights. If a change
   alters the weights or categories, change this rubric in the same edit.
5. **Record** the full result in the lane's untracked `.ai-work/` folder; quote only the two
   scores in an issue or pull request. Scores never enter the corpus.

## Quirk classification

Mark each difference as one of:

- **original defect**: the original behaves oddly and the rebuild copied what was observed.
- **misreading**: the rebuild read the evidence wrongly or invented a rule.
- **correct**: the rebuild is right and the original model differs only in form.

Only misreadings and missing items count against the skill.

## Regression-suite convention

Each platform issue found by a benchmark app (in Screenplay or Stage) gets a minimal model that
should validate and run once the issue is fixed, kept with that issue. This reference names the
convention only; it does not claim a tracked suite.
