# Prove appends, projected rows, reactions and delivery in C#

`EventScenario`, `ReadModelScenario<T>` and `ReactorScenario<T>` come from `Cratis.Chronicle.Testing` and run in process without a server. None of them proves storage, transport, compliance or distributed replay; do not infer those from a green scenario.

## Prove an append contract

`EventScenario` (namespace `Cratis.Chronicle.Testing.EventSequences`) checks what the event log accepts: constraints, concurrency and the resulting sequence. Seed the competing fact in `Given`, append through `When`, and keep the returned `AppendResult`. A completed task does not mean the append was accepted.

```csharp
using var scenario = new EventScenario();
await scenario.Given.ForEventSource(existing).Events(new AuthorRegistered("Aster"));

var result = await scenario.When.ForEventSource(other).Events(new AuthorRegistered("Aster"));

result.ShouldHaveConstraintViolationFor(AuthorConstraintNames.UniqueName);
```

- Assert the specific channel: `ShouldHaveConstraintViolationFor(name)`, `ShouldHaveConcurrencyViolations()` or `ShouldHaveErrors()`. `ShouldBeFailed()` alone accepts any of them.
- `When...Events(a, b)` appends one event at a time and stops at the first rejection. It **does not roll back the events already accepted**. To prove an atomic batch, call `AppendMany` on `scenario.EventLog` and assert its result.
- Assertions on `scenario.EventLog`, such as `ShouldHaveTailSequenceNumber(...)` and `ShouldHaveAppendedEvent<T>(...)`, return `Task`. Await them.

## Prove a projected or reduced row

`ReadModelScenario<TReadModel>` (namespace `Cratis.Chronicle.Testing.ReadModels`) runs the application's discovered projection or reducer for that model.

- **Route events as production does.** `Given.ForEventSource(id).Events(...)` uses the source alone; add `.OnStream(...)` or `.WithTags(...)` when the model depends on them. A one-source happy path can conceal a broken join or key.
- **Read the result by key.** `scenario.Instance` is the single materialized instance and throws when there are several; use `scenario.InstanceForEventSourceId(id)` or `scenario.Instances` then.
- **Start from existing state when that is the premise.** `await scenario.Given.ForEventSourceId(id).ReadModel(existing)` seeds an instance; later events fold on top of it. `Given.ForKey(...)` seeds a composite key. Seeding the same key twice throws `ReadModelAlreadySeeded`.
- **Reuse real envelopes.** `ProcessAppendedEvents(events)` applies `AppendedEvent` values captured elsewhere with their original context.
- **Do not replace the definition under test.** `WithProjection(builder => ...)` overrides discovery, including a discovered reducer, so the spec then proves the inline recipe instead of the application's. Use it only for a model with no definition of its own. A missing or ambiguous definition is a failure to fix, not a reason to substitute one.
- **Catch a silent drop.** `WithStrictEventSubscription()` makes a seeded event the model does not subscribe to throw instead of being ignored.

Cover these cases once each where they are meaningful, asserting concrete values and absence:

| Case | Assert |
| --- | --- |
| No events | No instance exists |
| Create | The instance has the key and every mapped value |
| Update | The changed value, and that unrelated values kept theirs |
| Sibling | A second source's instance is untouched |
| Remove | The instance is gone |
| Recreate | A later create after removal yields a fresh instance |

## Prove a reactor's effect

`ReactorScenario<TReactor>` (namespace `Cratis.Chronicle.Testing.Reactors`) activates the reactor from `scenario.Services` and hands it each event once.

- Register fakes in `scenario.Services` before the first event.
- `await scenario.Given.ForEventSource(id).Events(...)` delivers the events. It does **not** build read models.
- A reactor method that takes a read model needs it declared: `scenario.Given.ForEventSourceId(id).ReadModel(instance)` or `.NoReadModel<T>()` for a deliberate `null`. Omitting both throws `ReadModelNotSeededForReactorScenario`.
- Assert returned events with `scenario.ShouldHaveProduced<T>(e => ...)` and `scenario.ShouldNotHaveProduced<T>()`. `ShouldHaveProduced` checks presence, not a count.
- To prove a repeated delivery is harmless, record without delivering and deliver twice:

```csharp
var occurrence = await scenario.Given.ForEventSource(id).History(new OrderPlaced("order-1"));
await scenario.Redeliver(occurrence);
await scenario.Redeliver(occurrence);

mailer.Sent.Count.ShouldEqual(1);
```

Assert the count on the provider fake, not the number of handler calls. This redelivery reuses the recorded context in process; it is not a replay or transport test.

A green `ReactorScenario` does not prove the application registers or subscribes the reactor. Verify discovery separately, against a running store, and report it as a separate result.

## Prove discovery, persistence or delivery

Use the fixtures from `Cratis.Chronicle.XUnit.Integration.v3` for xUnit v3 (`Cratis.Chronicle.XUnit.Integration` for xUnit v2). Reference exactly one of them; the two must not be referenced together. The fixtures are not in `Cratis.Chronicle.Testing`.

- `ChronicleInProcessFixture` hosts the kernel in the test process with MongoDB in a container. Start with it.
- `ChronicleOutOfProcessFixture` runs the kernel in a separate container. Use it when the promise depends on the kernel being a separate process.
- The kernel is shared across specs. Override `UsesPerContextMongoDBHost` to return `true` on an in-process fixture when a context needs its own isolated storage.

Derive the context from the integration `Specification<TFixture>(fixture)`, override `EventTypes` and `Reactors` to name what the context registers, and capture appends around the act:

```csharp
async Task Because()
{
    await EventStore.Reactors.GetHandlerFor<ShipmentReactor>().WaitTillActive();

    _appends = StartCollectingAppends();
    await EventStore.EventLog.Append(_orderId, new OrderPlaced("order-123"));
    await _appends.WaitForCount(2);
}

void Destroy() => _appends?.Dispose();
```

- Call `StartCollectingAppends()` immediately before the act, so earlier events are not captured, and dispose the collection.
- `WaitForCount(count, timeout)` waits for the follow-up appends and throws `TimeoutException` after five seconds by default. Wait on it, or on `WaitForCompletion()`, never on a delay.
- Assert a collected append with `ShouldHaveEvent<ShipmentScheduled>(e => e.OrderId.ShouldEqual("order-123"))` and `ShouldBeSuccessful()`.
- To act through the application's HTTP surface, call `await client.ExecuteCommand(route, command)` on the fixture's `HttpClient` and assert the returned `CommandResult`.

When the repository keeps specs inside the application assembly, follow its convention of wrapping them in `#if DEBUG` so release builds exclude them. A dedicated spec project needs no wrapper.
