# Exercise a TypeScript backend

Applies to a Node server built with the Arc and Chronicle TypeScript SDKs, run with the runner the application already uses. A React component is a different task.

| Promise | Harness | Import from |
| --- | --- | --- |
| Binding, authorization, validation of a command | `CommandScenario` | `@cratis/arc.testing` |
| A query, or bounded emissions of an observable one | `QueryScenario`, `ObservableQueryScenario` | `@cratis/arc.testing` |
| The events an event-sourced command appends | `ChronicleCommandScenario` | `@cratis/arc.chronicle/testing` |
| An append contract, a reduced or projected row, a reactor's effect | `EventScenario`, `ReadModelScenario`, `ReactorScenario` | `@cratis/chronicle/testing` |
| Constraints, concurrency, aggregates, kernel-run projections | `ChronicleKernelScenario` against a running kernel | `@cratis/arc.chronicle/testing` |

## Assert the events a command appends

Pass everything the command touches to `for(...)`: the command, its event types, its validator and its read model types. An unregistered event type is refused, and an unregistered read model fails the execution.

```typescript
import { ChronicleCommandScenario } from '@cratis/arc.chronicle/testing';

describe('when lending a book in the catalog', () => {
    const scenario = ChronicleCommandScenario.for(LendBook, BookLent, LendBookValidator, Book);
    const bookId = BookId.create();
    let result: Awaited<ReturnType<typeof scenario.execute>>;

    beforeAll(async () => {
        scenario.givenReadModel(Book, bookId.toString(), aBookTitled('Kindred'));
        result = await scenario.execute({ bookId, member: 'member-1', days: 14 });
    });
    afterAll(async () => { await scenario.dispose(); });

    it('should succeed', () => result.shouldBeSuccessful());
    it('should lend that book to the member', () =>
        result.shouldHaveAppendedEvent(BookLent, bookId.toString(), event => event.member === 'member-1'));
    it('should append nothing else', () => result.appendedEvents.should.have.lengthOf(1));
});
```

`aBookTitled` stands for the application's own builder of a `Book`. The result exposes `shouldNotBeSuccessful()`, `shouldHaveValidationErrorFor(message)`, `shouldHaveValidationErrorForMember(member)`, `shouldHaveValidationErrorBecauseOf(reason)` and `shouldNotBeAuthorized()` for the refusal reason.

## Limits to design around

- `shouldHaveAppendedEvent` passes when at least one event matches. It checks neither count nor order; assert those on `result.appendedEvents`.
- `ChronicleCommandScenario` is in memory: it does **not** enforce constraints or concurrency and does not support aggregates. A uniqueness spec that passes there proves nothing; run it with `ChronicleKernelScenario`, which needs a kernel at `ARC_CHRONICLE_TEST_URL`.
- `given(Context, context => ...)` from `@cratis/arc.testing` creates one context for the whole `describe`. Act once in `beforeAll` and keep each `it` read-only.
- `EventScenario`'s `when.forEventSource(id).events(a, b)` appends one atomic batch. The C# scenario appends sequentially, so do not port a partial-failure spec between them.
- `ReactorScenario` rejects `replay()` and `redeliver()`; a repeated-delivery spec needs a running kernel.
