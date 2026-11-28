---
name: cratis-screenplay-specify-outcome
description: Use when a modeler needs Given/When/Then examples for success or refusal in a Screenplay .play slice. Not for exercising a running backend (use cratis-specifications-exercise-backend).
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

If a fixture passes but the reported outcome is wrong, [choose the observable result](references/observable-result.md) before adding more givens.

## Arrange a stateful or authorized command

Seed decision history with `given <EventOrEventExample>` and `for` the owning source. Choose `given readmodel <ReadModelOrTypedExample>` to seed a view instead of replaying history. Supply its key and required fields. For an authorized command, default to `given caller` with nested `authenticated` and the required roles or claims, as shown. Use `given caller as <Persona>` only when a top-level persona declaration already satisfies the command's policy; an undeclared persona fails. If any command declares `reads`, declare `command reads protected` once in the application root document; without it the model does not bind and its specifications cannot run. This Lending example seeds stock directly. In a working app, acquisition supplies `LoanStockSet` and withdrawal supplies `BookWithdrawn`; those producers are omitted here. When composing it into Library, don't duplicate the root directive.

```play
command reads protected
concept BookId : Uuid

policy CanLend
  require role "Librarian"

module Library
  feature Lending
    slice StateChange LendCopies
      command LendCopies
        bookId BookId identifier
        copies Int
        reads LoanStock as stock by bookId
        authorize CanLend
        validate
          require copies > 0
            message "Enter a positive quantity"
          require copies <= stock.available
            message "Not enough copies"
        produces CopiesLent
          for bookId
          copies = copies

      event CopiesLent
        copies Int

      example LendOne : LendCopies
        bookId = "22222222-2222-4222-8222-222222222222"
        copies = 1

      specification LendingTheLastCopy
        given readmodel OneCopy
        given caller
          authenticated
          role "Librarian"
        when LendOne
        then CopiesLent
          for "22222222-2222-4222-8222-222222222222"
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
        bookId BookId key
        available Int

      projection ProjectLoanStock => LoanStock
        from LoanStockSet
          bookId = $eventSourceId
          available = available
        from CopiesLent
          subtract available by copies
        remove with BookWithdrawn

      example OneCopy : LoanStock
        bookId = "22222222-2222-4222-8222-222222222222"
        available = 1
```

Resolve the fixture, input names, ID and refusal from the existing model. Use one `when`, overriding an actual input when needed. Expect the same concrete ID in `for`. Use `then denied` for an authorization refusal.

When a command records multiple facts, assert every new fact in the expected order. Choose `then events in any order` only when their order is not part of the contract. An unexpected extra fact still fails.

When only the input and expected values change across examples, [check one rule with named cases](references/named-cases.md).

Before handing off, [account for every modeled command and view](references/coverage-worksheet.md).

## Carry the accepted examples into the application

Reuse backend specs (`cratis-specifications-exercise-backend` skill in `cratis/application`); commit a case only for an uncovered consequential decision. Model tests don't prove the running slice (`cratis-platform-deliver-slice` skill in `cratis/application`).

## When it goes off the usual path

- **Only a read is under test:** use the `ListingAster` specification in [Declare the slice](../cratis-screenplay-declare-slice/SKILL.md): seed the fact, omit the action, and assert `then query AllAuthors exactly` with the expected row under `result`.
- **The effect belongs to another slice:** move the effect assertion to the slice that owns it and seed the fact it reacts to. Verify the joined behavior in the running application.
- **A graph changes:** use [graph fixtures and assertions](references/graph-steps.md) for concrete node and edge identities.
- **An invalid or unauthorized read is under test:** see [query rejection vs. absence](references/query-rejections.md).
- **The model runner reports Unsupported:** keep the outcome unverified; cover it at the first executable boundary rather than changing the assertion to get a pass. For opaque bodies, [run with a host provider](references/host-body-execution.md) only if the host can enforce the execution limits.

## Avoid

- Don't infer the destination from a payload field; assert `for` on the expected event.
- Don't use `then no events` for a validation error; it describes a successful request that produced nothing.

## Related skills

- [Accept the model](../cratis-screenplay-accept-model/SKILL.md) to review what changed in the running examples.
- Exercise the backend (`cratis-specifications-exercise-backend` skill in `cratis/application`) for the corresponding runtime assertions.
