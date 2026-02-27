---
name: add-projection
description: >
  Use this skill when asked to add a Chronicle projection or reactor to a
  Cratis-based project. Enforces the AutoMap-first rule and Chronicle-specific
  join semantics.
---

Add a Chronicle **projection** (populates a read model from events) or **reactor** (triggers automation from events).

## Projection

```csharp
public class <Name>Projection : IProjectionFor<<ReadModel>>
{
    public ProjectionId Identifier => "<stable-guid>";

    public void Define(IProjectionBuilderFor<<ReadModel>> builder) =>
        builder
            .AutoMap()                             // ← ALWAYS first — never move this
            .From<SomeEventHappened>(builder =>
                builder
                    .UsingKey(e => e.SomeId)
                    .Set(m => m.Property).To(e => e.Property))
            .RemovedWith<SomeThingRemoved>();
}
```

**Critical rules:**
- `.AutoMap()` MUST be the very first call — before any `.From<>()`
- Joins are on Chronicle **events** only — NEVER join on the read model
- Use `.RemovedWith<TEvent>()` for delete/removal events
- The `Identifier` GUID must be stable — never change it after first deployment (changing it forces a full projection rebuild)
- Read model must be a `record` type

## Reactor

```csharp
public class <Name>Reactor : IReactorFor<SomeEventHappened>
{
    public <Name>Reactor(IDependency dependency) => ...;

    public Task On(SomeEventHappened @event, EventContext context) =>
        _dependency.DoSomethingWith(@event);
}
```

**Critical rules:**
- Reactors MUST be idempotent — they may be called more than once for the same event
- Do not query the read model back inside the reactor — use event data directly
- If the reactor appends new events, use a separate outbox to avoid feedback loops

## When to use which

| Need                                    | Use         |
|-----------------------------------------|-------------|
| Populate a queryable read model         | Projection  |
| Trigger side effects / automation       | Reactor     |
| Both                                    | Both        |

## After creating

Run `dotnet build`. Fix all errors before completing.
