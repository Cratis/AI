---
name: cratis-screenplay-specify-outcome
description: Use when writing Given/When/Then examples for an accepted outcome or a refusal in a Screenplay .play slice. Not for exercising a running backend (use cratis-specifications-exercise-backend).
compatibility: Requires the Screenplay CLI.
---

# Specify successful registration and refusal of an empty name

Start with a concrete case. In `model/Authors/registration.play`, use the same fixed author ID in both examples so only the name changes.

1. Start with the command, `AuthorId` and event from [declaring the Authors slice](../cratis-screenplay-declare-slice/SKILL.md).
2. Inside the command, add the rule below before `produces AuthorRegistered`:

   ```play
   validate
     name not empty message "Name is required"
   ```

3. At the same indentation as the command declaration, add the example and specifications:

   ```play
   example Aster : RegisterAuthor
     id = "11111111-1111-4111-8111-111111111111"
     name = "Aster"

   specification RegisteringAster
     when Aster
     then AuthorRegistered
       for "11111111-1111-4111-8111-111111111111"
       name = "Aster"

   specification RejectingAnEmptyName
     when Aster name = ""
     then error "Name is required"
   ```

4. From the Library application directory run `screenplay test model --format json`. When running just these two specifications, require `executed` and `passed` both 2 and `failed` and `unsupported` both 0. In a larger model, check their named outcomes individually. The first one should fail if the event goes to a different author, even if the name is correct.

## Arrange a stateful or authorized command

Seed a prior event before the action, for example `given AuthorRegistered` with `for "11111111-1111-4111-8111-111111111111"` and `name = "Aster"` on indented lines. Give the caller separately before the action:

```play
  given caller
    authenticated
    role "Librarian"
  when Aster name = ""
  then error "Name is required"
```

Use the application's declared role. A command example has one stimulus: `when Aster` uses the example as-is, or an inline assignment overrides an input. Put the caller in `given caller`, not on `when`. For an authorization refusal use `then denied`, not `then error` or `then no events`.

When a command records multiple facts, assert every new fact in the expected order. Choose `then events in any order` only when their order is not part of the contract. An unexpected extra fact still fails.

## Check one rule across independent cases

Choose a named table when the steps are identical and only the values change. Add it beside the registration specifications:

```play
specification RecordingAuthorNames
  parameter name String
  case AsterName name = "Aster"
  case BirchName name = "Birch"
  when Aster name = case.name
  then AuthorRegistered
    for "11111111-1111-4111-8111-111111111111"
    name = case.name
```

Run `screenplay test model --format json`; check `RecordingAuthorNames_AsterName` and `RecordingAuthorNames_BirchName` separately.

## Carry the accepted examples into the application

[Exercise the backend](../cratis-specifications-exercise-backend/SKILL.md) with the same Given/When/Then: assert the addressed append and name for Aster, and a refusal with no append for the empty name. For the state view, assert the query's row ID and name from the fact. [Check the UI interaction](../cratis-specifications-observe-ui/SKILL.md) and [verify the running slice](../cratis-platform-deliver-slice/SKILL.md) separately; model tests don't demonstrate either.

## When it goes off the usual path

- **Only a read is under test:** use the `ListingAster` specification in [Declare the slice](../cratis-screenplay-declare-slice/SKILL.md): seed the fact, omit the action, and assert `then query AllAuthors exactly` with the expected row under `result`.
- **The effect belongs to another slice:** move the effect assertion to the slice that owns it and seed the fact it reacts to. Verify the joined behavior in the running application.
- **The model runner reports Unsupported:** keep the outcome unverified; cover it at the first executable boundary rather than changing the assertion to get a pass.

## Avoid

- Don't infer the destination from a payload field; assert `for` on the expected event.
- Don't use `then no events` for a validation error; it describes a successful request that produced nothing.

## Related skills

- [Accept the model](../cratis-screenplay-accept-model/SKILL.md) to review what changed in the running examples.
- [Exercise the backend](../cratis-specifications-exercise-backend/SKILL.md) for the corresponding runtime assertions.
