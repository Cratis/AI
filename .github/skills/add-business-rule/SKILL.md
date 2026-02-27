---
name: add-business-rule
description: >
  Use this skill when asked to add a validation rule, business rule, or
  uniqueness constraint to an existing command in a Cratis-based project.
---

Add a business rule or event-store constraint to an existing command.

## Choose the right mechanism

| Scenario                                           | Use                    |
|----------------------------------------------------|------------------------|
| Uniqueness that must survive concurrent writes     | `IConstraint`          |
| Complex validation reading from read models        | `RulesFor<,>`          |
| Async lookup or cross-aggregate validation         | `RulesFor<,>`          |
| Simple sync invariant (format, range, required)    | Model validation attrs |

## Business Rules (`RulesFor<,>`)

Place the class **in the same slice file** as the command it validates.

```csharp
public class <Command>Rules(<Dependencies>) :
    RulesFor<<Command>Rules, <Command>>
{
    public override async Task Define(<Command> command, IRulesBuilder<<Command>Rules> rules)
    {
        var nameExists = await _collection
            .Find(p => p.Name == command.Name)
            .AnyAsync();

        rules.RuleFor(r => r.NameMustBeUnique)
             .Must(() => !nameExists)
             .WithMessage($"A project named '{command.Name}' already exists.");
    }

    /// <summary>Indicates whether the name is unique.</summary>
    public bool NameMustBeUnique { get; private set; }
}
```

**Naming:**
- Class: `<CommandName>Rules`
- Properties: descriptive predicates — `NameMustBeUnique`, `UserMustBeActive`, `QuotaNotExceeded`

## Event-Store Constraints (`IConstraint`)

Enforced by Chronicle at append time. Use for uniqueness that must hold across concurrent writes.

```csharp
public class Unique<SomeProperty> : IUniqueEventTypeConstraint<<EventType>>
{
    public ConstraintName Name => "Unique<SomeProperty>";

    public EventSourceId GetEventSourceId(<EventType> @event) =>
        @event.Property.ToString().ToLowerInvariant();
}
```

Register the constraint in the Chronicle configuration or slice builder.

## After adding

1. Add a spec for the failure case — see `write-specs` skill
2. Run `dotnet build` and `dotnet test`
3. Fix all failures before completing
