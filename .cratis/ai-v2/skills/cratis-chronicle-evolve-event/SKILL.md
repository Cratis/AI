---
name: cratis-chronicle-evolve-event
description: Migrates a stored event to a new generation without changing its identity. Use when renaming a payload property or making a breaking shape change. Not for changing a database schema (use cratis-arc-connect-storage).
compatibility: .NET SDK and Chronicle event migrations.
---

# Rename AuthorRegistered.Name without breaking older readers

1. Reference `Cratis.Chronicle`. Keep the old `Name` record, the new `DisplayName` record and the migration in the author registration feature.
2. Keep the stored ID `AuthorRegistered` and increment the generation. Mark the old type with `[EventTypeGenerationFor<AuthorRegistered>(1)]`. Both types must resolve to the same ID and their generations must be adjacent.
3. Put `AuthorRegisteredMigration` in the backend assembly with the event records. Chronicle's default client finds migration implementations in the assemblies it scans; no separate migration registration is needed with default discovery. In both methods, specify the destination property first, then the source property.

```csharp
// Features/Authors/Registration/AuthorRegisteredMigration.cs
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Events.Migrations;

namespace Library.Authors.Registration;

[EventType(generation: 2)] public record AuthorRegistered(string DisplayName);
[EventTypeGenerationFor<AuthorRegistered>(1)] public record AuthorRegisteredV1(string Name);

public class AuthorRegisteredMigration : EventTypeMigration<AuthorRegistered, AuthorRegisteredV1>
{
    public override void Upcast(IEventMigrationBuilder<AuthorRegistered, AuthorRegisteredV1> builder) =>
        builder.Properties(p => p.RenamedFrom(t => t.DisplayName, s => s.Name));

    public override void Downcast(IEventMigrationBuilder<AuthorRegisteredV1, AuthorRegistered> builder) =>
        builder.Properties(p => p.RenamedFrom(t => t.Name, s => s.DisplayName));
}
```

## Read each generation through a projection

Append `Name = "Aster"` with a client that registers only generation one. Start the updated client with both generations and the migration. Read the projected author by ID using a projection subscribed to `AuthorRegistered`; check `DisplayName`. Append a generation-two registration for another author, read a projection subscribed to `AuthorRegisteredV1`, and check `Name`. For this check, define these two projections in the same registration namespace (import `Cratis.Chronicle.Projections.ModelBound`):

```csharp
[FromEvent<AuthorRegistered>] public record CurrentAuthor(AuthorId Id, string DisplayName);
[FromEvent<AuthorRegisteredV1>] public record PreviousAuthor(AuthorId Id, string Name);
```

Read them with `await store.ReadModels.GetInstanceById<CurrentAuthor>(oldAuthorId.Value)` and `await store.ReadModels.GetInstanceById<PreviousAuthor>(newAuthorId.Value)`. A filter on stored event type ID alone does not select a generation. Use `AuthorId` from [Record an event](../cratis-chronicle-record-event/SKILL.md).

## Avoid

- Don't give the rename a new event type ID.
- Don't reverse the arguments to `RenamedFrom` in the downcast: `Name` is its destination.
- Don't assume registering the migration rewrites stored events or rebuilds existing read models.

## Related skills

- [Declare a registration](../cratis-chronicle-record-event/SKILL.md)
- [Project registrations](../cratis-chronicle-project-view/SKILL.md)
