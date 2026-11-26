---
name: cratis-arc-declare-command
description: Declares a model-bound command that returns an event. Use when writing a command record or its Handle method. Not for dispatching the command (use cratis-arc-invoke-command).
compatibility: Requires the Cratis package for Arc with Chronicle.
---

# Register an author

Put the command and returned event in `Authors/RegisterAuthor.cs`. The `Cratis` package supplies their framework namespaces as global usings.

```csharp
namespace Catalog.Authors;

[Command]
public record RegisterAuthor(AuthorId Id, string Name)
{
    public AuthorRegistered Handle() => new(Name);
}

[EventType]
public record AuthorRegistered(string Name);
```

Make the first parameter the caller's event source ID. Define the concept in `Authors/AuthorId.cs`:

```csharp
namespace Catalog.Authors;

public record AuthorId(Guid Value) : EventSourceId<Guid>(Value)
{
    public static readonly AuthorId NotSet = new(Guid.Empty);
    public static implicit operator AuthorId(Guid value) => new(value);
    public static AuthorId New() => new(Guid.NewGuid());
}
```

Execute `RegisterAuthor` through `ICommandPipeline`. Check `IsSuccess` and that exactly one `AuthorRegistered` with the supplied name was appended to `Id`.

## Avoid

- Do not append in `Handle`. Return the event; Arc with Chronicle appends it.
- Do not use a plain `Guid` for the event source property. Use `AuthorId` on the command and read model.
- Do not call `AuthorId.New()` inside `Handle`; the caller already chose `Id`.

## Related skills

- [Invoke the command](../cratis-arc-invoke-command/SKILL.md)
- [Name a domain value](../cratis-fundamentals-name-value/SKILL.md)
