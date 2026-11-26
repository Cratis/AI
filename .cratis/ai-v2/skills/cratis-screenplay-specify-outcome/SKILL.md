---
name: cratis-screenplay-specify-outcome
description: Specifies an accepted outcome and its refusal in Screenplay. Use when writing Given/When/Then examples for a .play slice. Not for exercising a running backend (use cratis-specifications-exercise-backend).
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

## Avoid

- Don't infer the destination from a payload field; assert `for` on the expected event.
- Don't use `then no events` for a validation error; it describes a successful request that produced nothing.

## Related skills

- [Accept the model](../cratis-screenplay-accept-model/SKILL.md) to review what changed in the running examples.
- [Exercise the backend](../cratis-specifications-exercise-backend/SKILL.md) for the corresponding runtime assertions.
