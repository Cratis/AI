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

## Example: compare Library registration and listing

Suppose the agreed examples require registration for Aster and refusal for a blank name. Use one table by slice and example. Mark each comparison **matched**, **changed** (different outcomes), **missing from model**, **missing from implementation** or **unverified**. In reconstruction, replace the baseline and status with candidate meaning; there is nothing to match against.

| Slice / example | Baseline | Finding |
|---|---|---|
| RegisterAuthor / librarian submits Aster | Record registration for author ID `11111111-1111-4111-8111-111111111111` | Matched by inspection: the handler returns `AuthorRegistered` with `Name = Aster` for that ID; the command pipeline appends it. |
| ListAuthors / read after registration | Show Aster under the same ID | Matched by inspection: the projection keys the row by event source and takes the name from the payload. Observed in the supplied screen result: Aster is visible, not the ID. |
| RegisterAuthor / blank name | Refuse; no registration | Unverified: the handler has no guard. Check the validator registered for this entry point or an existing request-level example; a handler-only test bypasses that decision. |

Take disputed intent to [timeline discovery](../cratis-modeling-discover-timeline/SKILL.md). Ask the requester, or their named decision owner, one batch of unresolved questions. If asked to proceed provisionally, state which outcomes remain unaccepted. Take confirmed changes to [slice design](../cratis-modeling-design-event-model/SKILL.md). Neither passing examples nor your judgment grant acceptance; an agreed example is not authorization to execute.
