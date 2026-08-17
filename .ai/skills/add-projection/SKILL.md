---
name: add-projection
description: Use this skill when asked to add a Chronicle projection to a Cratis-based project. Favor model-bound projections by default, and only fall back to declarative/fluent `IProjectionFor<T>` projections when model-bound attributes cannot express the behavior cleanly. Enforces the AutoMap-first rule and Chronicle-specific join semantics.
---

Add a Chronicle **projection** that populates a read model from events.

> For **reactors** (automation / translation), see the `add-reactor` skill instead.

## Projection — Model-Bound (preferred)

Put projection metadata directly on the read model using attributes. No separate class needed.

```csharp
[ReadModel]
[FromEvent<SomeEventHappened>]              // auto-maps all matching property names
public record <ReadModelName>(
    [Key] <IdType> Id,                      // marks the primary key
    <PropType> <PropName>)                  // auto-mapped from SomeEventHappened
{
    public static ISubject<IEnumerable<<ReadModelName>>> All(IMongoCollection<<ReadModelName>> collection) =>
        collection.Observe();
}
```

**Attribute reference:**
| Attribute | Purpose |
|-----------|---------|
| `[FromEvent<T>]` | Maps event `T` onto the read model; matching property names map automatically (AutoMap is on by default — never call `.AutoMap()`) |
| `[FromEvent<T>(key: nameof(T.Prop))]` | Same, but uses `Prop` as the read model key instead of EventSourceId |
| `[Key]` | Marks the primary key property |
| `[SetFrom<T>(nameof(T.Prop))]` | Explicitly maps one property from event T |
| `[AddFrom<T>(nameof(T.Prop))]` | Adds event property value to the read model property |
| `[SubtractFrom<T>(nameof(T.Prop))]` | Subtracts event property value |
| `[ChildrenFrom<T>(key: nameof(T.Prop))]` | Projects into a nested child collection |
| `[Join<T>(on: nameof(Prop), eventPropertyName: nameof(T.EProp))]` | Joins data from a related event |
| `[RemovedWith<T>]` | Marks the instance as removed when event T is appended |

**Critical rules:**
- Joins must be on Chronicle **events** — NEVER join on a read model type
- If property names between event and read model match, `[FromEvent<T>]` alone is sufficient
- Child types also support all attributes recursively

## Projection — Fluent / declarative (fallback for complex cases)

Use `IProjectionFor<T>` only when the projection logic is too complex for model-bound attributes or would become less clear if forced into attributes.

```csharp
public class <Name>Projection : IProjectionFor<<ReadModel>>
{
    public void Define(IProjectionBuilderFor<<ReadModel>> builder) =>
        builder
            .From<SomeEventHappened>(b =>
                b.UsingKey(e => e.SomeId))
            .RemovedWith<SomeThingRemoved>();
}
```

**Critical rules:**
- AutoMap is on by default — just call `.From<>()` directly. Only call `.AutoMap()` if you previously used `.NoAutoMap()`.
- Joins are on Chronicle **events** only — NEVER join on the read model
- There is NO `Identifier` / `ProjectionId` property — do not add one

## Advanced patterns & gotchas

- **`[Nested]`** projects a single child object onto a nested type. Put `[FromEvent<T>]` on the **nested type** (or use property-level `[SetFrom<T>]` on the parent when the parent already declares the event). `[NoAutoMap]` and explicit `[SetFrom<T>]` work inside the nested type; `[Nested]` can recurse inside a `[ChildrenFrom]` item.
  - **Duplicate `[FromEvent<T>]`:** `FromEventAttribute` is declared `AllowMultiple = true`, and no Chronicle analyzer covers the case (the diagnostics run CHR0001–CHR0045 and none is about duplicate `[FromEvent]`). So it compiles, and there is no analyzer diagnostic. Prefer keeping `[FromEvent<T>]` on the nested type only — or property-level `[SetFrom<T>]` on the parent — because it is clearer about which type owns the mapping, not because the alternative is rejected.
  - **Duplicate `[SetFromContext<T>]`:** two members carrying `[SetFromContext<SameEvent>]` raise **CHR0040** — a **Warning**, not a startup crash. All but the last are silently discarded. Under the repo's zero-warning gate the warning still fails the build, so merge them or use `[FromEvery]`.
- **`[FromAll]` vs `[FromEvery]`:** both are **property-level** — `[FromAll]` is `AttributeTargets.Property` only, so putting it on a class is `CS0592`. `[FromAll]` marks a property as projected from **all event types** (audit/log models — pair with the class-level `[NotRewindable]`); it takes optional `contextProperty` / `property` names and otherwise matches by name. `[FromEvery]` captures across the events the model **already** declares via `[FromEvent<T>]` (e.g. to stamp `EventContext` data).
- **Attribute targets in general:** `[FromEvent<T>]`, `[NotRewindable]`, and `[Passive]` are class/struct-level; the mapping attributes (`[FromAll]`, `[FromEvery]`, `[SetFrom<T>]`, `[SetFromContext<T>]`, `[SetValue<T>]`, `[AddFrom<T>]`, `[SubtractFrom<T>]`, `[Increment<T>]`, `[Decrement<T>]`, `[Count<T>]`, `[ChildrenFrom<T>]`, `[Join<T>]`, `[Nested]`) are property/parameter-level; `[RemovedWith<T>]`, `[RemovedWithJoin<T>]`, and `[ClearWith<T>]` accept either.
- **`[Passive]` goes on the read model**, never on the projection or reducer class. It compiles on either, but Chronicle only reads it off the read-model type — putting it elsewhere is a silent no-op.
- **Constant-key counters:** `[Count<T>(ConstantKey="metrics")]` / `[Increment<T>(ConstantKey=...)]` route all matching events into **one** aggregating document at the constant key (distinct from `.UsingConstantKey("...")` on the fluent builder).
- **Children with different key names:** when child events use different key properties, use the fluent form — `.From<Assigned>(b => b.UsingKey(e => e.Email)).From<Updated>(b => b.UsingKey(e => e.OriginalEmail))` — which model-bound `[ChildrenFrom<T>]` (single key) can't express.
- **Source selection:** class-level `[EventSequence("name")]`, `[EventLog]`, or `[EventStore("name")]` choose where the projection reads from. ⚠️ `[FromEventSequence]` is **removed** — use `[EventSequence("name")]`.
- **Cross-stream specs:** in `ReadModelScenario<T>`, seed each contributing stream with its own `Given.ForEventSource(...)`. Don't pre-emptively `[Fact(Skip=...)]` a cross-stream assertion — only skip on a reproduced harness gap, with the reason in the skip message.

## After creating

Run `dotnet build`. Fix all errors before completing.

## Appended event metadata and filtering

Chronicle correlates appended metadata in two different ways:

- **Projections** select input through event types, joins, and event sequence configuration
- **Reducers and reactors** can additionally filter by appended tags, event source type, and event stream type

Use append metadata like this:

```csharp
await eventLog.Append(
    EventSourceId.New(),
    new OrderPlaced(42m),
    eventStreamType: "fulfillment",
    eventSourceType: "order",
    tags: ["priority"]);
```

If you need metadata-based filtering for downstream processing, pair the projection with a reducer or reactor using `[FilterEventsByTag]`, `[EventSourceType]`, or `[EventStreamType]`. Projection `[Tag]` and `[Tags]` attributes label the projection definition; they do not filter appended events.

For examples, see `Documentation/events/filtering/`.

---

For the full model-bound projection attribute reference and fluent builder API, see [references/CHRONICLE-API.md](references/CHRONICLE-API.md).
