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
- `ChronicleCommandScenario` is in memory: it does **not** enforce constraints or concurrency and does not support aggregates. A uniqueness spec that passes there proves nothing; run it with `ChronicleKernelScenario`, which needs a running kernel. Pass `options.connectionString` or set `ARC_CHRONICLE_TEST_URL` as the fallback.
- `given(Context, context => ...)` from `@cratis/arc.testing` creates one context for the whole `describe`. Act once in `beforeAll` and keep each `it` read-only.
- `EventScenario`'s `when.forEventSource(id).events(a, b)` appends one atomic batch. The C# scenario appends sequentially, so do not port a partial-failure spec between them.
- `ReactorScenario` rejects `replay()` and `redeliver()`; a repeated-delivery spec needs a running kernel.

For a plain service command, use `CommandScenario.for(Command, Validator)`, register the service instance on `scenario.services`, await `execute(values)`, assert the result and dispose the scenario. For an observable query collect a bounded number of emissions with a timeout; an unbounded subscription is not a completed test.

## Test the Chronicle artifact directly

Import these scenarios from `@cratis/chronicle/testing`. Use the application's event and artifact definitions; replace the names here with those from the slice.

**Append.** Leave constraints enabled when checking acceptance. `@unique` and fluent `unique(...).on(Event, event => event.key)` support fixture-backed single keys (including schema-backed strings and booleans); fluent two- and three-property composites support the fixture-backed string, GUID and unformatted numeric shapes. Do not extrapolate to arbitrary Unicode, schemas or combinations. Run unsupported constraints and concurrency against a live kernel. `ChronicleCommandScenario` does not enforce constraints.

```typescript
const events = new EventScenario({ artifacts: { eventTypes: [BookAdded, BookRemoved] } });
const result = await events.when.forEventSource('book-1').event(new BookAdded('Kindred'));
result.isSuccess.should.be.true;
```

Use the option `constraints: 'disabled'` only when acceptance policy is outside the promise, not to turn an unsupported constraint into verified behavior.

**Read model.** Reuse that scenario's accepted history; never combine `.observe(events)` with `given` seeding or call `observe` twice. Check absent and removed separately when that distinction matters.

```typescript
const books = new ReadModelScenario(BookStatus).observe(events);
(await books.wasDeletedForEventSourceId('missing')).should.be.false;
const removed = await events.when.forEventSource('book-1').event(new BookRemoved());
removed.isSuccess.should.be.true;
(await books.instanceForEventSourceId('book-1') === null).should.be.true;
(await books.wasDeletedForEventSourceId('book-1')).should.be.true;
```

**Reactor.** Check a returned effect directly; it is recorded, not recursively appended or delivered.

```typescript
const reactor = new ReactorScenario(WelcomeReactor, {
    artifacts: { eventTypes: [WelcomeRequested, WelcomeSent] },
    constraints: 'disabled'
});
await reactor.when.forEventSource('customer-1').event(new WelcomeRequested('Ada'));
reactor.shouldHaveProduced(WelcomeSent, event => event.name === 'Ada');
```
