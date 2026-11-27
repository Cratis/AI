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

4. Run `screenplay test model --format json` from the application directory. Require each named scenario to pass; an unsupported outcome is unverified.

## Arrange a stateful or authorized command

Seed decision history with `given <EventOrEventExample>` and `for` the owning source. Choose `given readmodel <ReadModelOrTypedExample>` to seed a view instead of replaying history. Supply its key and required fields. For an authorized command, supply `given caller` as shown or choose `given caller as <Persona>` when a declared persona supplies the caller. If any command declares `reads`, declare `command reads protected` once in the application root document; without it the model does not bind and its specifications cannot run.

```play
command reads protected

policy CanLend
  require role "Librarian"

module Library
  feature Lending
    slice StateChange LendCopies
      command LendCopies
        bookId String identifier
        copies Int
        reads LoanStock as stock by bookId
        authorize CanLend
        validate
          require copies <= stock.available
            message "Not enough copies"
        produces CopiesLent
          for bookId
          copies = copies

      event CopiesLent
        copies Int

      example LendOne : LendCopies
        bookId = "book-42"
        copies = 1

      specification LendingTheLastCopy
        given readmodel OneCopy
        given caller
          authenticated
          role "Librarian"
        when LendOne
        then CopiesLent
          for "book-42"
          copies = 1

      specification RefusingTwoCopies
        given readmodel OneCopy
        given caller
          authenticated
          role "Librarian"
        when LendOne copies = 2
        then error "Not enough copies"

    slice StateView ShowLoanStock
      event LoanStockSet
        available Int
      event BookWithdrawn

      readmodel LoanStock
        bookId String key
        available Int

      projection ProjectLoanStock => LoanStock
        from LoanStockSet
          bookId = $eventSourceId
          available = available
        remove with BookWithdrawn

      example OneCopy : LoanStock
        bookId = "book-42"
        available = 1
```

Resolve the fixture, input names, ID and refusal from the existing model. Use one `when`, overriding an actual input when needed. Expect the same concrete ID in `for`. Use `then denied` for an authorization refusal.

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

Carry the same Given/When/Then into [backend specs](../cratis-specifications-exercise-backend/SKILL.md). Model tests don't prove the [running slice](../cratis-platform-deliver-slice/SKILL.md).

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
