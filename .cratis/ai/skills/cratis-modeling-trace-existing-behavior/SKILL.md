---
name: cratis-modeling-trace-existing-behavior
description: Use when an existing codebase needs a candidate event model or its implemented behavior must be compared with an agreed model. Not for inferring intent from a recording (use cratis-screenplay-recover-intent).
---

# Trace one journey through existing code

Let the user choose a journey with a start and a result, such as a librarian registering an author and finding the name in the Authors list. Both modes are read-only: report what you find without changing code, data or model. Use synthetic values. No running target is required; do not inspect production by default. For a recording alone, [recover intent from the recording](../cratis-screenplay-recover-intent/SKILL.md).

## Choose the mode

- **Reconstruct current behavior.** Without an agreed baseline, trace the journey as implemented. Propose candidate slices and business facts separately from the implementation. Do not claim that anything changed since an earlier revision.
- **Compare with a baseline.** Identify the accepted examples or the named model revision, its acceptance status and the code revision being inspected. Note any included uncommitted changes. Compare the same actor, inputs, address and outcome on each side. If the actual code change range is known, use it to focus inspection, then follow affected callers and consumers beyond the diff. A difference does not decide which side should change.

## Follow the decision and its result

1. Start with the actor or trigger and the request contract. Follow the actual entry point through validation to the deciding handler. Trace a successful request and a meaningful refusal; if no refusal is known, mark the branch unresolved rather than inventing a rule.
2. Identify whose state changes, what the handler returns or writes, and how the result is persisted. For an event, separate the addressed event source from the payload. If the handler updates a row, say so: a proposed business fact is not an event the system emitted.
3. Follow the write to the reader. For a projection, trace both the row key and displayed values; follow the query to the visible result. Read existing specifications for the paths they actually exercise. A missing test is not a missing behavior.
4. Label each finding: **observed** (what a supplied run actually showed), **inferred from inspection** (what the wired implementation would do), **proposed fact** (candidate business meaning) or **unknown** (what would settle it). A screenshot of a row cannot identify its writer; static inspection does not establish that a request ran.

Stay within the authorized system and material. A reconstruction from public material is plausible, not proof of the private workflow. Inspect statically before proposing a run; a live write needs separate approval for the target and action. Do not bypass access controls to fill an evidence gap.

| Signal | What to trace before naming the slice |
| --- | --- |
| One gesture sends several requests or updates several tables | Find the decisions and transaction boundaries. Neither request count nor table count tells you how many business facts occurred. |
| Generic update route | Compare its callers: correcting a spelling and transferring ownership may have different actors, rules and outcomes. |
| A successful submission | Look for the actual uniqueness or duplicate-request rule. One success proves neither. Distinguish authenticated identity from editable form data. |
| Mock or seeded row | Treat the test as a hypothesis. Find the production path that could produce this state before proposing any history as `given`. |

Match the evidence to the enforcement point. Preserve the observed refusal text in `then error` for a `validate` or `require` rule; for authorization use `authorize` and `then denied`. A unique index is a candidate for an append-time constraint: find **every** fact that sets or changes the value before writing the rule. After acceptance, compare only the bounded revision or traffic interval in question. Reopen a slice when the command, message, access rule, fact or returned field changed. Moving unchanged logic into a new file changes the evidence location, not necessarily the model.

If static inspection leaves a gap and the owner proposes a generator or captured traffic, [check what the recovery tool may run or disclose](references/recovery-inputs.md) first.

## Example: compare Library registration and listing

Suppose the agreed examples require registration for Aster and refusal for a blank name. Use one table by slice and example. Mark each comparison **matched**, **changed** (different outcomes), **missing from model**, **missing from implementation** or **unverified**. In reconstruction, replace the baseline and status with candidate meaning; there is nothing to match against.

| Slice / example | Baseline | Finding |
|---|---|---|
| RegisterAuthor / librarian submits Aster | Record registration for author ID `11111111-1111-4111-8111-111111111111` | Matched by inspection: the handler returns `AuthorRegistered` with `Name = Aster` for that ID; the command pipeline appends it. |
| ListAuthors / read after registration | Show Aster under the same ID | Matched by inspection: the projection keys the row by event source and takes the name from the payload. Observed in the supplied screen result: Aster is visible, not the ID. |
| RegisterAuthor / blank name | Refuse; no registration | Unverified: the handler has no guard. Check the validator registered for this entry point or an existing request-level example; a handler-only test bypasses that decision. |

Take disputed intent to [timeline discovery](../cratis-modeling-discover-timeline/SKILL.md). Ask the requester, or their named decision owner, one batch of unresolved questions. If asked to proceed provisionally, state which outcomes remain unaccepted. Take confirmed changes to [slice design](../cratis-modeling-design-event-model/SKILL.md). Neither passing examples nor your judgment grant acceptance; an agreed example is not authorization to execute.
