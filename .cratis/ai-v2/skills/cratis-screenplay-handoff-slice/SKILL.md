---
name: cratis-screenplay-handoff-slice
description: Prepares an accepted model slice for implementation or authorized rendering. Use when handing off a qualified slice and its expected application behavior. Not for approving the model (use cratis-screenplay-accept-model).
compatibility: Requires Node.js and the Screenplay CLI.
---

# Hand one accepted slice to its implementer

Specify what the implementation must do, which accepted model it must match and what remains unsupported by the target. Model acceptance is not permission to render.

1. Record the model revision, qualified slice name, target, dependencies, accepted examples and visible outcome.
2. Export only the requested slice. Record the exported excerpt's revision as well as the revision of the full model.
3. Include the UI contract for a screen. For an HTTP consumer include the route, `operationId` and `x-screenplay-id`; distinguish validation from execution and a snapshot query from an observable one.
4. Resolve implementation attachments relative to the physical model root. Open the target files in the intended checkout.
5. Run the accepted interaction in the target application. Compare the result with the example and identify missing target behavior explicitly.

## Export the Library's author registration slice

From the application directory, with the accepted Library model from [declaring the Authors slice](../cratis-screenplay-declare-slice/SKILL.md) in `model/Authors/registration.play`, run:

```sh
screenplay export model --scope Library.Authors.RegisterAuthor
```

Hand the recipient the selected excerpt. Name the dependent `Library.Authors.ListAuthors` slice and the expected result: registering Aster adds one row for the requested author ID to the already-open list. For an attached external operation, run the operation in the host before reporting that it worked.

## Avoid

- Don't resolve an attachment relative to the importing fragment; use the model root.
- Don't treat compilation or an attached file hash as execution of that file.
- Don't infer renderer support from the presence of a declaration; check the binding in the target.

## Related skills

- [Accept the model](../cratis-screenplay-accept-model/SKILL.md) before selecting a revision for handoff.
- [Deliver the slice](../cratis-platform-deliver-slice/SKILL.md) to implement and exercise the visible outcome.
