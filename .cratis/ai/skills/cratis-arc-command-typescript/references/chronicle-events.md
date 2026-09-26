# Returning Chronicle events from an Arc for TypeScript command

Verified against `Cratis/Arc.TypeScript` `main` at commit `94d398d` (tag
`v0.33.0` plus three commits): `Documentation/chronicle/**`,
`Documentation/testing/chronicle.md`, `Source/Chronicle/index.ts`, and
`Samples/Library`. `@cratis/arc.chronicle` is **experimental** and, like every
package in the repository, not published to npm. `@cratis/chronicle` (the SDK)
is published; the integration peers `^6.7.0`.

## Register the integration

```typescript
import { ArcApplication } from '@cratis/arc.core';
import '@cratis/arc.chronicle';
import { metadata } from './Features/generatedMetadata.js';

const builder = ArcApplication.createBuilder();
builder.useGeneratedMetadata(metadata);
builder.withChronicle({ connectionString: 'chronicle://localhost:35000', eventStore: 'MyArcApp' });
await builder.discover(new URL('./Features/', import.meta.url));
const app = await builder.build();
await app.run({ port: 3000 });
```

The Library sample uses the equivalent function form,
`withChronicle(builder, options)`. Discovery hands every discovered event type,
projection, reducer, reactor and constraint to the Arc-owned client; they must be
**exported** beneath the discovery root. You do not import `reflect-metadata` for
the SDK — it imports it itself.

## What `handle()` may return

| `handle()` returns | Result |
| --- | --- |
| A registered event instance | Appended to the command's event source |
| An array of registered events | Appended in one batch |
| An array of ordinary objects | An ordinary response, not events |
| `tuple(event, 'message')` | The event is appended to the command key; `'message'` is the response |
| `tuple(eventSourceIdResponse(id), event)` | The event is appended to `id`, and `id` is the response |
| `eventForEventSourceId({ eventSourceId, event, eventSourceType?, subject?, tags? })` | Appended to that event source with explicit routing |
| `eventsWithConcurrencyScopes(events, scopes)` | Appended with exact per-source concurrency scopes |

`tuple` comes from `@cratis/arc.core`; `eventSourceIdResponse`,
`eventForEventSourceId`, and `eventsWithConcurrencyScopes` from
`@cratis/arc.chronicle`. The wrappers are branded, so a DTO that happens to have
`event` and `eventSourceId` fields is never mistaken for one.

## The event source

| The command declares | Event source ID |
| --- | --- |
| `getEventSourceId()` | Its result (string, `Guid`, or a concept over either); takes precedence |
| A `@key()` field | That field's value |
| Neither | A new UUID per execution |

## Routing defaults and concurrency

Class decorators from `@cratis/arc.chronicle` set defaults for every returned
event:

| Decorator | Sets |
| --- | --- |
| `@eventSourceType('Book', { concurrency? })` | Event source type |
| `@eventStreamType('Lending', { concurrency? })` | Event stream type |
| `@eventStreamId('main', { concurrency? })` | Event stream ID |
| `@eventSubject('subject')` | Compliance subject |
| `@notAudited()` (on a command **field**) | Keeps the value out of the permanent causation chain |

`{ concurrency: true }` reads that dimension's tail **after** `handle()` and
before the append. It does not protect a decision made from state read earlier.
For "create once", return `eventsWithConcurrencyScopes([event], { [this.id]:
{ eventSourceId: true, sequenceNumber: EventSequenceNumber.beforeFirst.value } })`
(`EventSequenceNumber` from `@cratis/chronicle/eventSequences`). For a decision
from the source's full history, use a command aggregate (`commandAggregate`).
For a rule across sources, such as a unique name, use a Chronicle constraint in
the slice file (`@constraint()` from `@cratis/chronicle/events`, as the Library
sample's `UniqueAuthorName` does).

## Rejections and the batch

- A constraint or concurrency rejection answers 400 with a validation result
  (`reason` `constraintViolation` or `concurrencyViolation`) and appends nothing.
- Events returned by nested Arc commands that share tenant, correlation ID and
  event store join the outer command's batch, sent once after the outer command
  succeeds. Any failure discards every staged event.
- An unknown, partial or incomplete acknowledgment fails the command with an
  exception, because Arc cannot tell what was stored.
- An SDK `eventLog.append(...)` inside `handle()` is outside the batch. Return
  events instead.
- Appending and projecting are separate: a query sent right after the command
  may not see the event yet. Prefer an observable query on the client.
  `completionTimeoutMs` makes the command wait for observers, but Chronicle waits
  for **every** observer on the log (Cratis/Chronicle#4132), so a projection or
  reactor that does not handle the event makes every command time out with 500.

## Read current state in the command

`@inject(commandReadModel(Book))` hands `handle()` the Chronicle read model
projected for the command key; a missing model rejects the command unless
`{ optional: true }`, which passes `null`. `ChronicleReadModels` (via
`service(ChronicleReadModels)` or `@inject`) reads other instances. The
validation-side equivalent is `readModelForValidation(Type)`.

## Reactors that return commands

A Chronicle reactor (from `@cratis/chronicle/reactors`) may return an Arc
`@command()` instance, or a non-empty array of only commands; Arc runs each
through the full command pipeline. Handlers are matched by camelCase event-class
method name, receive parsed JSON content (not a class instance), and run on
replay by default since SDK 6.9.0 — mark effects `@onceOnly()`, and keep returned
commands safe to repeat after a failed-partition re-delivery. Reactor authoring
itself is `cratis-chronicle-client-typescript`.

## Specify it without a kernel

`ChronicleCommandScenario` from `@cratis/arc.chronicle/testing` runs the real
pipeline with an in-memory event log:

```typescript
import { ChronicleCommandScenario } from '@cratis/arc.chronicle/testing';

const scenario = ChronicleCommandScenario.for(LendBook, BookLent, ReturnDateSet, LendBookValidator, Book);
scenario.givenReadModel(Book, bookId.toString(), book);
const result = await scenario.execute({ bookId, member: 'member-1', days: 14 });
result.shouldBeSuccessful();
result.appendedEvents.should.have.lengthOf(2);
result.shouldHaveAppendedEvent(BookLent, bookId.toString(), event => event.member === 'member-1');
await scenario.dispose();
```

- Pass the command, its event types, validators and read-model types to
  `for(...)`; the in-memory log refuses an unregistered event type.
- `givenReadModel(Type, id, instance, tenant?)` pins state;
  `scenario.given.forEventSource(id).events(...)` seeds reducer history (SDK
  6.14.0 or later).
- `shouldHaveAppendedEvent` does not check count or order — assert
  `appendedEvents` when either matters.
- The in-memory scenario does **not** run projections, aggregates, constraints
  or concurrency checks. `ChronicleKernelScenario` runs against a live kernel at
  `ARC_CHRONICLE_TEST_URL` for those.
