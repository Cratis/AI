---
name: cratis-platform-deliver-slice
description: Use when implementing a vertical slice end to end, from command input to an observable screen change. Not for changing only the command (use cratis-arc-declare-command).
compatibility: Requires a Library .NET host, MongoDB, Chronicle, generated TypeScript client and Playwright Chromium.
---

# Register an author and show the new row

Connect the registration state change to the consuming authors state view. Use the agreed Given/When/Then as the delivery check: given a disposable Library namespace with no authors, when the librarian enters and submits Aster, then the open list gains one row named Aster. `AddAuthor` sets the command's `id` with `Guid.create()`; the test does not supply an ID.

1. Configure the [host](../cratis-arc-host-application/SKILL.md), [Chronicle connection](../cratis-chronicle-connect-application/SKILL.md) and [MongoDB storage](../cratis-arc-connect-storage/SKILL.md).
2. In `Features/Authors/Registration/RegisterAuthor.cs`, use [RegisterAuthor](../cratis-arc-declare-command/SKILL.md) and [RegisterAuthorValidator](../cratis-arc-validate-command/SKILL.md). Return [AuthorRegistered](../cratis-chronicle-record-event/SKILL.md) from `Handle()`. Only `Id` selects the author history. For a command on an existing history, reuse the supplied ID. If it is not typed as an event-source ID, select the positional property with `[property: Key]` using `Cratis.Chronicle.Keys`.
3. In `Features/Authors/Listing/Author.cs`, use the [Author projection](../cratis-chronicle-project-view/SKILL.md). `Author.Id` comes from the event source and `Author.Name` from the payload. Add the [AllAuthors query](../cratis-arc-expose-query/SKILL.md) to that record; do not create another `Author` declaration.
4. Run `dotnet build` on the backend with [proxy generation configured](../cratis-arc-generate-proxies/SKILL.md). Use the generated files under `generated/Features/Authors/`; do not copy them beside the screen.
5. Submit the generated command from [AddAuthor](../cratis-components-submit-form/SKILL.md) in `Features/Authors/Registration/AddAuthor.tsx`. Use the [Authors DataPage](../cratis-components-display-list/SKILL.md) in `Features/Authors/Listing/Authors.tsx` with the generated `AllAuthors` query. Supply its `onOpen` callback from the Library shell. Do not build a second listing screen.

## When delivery starts from a Screenplay model

Use the selected target renderer for supported behavior. Choose app-owned implementation for an explicitly assigned gap; keep it outside renderer-managed files so regeneration preserves it. Map each accepted outcome to a named test in the actual target. Mark generated tests, app-owned gap tests, and outcomes not implemented; run each implemented test. A passing build or a test count cannot identify which refusal or state view was covered.

## Check the running application

Open the Authors list as the librarian. Choose **Add author**, enter **Aster**, submit once and wait for the new row without reloading. Fetch `AllAuthors` once as the same librarian using the [live query diagnostic](../cratis-arc-diagnose-live-query/SKILL.md). Check that exactly one result has `name` equal to `Aster` and record its `id`. Reload the screen, fetch again and check that the one Aster row has the same `id`.

Run the [empty-name backend specification](../cratis-specifications-exercise-backend/SKILL.md) for `Name is required` and no additional event. To check the full refusal path, send that invalid command through the authenticated API in the disposable namespace. Require a validation refusal, no append at the attempted author ID, and the same author IDs and names in the open list and in a fresh `AllAuthors` result. A dialog preventing blank submission is a UI check, not evidence of a backend refusal.

## When it goes off the usual path

- **The accepted row is missing or appears only after reload:** [trace the missing update](../cratis-platform-diagnose-slice/SKILL.md) in the same namespace before changing the form or projection.

## Avoid

- Don't append from both the command handler and the pipeline; return the event once.
- Don't insert a second local row on success; the observable query supplies the list.

## Related skills

- [Trace a missing update](../cratis-platform-diagnose-slice/SKILL.md) if registration succeeds but the screen stays unchanged.

- [Exercise the backend](../cratis-specifications-exercise-backend/SKILL.md) to assert the append and refusal.
- [Observe the UI](../cratis-specifications-observe-ui/SKILL.md) for the local interaction check.
