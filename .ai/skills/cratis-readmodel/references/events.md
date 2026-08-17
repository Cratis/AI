# Events — Reference

## [EventType] attribute

```csharp
using Cratis.Chronicle.Events;

[EventType]
public record OrderPlaced(string CustomerId, decimal Total);
```

Every event must be decorated with `[EventType]` — this makes it discoverable and registers its schema with Chronicle.

---

## Good event design

- **Past tense**: `OrderPlaced`, `UserOnboarded`, `BookReturned` ✓ — not `PlaceOrder`, `OnboardUser`
- **One purpose**: an `AddressChanged` event should only carry address fields, not payment info
- **No nullables** unless the field is genuinely optional (e.g. `string? MiddleName`)
- **Immutable facts**: events represent something that *has happened* — do not use them to encode intent or possibility

---

## Appending an event

**From a command, return the event — never inject `IEventLog`.** Arc's Chronicle integration appends whatever `Handle()` returns, to the event source resolved from the command. Injecting `IEventLog` into `Handle()` trips analyzer **ARCCHR0007**, which is a warning and therefore a build failure under the zero-warning gate.

```csharp
[Command]
public record PlaceOrder(OrderId OrderId, CustomerId CustomerId, Money Total)
{
    public OrderPlaced Handle() => new(CustomerId, Total);
}
```

The event source id comes from `OrderId` (it derives from `EventSourceId<T>`) — the identity the event belongs to, analogous to an aggregate root id. Projections and reducers are keyed by it by default, and it is **never** a payload property on the event.

Arc reports a failed append back through `CommandResult.validationResults` with a `reason` of `concurrencyViolation` or `constraintViolation` — you do not inspect an `AppendResult` yourself.

`IEventLog.Append(eventSourceId, @event, …)` remains the low-level API for infrastructure and test code that legitimately sits outside a command — and it is where the metadata that downstream reducers and reactors filter on is set:

```csharp
await eventLog.Append(
    orderId,
    new OrderPlaced(customerId, total),
    eventStreamType: "fulfillment",
    eventSourceType: "order",
    tags: ["priority"]);
```

---

## Constraints (uniqueness)

Enforce uniqueness at append time without application-level checks. For the common single-event case, mark the property `[Unique]`:

```csharp
[EventType]
public record OrderPlaced([Unique(name: "UniqueOrderNumber", message: "Order number already used.")] OrderNumber OrderNumber);
```

For multi-event or `RemovedWith` rules, implement `IConstraint` (declarative `Define`, member-access lambdas only):

```csharp
public class UniqueOrderNumber : IConstraint
{
    public void Define(IConstraintBuilder builder) =>
        builder.Unique(unique => unique.On<OrderPlaced>(e => e.OrderNumber));
}
```

Violations surface on the `AppendResult`/`CommandResult` as a constraint violation (assert the constraint **name**, never the message). See the **add-business-rule** skill.

---

## Tags

```csharp
[EventType]
[Tag("high-value")]
public record LargeOrderPlaced(decimal Total);

// Or apply at append time:
await eventLog.Append(orderId, new LargeOrderPlaced(2500m), tags: ["priority"]);
```

Tags allow reducers and reactors to filter which appended events they handle when you use `[FilterEventsByTag]`. `[Tag]` and `[Tags]` on projections, reducers, and reactors label the observer or event type; they do not filter the observer by themselves.

See `Documentation/events/filtering/` for tag, event source type, and event stream type filtering examples.
