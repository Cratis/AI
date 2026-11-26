---
name: cratis-screenplay-handoff-slice
description: Use when exporting one accepted Screenplay slice to hand a target team the application behavior to implement. Not for approving the model (use cratis-screenplay-accept-model).
compatibility: Requires the Screenplay CLI.
---

# Hand off Library author registration

1. Start in the application directory containing `model/Authors/registration.play`. Run the [acceptance checks](../cratis-screenplay-accept-model/SKILL.md) and identify the target Library application before exporting.
2. Record `revision` from the full export and from the registration-only export separately:

   ```sh
   screenplay export model --output library.json
   screenplay export model --scope Library.Authors.RegisterAuthor --output registration.json
   ```

3. Give the implementer `registration.json`, both revisions and the accepted `RegisteringAster` and `RejectingAnEmptyName` outcomes. Name `Library.Authors.ListAuthors` as a dependency, not as part of this excerpt.
4. For a screen consumer, include `screenplay export model --format ui --output screens.json`. For an HTTP consumer, include `screenplay export model --format openapi --output api.json`; identify the route, `operationId` and `x-screenplay-id`. The `.Validate` operation validates without execution. `AllAuthors` is an observable collection, not just a one-time read.
5. On the target, register Aster for the agreed author ID and verify that the already-open list gains the matching row. An empty name must produce `Name is required` and no new row.

## Avoid

- Don't send a feature-wide export when the request is for one slice.
- Don't treat a successful export as proof that the target application implements registration.

## Related skills

- [Declare the model slice](../cratis-screenplay-declare-slice/SKILL.md) for its qualified name.
- [Deliver the slice](../cratis-platform-deliver-slice/SKILL.md) for the running application check.
