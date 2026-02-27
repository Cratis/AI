---
agent: agent
description: Add a business rule (RulesFor) or event-store constraint (IConstraint) to an existing command.
---

# Add a Business Rule or Constraint

I need to enforce a new rule on an existing command in a Cratis-based project.

## Inputs

- **Command** — name of the existing command, e.g. `RegisterProject`
- **Rule type** — one of:
  - **Business rule** (`RulesFor<,>`) — validated in-process; can read from read models or any async source
  - **Event-store constraint** (`IConstraint`) — enforced by Chronicle at the event-log level; typically uniqueness
- **Rule description** — what must be true for the command to succeed, e.g. "project name must be unique across tenant"

## Business Rules (`RulesFor<,>`)

Business rules live **in the same slice file** as the command they validate.
They run after model validation and before the `Handle()` method.

```csharp
public class RegisterProjectRules(IMongoCollection<Project> projects) :
    RulesFor<RegisterProjectRules, RegisterProject>
{
    public override async Task Define(RegisterProject command, IRulesBuilder<RegisterProjectRules> rules)
    {
        var nameExists = await projects
            .Find(p => p.Name == command.Name)
            .AnyAsync();

        rules.RuleFor(r => r.NameMustBeUnique)
             .Must(() => !nameExists)
             .WithMessage($"A project named '{command.Name}' already exists.");
    }

    /// <summary>Indicates whether the project name is unique.</summary>
    public bool NameMustBeUnique { get; private set; }
}
```

### Naming conventions

- Class name: `<CommandName>Rules`
- Property names: descriptive predicates — `NameMustBeUnique`, `UserMustBeActive`, `QuotaNotExceeded`
- Message: user-readable, includes the offending value where helpful

## Event-Store Constraints (`IConstraint`)

Constraints are enforced by Chronicle when the event is appended.
Use when the uniqueness or validity guarantee must survive concurrent writes across multiple instances.

```csharp
public class UniqueProjectName : IUniqueEventTypeConstraint<ProjectRegistered>
{
    public ConstraintName Name => "UniqueProjectName";

    public EventSourceId GetEventSourceId(ProjectRegistered @event) =>
        @event.Name.ToLowerInvariant();
}
```

Register the constraint in the slice's projection or aggregator using the Chronicle builder API.

### When to use constraints vs business rules

| Scenario | Use |
|----------|-----|
| Uniqueness that must survive concurrent writes | `IConstraint` |
| Complex validation that reads from multiple sources | `RulesFor<,>` |
| Async lookup against a read model | `RulesFor<,>` |
| Simple synchronous invariant (format, range) | Model validation (`[Required]`, `[MaxLength]`, etc.) |

## Checklist

- [ ] Rule is placed in the same slice file as the command
- [ ] `RulesFor<,>` class is named `<CommandName>Rules`
- [ ] Each rule property is a descriptive predicate (`bool NameMustBeUnique`)
- [ ] Error messages are user-readable and include relevant context
- [ ] Constraint (if used) is registered in the Chronicle configuration
- [ ] Spec added for the failure case — see `write-specs.prompt.md`
- [ ] `dotnet build` passes with zero errors
- [ ] `dotnet test` passes with zero failures
