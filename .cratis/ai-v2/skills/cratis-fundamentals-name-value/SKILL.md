---
name: cratis-fundamentals-name-value
description: Defines typed C# domain values and Chronicle identifiers. Use when naming a concept, replacing a primitive or declaring a strongly typed ID. Not for deciding whose history changes (use cratis-modeling-discover-timeline).
compatibility: Requires the .NET SDK.
---

# Declare an author name and author ID

Give the scalar and the identity different types. An author name describes the author; an author ID addresses that author's history.

1. Name the type after the business value, not its representation.
2. Declare an ordinary scalar as a record over `ConceptAs<T>`.
3. Declare the identity of a Chronicle entity over `EventSourceId<T>`. Give the GUID-based identity a `New()` factory.
4. Use `AuthorId` for `RegisterAuthor.Id` and `Author.Id`. Check that `AuthorRegistered` is appended to the requested author's history.

## Declare the Library types

In the Library backend, reference the `Cratis` package. Put these declarations in `Features/Authors/AuthorName.cs` and `Features/Authors/AuthorId.cs`, each in its own file:

```csharp
using Cratis.Concepts;

namespace Library.Features.Authors;

public record AuthorName(string Value) : ConceptAs<string>(Value);
```

```csharp
using System;
using Cratis.Chronicle.Events;

namespace Library.Features.Authors;

public record AuthorId(Guid Value) : EventSourceId<Guid>(Value)
{
    public static AuthorId New() => new(Guid.NewGuid());
}
```

## Avoid

- Don't use an unlabelled `Guid` for the command key; use `AuthorId`.
- Don't use an ordinary name as the history address; keep identity distinct from payload.
- Don't rely on the concept declaration to validate format; express that as a separate rule.

## Related skills

- [Discover the timeline](../cratis-modeling-discover-timeline/SKILL.md) to identify the thing that owns the history.
- [Declare the command](../cratis-arc-declare-command/SKILL.md) once the request values are named.
