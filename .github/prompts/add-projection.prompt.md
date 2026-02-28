---
agent: agent
description: Add a Chronicle projection or reactor to an existing read model or automation slice.
---

# Add a Projection or Reactor

I need to add a **Chronicle projection** (read model population) or **reactor** (automation) to the project.

## Inputs

- **Type**: `Projection` or `Reactor`
- **Events to react to** — list the event types (e.g. `ProjectRegistered`, `ProjectRemoved`)
- **Read model** (for projections) — paste the `record` type or describe the shape you want
- **Purpose** (for reactors) — describe the side-effect or automation to perform

## Projection rules (mandatory)

Follow `.github/instructions/vertical-slices.instructions.md` — projection section.

**Preferred — model-bound:** Place attributes directly on the read model record, no separate class needed.

```csharp
[ReadModel]
[FromEvent<ProjectRegistered>]
public record Project(
    [Key] ProjectId Id,
    ProjectName Name)
{
    public static ISubject<IEnumerable<Project>> AllProjects(IMongoCollection<Project> collection) =>
        collection.Observe();
}
```

**Alternative — fluent `IProjectionFor<T>:`** Use for complex joins, children, or conditionals.

```csharp
public class ProjectProjection : IProjectionFor<ReadModel>
{
    public void Define(IProjectionBuilderFor<ReadModel> builder) =>
        builder
            .From<ProjectRegistered>(b =>
                b.UsingKey(e => e.ProjectId)
                 .Set(m => m.Name).To(e => e.Name))
            .RemovedWith<ProjectRemoved>();
}
```

**Critical rules:**
- AutoMap is on by default — just call `.From<>()` directly
- Joins are on Chronicle **events**, never on the read model
- Use `.RemovedWith<TEvent>()` for soft-delete events
- **There is NO `ProjectionId Identifier` property — do not add one**

## Reactor rules (mandatory)

```csharp
public class AutomationName(IDependency dependency) : IReactor
{
    // Method name is arbitrary — dispatch is by first-parameter type
    public Task HandleProjectRegistered(ProjectRegistered @event, EventContext context) =>
        dependency.DoSomethingWith(@event);
}
```

**Critical rules:**
- `IReactor` is a **marker interface** — no methods to implement
- Event dispatch is by first-parameter type; method name can be anything descriptive
- `EventContext` is optional — omit if event metadata is not needed
- Reactors MUST be idempotent — they may be called more than once for the same event
- Do not use the read model inside the reactor — use the event data directly

## After creating the file

Run `dotnet build` and fix all errors before completing.
