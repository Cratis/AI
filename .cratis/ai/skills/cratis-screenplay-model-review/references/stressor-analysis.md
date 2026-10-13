# Stressor analysis (optional resilience pass)

The critic review asks whether the model is correct and complete. This pass asks how the model
behaves when the world changes: an outside partner disappears, a rule of law changes, a person
leaves. Run it on request, or for business-critical scope, after the critic review and before
acceptance. It reads the model and proposes edit requests; it never edits. The method is
residuality theory (Barry O'Reilly), applied to event models in the Eventmodelers work of
Martin Dilger and Nebulit GmbH; the wording here is our own.

## Contents

- Procedure
- Incidence matrix
- Redesign proposals
- Output

## Procedure

1. **Scope, read once.** One feature or module at a fixed source revision. Inventory its slices,
   commands, events, read models, reactions, captures and personas from the `.play` files or the
   MCP views, never from memory.
2. **Stressors.** About fifteen, deliberately wide, in business words and without mechanics. Draw
   most from outside the model (people, law, market, nature, partners, the organization itself)
   and the rest from inside the domain. Alternate the two. Their value is variety, not
   likelihood.
3. **Residue per stressor.** One sentence each: which slices still work, which facts are still
   recorded, which views go stale or wrong, who is not told. A residue is observed, not
   designed. A fix is not a residue.
4. **The person decides** which residues are unacceptable, because that is a business decision.
   Unattended, record each as a question with an assumed default (lifecycle
   `references/stop-or-assume.md`) and say so in the report.
5. **Incidence matrix** (below). Name the shared cause of every cluster.
6. **Redesign proposals** for one cluster at a time (below). State the new residue for each
   stressor.
7. **Validate with fresh stressors** not used before. Report the share of acceptable residues
   before and after. Stop when new stressors stop hitting declarations that were not hit before.

Do not invent requirements. A stressor is a question about the business, answered by the person,
not a feature to add.

## Incidence matrix

A Markdown table in the review report: one row per declaration a stressor hits, one column per
unacceptable stressor, sorted by how many stressors hit the row. Declarations hit by the same
stressors are hidden coupling: name the shared cause (one outside system, one persona, one
clock). A cluster that crosses modules is boundary evidence for
`cratis-screenplay-streams-and-consistency`.

| Declaration | Partner outage | Law change | Key person leaves | Hits |
|---|---|---|---|---|
| `ConfirmPayment` | x | x | | 2 |
| `PaymentStatus` | x | | x | 2 |

## Redesign proposals

Each proposal is an edit request, written like every other review fix (address, change,
reason). Typical shapes, most of them Translate or Automation slices
(`cratis-screenplay-automations-and-translations`):

- an outside dependency: a `capture` and a Translate slice, so outside facts arrive as our own
  events instead of being read live;
- reconciliation: a todo-list view plus a `reaction`, so work that could not finish is visible
  and retried;
- a grace period or expiry: an event raised on a clock trigger;
- a blocked actor: a second command origin or persona;
- an undo: a compensating command.

Persisted events and accepted slices are not changed. New slices go beside them, and identity
ownership follows the lifecycle (`cratis-screenplay-modeling-lifecycle`).

## Output

The matrix plus the edit requests, in the review report. Every finding is pinned to a
declaration like any other finding.
