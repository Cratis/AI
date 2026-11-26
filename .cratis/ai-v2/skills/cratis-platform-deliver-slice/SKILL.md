---
name: cratis-platform-deliver-slice
description: Use when implementing a vertical slice end to end, from command input to an observable screen change. Not for changing only the command (use cratis-arc-declare-command).
compatibility: Requires a Library .NET host, MongoDB, Chronicle, generated TypeScript client and Playwright Chromium.
---

# Register an author and show the new row

Use a disposable Library namespace with no authors. The librarian enters Aster. `AddAuthor` sets the command's `id` with `Guid.create()`; the test does not supply an ID. The open list must gain one row named Aster.

1. Configure the [host](../cratis-arc-host-application/SKILL.md), [Chronicle connection](../cratis-chronicle-connect-application/SKILL.md) and [MongoDB storage](../cratis-arc-connect-storage/SKILL.md).
2. In `Features/Authors/Registration/RegisterAuthor.cs`, use [RegisterAuthor](../cratis-arc-declare-command/SKILL.md) and [RegisterAuthorValidator](../cratis-arc-validate-command/SKILL.md). Return [AuthorRegistered](../cratis-chronicle-record-event/SKILL.md) from `Handle()`. Only `Id` selects the author history.
3. In `Features/Authors/Listing/Author.cs`, use the [Author projection](../cratis-chronicle-project-view/SKILL.md). `Author.Id` comes from the event source and `Author.Name` from the payload. Add the [AllAuthors query](../cratis-arc-expose-query/SKILL.md) to that record; do not create another `Author` declaration.
4. Run `dotnet build` on the backend with [proxy generation configured](../cratis-arc-generate-proxies/SKILL.md). Use the generated files under `generated/Features/Authors/`; do not copy them beside the screen.
5. Submit the generated command from [AddAuthor](../cratis-components-submit-form/SKILL.md) in `Features/Authors/Registration/AddAuthor.tsx`. Use the [Authors DataPage](../cratis-components-display-list/SKILL.md) in `Features/Authors/Listing/Authors.tsx` with the generated `AllAuthors` query. Supply its `onOpen` callback from the Library shell. Do not build a second listing screen.

## Check the running application

Open the Authors list as the librarian. Choose **Add author**, enter **Aster**, submit once and wait for the new row without reloading. Fetch `AllAuthors` once as the same librarian using the [live query diagnostic](../cratis-arc-diagnose-live-query/SKILL.md). Check that exactly one result has `name` equal to `Aster` and record its `id`. Reload the screen, fetch again and check that the one Aster row has the same `id`. A row appearing only after reload requires a [live query check](../cratis-arc-diagnose-live-query/SKILL.md).

Run the [empty-name backend specification](../cratis-specifications-exercise-backend/SKILL.md): in its own `CommandScenario<RegisterAuthor>`, `await _scenario.Execute(new RegisterAuthor(AuthorId.New(), ""))` must fail validation with `Name is required` and append no events. This is an isolated backend check, not a submission to the browser's Library namespace. A dialog preventing blank submission is a UI check, not a backend refusal test.

## Avoid

- Don't append from both the command handler and the pipeline; return the event once.
- Don't insert a second local row on success; the observable query supplies the list.

## Related skills

- [Trace a missing update](../cratis-platform-diagnose-slice/SKILL.md) if registration succeeds but the screen stays unchanged.

- [Exercise the backend](../cratis-specifications-exercise-backend/SKILL.md) to assert the append and refusal.
- [Observe the UI](../cratis-specifications-observe-ui/SKILL.md) for the local interaction check.
