# Provide example

This reference holds a worked example that rejects with a validation result. The other entity is an injected read model keyed by a command property; the validator checks the relation. `Provide()` takes no read-model access here.

```csharp
[Command]
public record Open<Thing>(<ThingId> Id, <OwnerId> OwnerId)
{
    public <ThingOpened> Handle([LookUpBy(nameof(Open<Thing>.OwnerId))] <Owner> owner) => new(owner.Id);
}

public class Open<Thing>Validator : CommandValidator<Open<Thing>>
{
    public Open<Thing>Validator([LookUpBy(nameof(Open<Thing>.OwnerId))] <Owner>? owner)
    {
        RuleFor(c => c.OwnerId).Must(_ => owner is not null).WithMessage("Owner must exist.");
    }
}
```
