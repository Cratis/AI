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

```csharp
public class ProjectionName : IProjectionFor<ReadModel>
{
    public ProjectionId Identifier => "<stable-guid>";

    public void Define(IProjectionBuilderFor<ReadModel> builder) =>
        builder
            .AutoMap()                          // ← ALWAYS first
            .From<ProjectRegistered>(builder =>
                builder
                    .UsingKey(e => e.ProjectId)
                    .Set(m => m.Name).To(e => e.Name))
            .RemovedWith<ProjectRemoved>();
}
```

**Critical rules:**
- `.AutoMap()` MUST appear before any `.From<>()` call
- Joins are on Chronicle **events**, never on the read model
- Use `.RemovedWith<TEvent>()` for soft-delete events
- Projection ID MUST be a stable GUID string — never change it after first deployment

## Reactor rules (mandatory)

```csharp
public class AutomationName : IReactorFor<ProjectRegistered>
{
    public AutomationName(IDependency dependency) => ...

    public Task On(ProjectRegistered @event, EventContext context) =>
        dependency.DoSomethingWith(@event);
}
```

**Critical rules:**
- Reactors MUST be idempotent — they may be called more than once for the same event
- If the reactor appends new events, use a separate event log / outbox to avoid infinite loops
- Do not call the read model back inside the reactor — use the event data directly

## After creating the file

Run `dotnet build` and fix all errors before completing.
