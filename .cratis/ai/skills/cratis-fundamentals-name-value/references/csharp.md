# Declare an author name and author ID

Give the scalar and the identity different types. An author name describes the author; an author ID addresses that author's history.

1. Name the type after the business value, not its representation.
2. Declare an ordinary scalar as a record over `ConceptAs<T>`, including entity IDs that do not address event history. Use a structured record for a group of related fields, not a scalar concept with extra mutable properties.
3. Use `EventSourceId<T>` only for an identity that addresses Chronicle history. Give the GUID-based identity a `New()` factory.
4. Use `AuthorId` for `RegisterAuthor.Id` and `Author.Id`. Keep `Name` a `string` on `RegisterAuthor`, `AuthorRegistered` and `Author`. `AuthorName` is an in-process value; the [direct append service](../../cratis-chronicle-record-event/SKILL.md) unwraps `name.Value`. Check the destination with `ShouldHaveAppendedEvent<RegisterAuthor, AuthorRegistered>(id, e => e.Name == "Aster")` in a [backend spec](../../cratis-specifications-exercise-backend/SKILL.md).

## Declare the Library types

In the Library backend, reference `Cratis.Fundamentals` for `ConceptAs<T>` and `Cratis.Chronicle` for `EventSourceId<T>`. Put these declarations in `Features/Authors/AuthorName.cs` and `Features/Authors/AuthorId.cs`, each in its own file:

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

## When it goes off the usual path

- **Two entities both use GUIDs:** give each its own concept. At the call site, accept `AuthorId` rather than `Guid` so passing a book's ID is a compile-time error. Convert wire text at the boundary, not in each handler.

## Avoid

- Don't use an unlabelled `Guid` for the command key; use `AuthorId`.
- Keep the stable `AuthorId` separate from `Name`. A business constraint may make names unique without making them the history address.
- For an invariant of `AuthorName`, use [concept validation](../../cratis-arc-validate-command/SKILL.md). For this command's plain `string Name`, put the empty-name rule in `RegisterAuthorValidator` instead.

## Related skills

- [Discover the timeline](../../cratis-modeling-discover-timeline/SKILL.md) to identify the thing that owns the history.
- [Declare the command](../../cratis-arc-declare-command/SKILL.md) once the request values are named.
