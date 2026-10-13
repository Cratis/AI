# Re-entry and layered passes

Legacy extraction runs over many sessions on a system that keeps changing. Two habits keep it
bounded and honest: come back by recorded source identity instead of rereading everything, and
widen the candidate in layers instead of producing one huge shallow-everywhere model. Both live in
`EVIDENCE.md` (`evidence-table-template.md`) and sit beside the evidence stages L0-L4: L0-L4 say
*how strong* the evidence is, passes say *how much of the system* is in scope.

## 1. Re-entry (first step of every run after the first)

Reuse the source identity defined in `cratis-screenplay-modeling-lifecycle`
(`references/verdicts-and-modes.md`, "Source identity"): the commit plus the digest of the examined
inputs. Do not invent a second definition. Git is used read-only: `git -C <legacy-repo>` queries
only, never a checkout, reset or stash, and never in the live checkout when the brief forbids
touching it.

Per feature, take the identity from the last row of its analysis history (evidence template,
section "Analysis history"), then:

1. `git -C <repo> merge-base --is-ancestor <commit> HEAD` : is the recorded commit still an ancestor?
2. `git -C <repo> log --reverse --oneline <commit>..HEAD -- <feature folders>` : what touched the
   feature since, oldest first. The folders come from the feature's "Where it lives" table.
3. `git -C <repo> status --porcelain -- <feature folders>` : uncommitted changes count too.

Then decide per feature:

| Finding | Action |
|---|---|
| Nothing touched the feature folders | Leave the feature alone. Say "unchanged since the recorded identity". |
| Files changed | Reread only those files. Refresh the `path:start-end` locators that point into them. Mark every evidence row whose locator moved or vanished `stale` until reread, then update or retire it. Re-apply the decisions that depended on those rows and ask about what the diff cannot explain. |
| Files changed outside every feature's folders | Candidates for a new feature or a missing "Where it lives" entry. Ask before adding. |
| Commit no longer reachable (rewritten history), no git at all, or the recorded identity was dirty | Reread that feature in full (for a dirty identity, at least the files the diff names plus the files that were dirty then). Say so in the history row. |

Every run appends a row to each feature's analysis history, including a run that found no change.
Rows are append-only.

### Freeze verification

When the interview recorded a freeze agreement, the same commands over the legacy repository
*check* it: any behavior change since the recorded identity is reported against the freeze boundary
(`interview-findings.md`) before more evidence is gathered. A broken freeze makes the candidate
stale for the affected features; it never silently passes. A documentation-only extraction that
recorded "freeze not applicable" skips this.

### Relation to the model

Re-entry refreshes *evidence*. It never edits an accepted model on its own: a changed behavior that
affects an accepted model is a model edit request through the modeler, review and acceptance
(`cratis-screenplay-modeling-lifecycle`). Evidence for a model that does not exist yet is the only
place where "update the candidate to match what was reread" is the default.

## 2. Breadth first, then one feature per pass

| Pass | Scope | Contents |
|---|---|---|
| 0 | whole system | Modules and features only, one feature per user journey, with the milestone events in story order. No properties, no specifications. Each ordering claim names its source. |
| 1 | one feature | Slices with identity and the business-critical properties, the success specification, the one or two rules that matter, screens only where a person decides. |
| 2 and later | the same feature | Full properties, rejection and denial specifications from code and tests, reactions, translations, alternate paths. |

"Deeper" means more business: decisions, rules, failure modes. It never means more technical detail.
Every pass still cites evidence; passes widen the scope, they do not relax the evidence rules.

Grouping rule: code is split by operation (create, find, show and update endpoints); a feature is
the journey that uses them, so register, find, view and update of one thing are one feature. When in
doubt, merge. A pass that finds sub-journeys offers them as new features instead of growing the
current one.

Pass 0 order: ask which feature to deepen next. Unattended, choose by risk and available evidence,
and say that you chose. Features still at Pass 0 are `not yet extracted` in the loss report; they are
never counted as done. A partial candidate may go to review when its loss report lists them (the
Gate in `../SKILL.md` then applies to the extracted scope).

End every pass with: what changed, the sub-journeys found, the open questions, and the choice
"which feature next, deeper here, or stop".

A Pass 0 skeleton compiles as a normal candidate:

```screenplay
domain Clinic.Visits

module Visits
  description "Pass 0 skeleton. Lives in: src/Visits (API), db/visits (schema). Evidence: E1, E2"
  feature BookingAVisit
    description "Story: PetRegistered, then VisitBooked, then VisitCompleted or VisitCancelled. Order source: UI walk E2, confirmed by the clinic expert; VisitCancelled after VisitBooked is assumed (Q3). Not yet extracted: properties, rules, specifications"
    slice StateChange BookVisit
      description "Pass 0. Evidence: E1"
      command BookVisit
        produces event VisitBooked
```
