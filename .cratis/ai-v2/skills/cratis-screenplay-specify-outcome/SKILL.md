---
name: cratis-screenplay-specify-outcome
description: Use when writing Given/When/Then examples for an accepted outcome or a refusal in a Screenplay .play slice. Not for exercising a running backend (use cratis-specifications-exercise-backend).
compatibility: Requires the Screenplay CLI.
---

# Specify successful registration and refusal of an empty name

In `model/Authors/registration.play`, use the same fixed author ID in each example so only the name changes.

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

Put the givens in each specification. Seed `given <EventType>` with `for <literal-id>` and the event's declared payload members, or use `given readmodel <ReadModelType>` with its key member and required state when testing directly against a view. Use the same concrete ID as the example input and the expected event's `for` value. If the fixture needs a different ID from the example, override the ID on the `when` step rather than putting a placeholder in `then`. Give the caller separately before the action:

```play
  given caller
    authenticated
    role "Librarian"
  when Aster name = ""
  then error "Name is required"
```

Use the application's declared role and modeled refusal. Run one `when` per specification: `when Aster` to use the example as-is, or an inline assignment to override an input. Do not attach a caller to the `when` or invent a fixture name in place of event or read-model data.

## Avoid

- Don't infer the destination from a payload field; assert `for` on the expected event.
- Don't use `then no events` for a validation error; it describes a successful request that produced nothing.

## Related skills

- [Accept the model](../cratis-screenplay-accept-model/SKILL.md) to review what changed in the running examples.
- [Exercise the backend](../cratis-specifications-exercise-backend/SKILL.md) for the corresponding runtime assertions.
