# Chronicle Projection Builder API

## Basic structure

```csharp
public class MyProjection : IProjectionFor<MyReadModel>
{
    public ProjectionId Identifier => "<stable-guid-string>";

    public void Define(IProjectionBuilderFor<MyReadModel> builder) =>
        builder
            .AutoMap()              // ALWAYS first
            .From<SomeEvent>(...);
}
```

---

## `.AutoMap()`

Maps all event properties to read model properties with matching names automatically.
**Must be called before any `.From<>()` call.** Violating this causes incorrect mapping.

---

## `.From<TEvent>(Action<IFromBuilder<TReadModel, TEvent>>)`

Handles an event type. Builder methods available inside:

### `.UsingKey(e => e.PropertyOnEvent)`
Sets the read model's primary key from the event property.
Use when the key field name differs from the default.

### `.UsingParentKey(e => e.PropertyOnEvent)`
Sets the key from a parent relationship (for child projections).

### `.Set(m => m.TargetProperty).To(e => e.SourceProperty)`
Explicitly maps one event property to a read model property.
Use for name mismatches or transformations.

### `.Set(m => m.Property).ToValue(literal)`
Sets a property to a constant value.

### `.Add(m => m.Counter).With(1)`
Increments a numeric property by a fixed value.

### `.Subtract(m => m.Counter).With(1)`
Decrements a numeric property.

### `.Count(m => m.TotalCount)`
Increments a count property by 1.

---

## `.Children<TChild>(m => m.ChildCollection, childBuilder => ...)`

Projects into a nested collection on the read model. The child builder has the same API.

```csharp
builder
    .AutoMap()
    .Children<LineItem>(m => m.LineItems, childBuilder =>
        childBuilder
            .From<LineItemAdded>(b =>
                b.UsingKey(e => e.LineItemId)
                 .Set(li => li.Description).To(e => e.Description))
            .RemovedWith<LineItemRemoved>());
```

**Important:** Children joins are on the **event**, never on the read model.

---

## `.RemovedWith<TEvent>()`

Marks the read model as removed (soft delete) when the specified event is appended.

```csharp
builder
    .AutoMap()
    .From<ProjectRegistered>(b => b.UsingKey(e => e.ProjectId))
    .RemovedWith<ProjectRemoved>();
```

---

## `.Join<TEvent>(Action<IJoinBuilder<TReadModel, TEvent>>)`

Joins data from a different event into the same read model instance.
The join is on the **event**, not on the read model.

```csharp
builder
    .AutoMap()
    .From<ProjectRegistered>(b => b.UsingKey(e => e.ProjectId))
    .Join<OwnerAssigned>(b =>
        b.On(e => e.ProjectId)
         .Set(m => m.OwnerName).To(e => e.OwnerName));
```

---

## Projection ID stability

The `Identifier` GUID must **never change** after first deployment.
Changing it invalidates the projection store and forces a full rebuild from the event log, which is expensive and may cause downtime.

Generate a new GUID with:
```bash
dotnet run --project tools/GuidGenerator  # or use any GUID generator
```
