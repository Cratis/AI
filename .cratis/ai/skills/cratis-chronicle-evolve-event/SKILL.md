---
name: cratis-chronicle-evolve-event
description: Use when an event type needs a new generation with the same identity because a payload property was renamed or its shape has a breaking change. Not for changing a database schema (use cratis-arc-connect-storage).
compatibility: .NET SDK and Chronicle event migrations.
---

# Rename AuthorRegistered.Name without breaking older readers

1. Reference `Cratis.Chronicle`. In an isolated upgrade of the registration feature (not alongside its generation-one implementation), keep the old `Name` record, the new `DisplayName` record and the migration in the author registration feature.
2. Keep the stored ID `AuthorRegistered` and increment the generation. Mark the old type with `[EventTypeGenerationFor<AuthorRegistered>(1)]`. Both types must resolve to the same ID and their generations must be adjacent.
3. Put `AuthorRegisteredMigration` in the backend assembly with the event records. Chronicle's default client finds migration implementations in the assemblies it scans; no separate migration registration is needed with default discovery. In both methods, specify the destination property first, then the source property.

```csharp
// Features/Authors/Registration/AuthorRegisteredMigration.cs
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Events.Migrations;
using Cratis.Chronicle.Events.Constraints;

namespace Library.Features.Authors.Registration;

// Change the existing AuthorRegistered.cs in this revision.
[EventType(generation: 2)] public record AuthorRegistered(
    [property: Unique(name: "UniqueAuthorName", message: "Author name must be unique")] string DisplayName);
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

In the **test project only**, reference `Cratis.Chronicle.Testing`. Import `Cratis.Chronicle`, `Cratis.Chronicle.Testing`, `Cratis.Chronicle.Events`, `Cratis.Chronicle.Projections.ModelBound`, `Library.Features.Authors` and `Library.Features.Authors.Registration`. Compile the original `Features/Authors/Registration/AuthorRegistered.cs` unchanged in a separate test-support project `GenerationOne`. Add `<ProjectReference Include="../GenerationOne/GenerationOne.csproj" Aliases="v1" />` in the test project. At the top of the test file, before other imports, write `extern alias v1;` then `using V1Registration = v1::Library.Features.Authors.Registration.AuthorRegistered;`. Keep both test projections in the test assembly, not the application's discovered assembly:

```csharp
[FromEvent<AuthorRegistered>] public record CurrentAuthor(AuthorId Id, string DisplayName);
[FromEvent<AuthorRegisteredV1>] public record PreviousAuthor(AuthorId Id, string Name);
```

Against a disposable development kernel, use two clients in sequence. Choose a fresh store name for the test and pass the same store name and namespace to both clients' `GetEventStore` calls.

```csharp
var options = ChronicleOptions.FromDevelopmentConnectionString();
using var legacy = new ChronicleClient(options, new InMemoryClientArtifactsProvider
{
    EventTypes = [typeof(V1Registration)]
});
var storeName = $"library-{Guid.NewGuid():N}";
var oldAuthorId = AuthorId.New();
var oldStore = await legacy.GetEventStore(storeName, "migration-test");
var first = await oldStore.EventLog.Append(oldAuthorId, new V1Registration("Aster"));
if (!first.IsSuccess) throw new InvalidOperationException("Generation-one registration failed");
using var updated = new ChronicleClient(options, new InMemoryClientArtifactsProvider
{
    EventTypes = [typeof(AuthorRegisteredV1), typeof(AuthorRegistered)],
    EventTypeMigrators = [typeof(AuthorRegisteredMigration)],
    ModelBoundProjections = [typeof(CurrentAuthor), typeof(PreviousAuthor)]
});
```

Get `var store = await updated.GetEventStore(storeName, "migration-test");` and a different `var newAuthorId = AuthorId.New();`. Use the updated store to append `new AuthorRegistered("Birch")` for `newAuthorId`. Check acceptance of each append. Read `await store.ReadModels.GetInstanceById<CurrentAuthor>(oldAuthorId.Value)` until `DisplayName` is `"Aster"` and `await store.ReadModels.GetInstanceById<PreviousAuthor>(newAuthorId.Value)` until `Name` is `"Birch"`; fail the test if either hasn't arrived after 30 seconds. A filter on stored event type ID alone does not select a generation. Use `AuthorId` from [Name a domain value](../cratis-fundamentals-name-value/SKILL.md).

## Avoid

- Don't give the rename a new event type ID.
- Don't reverse the arguments to `RenamedFrom` in the downcast: `Name` is its destination.
- Don't assume registering the migration rewrites stored events or rebuilds existing read models.

## When it goes off the usual path

- **The business outcome was wrong:** choose a compensating fact when correcting what happened, not how the same fact is represented.
- **A stored value changes as well as the property name:** if `"A. Birch"` becomes `"Anna Birch"`, for that alternative replace the rename-only migration with `public override void MapValues(IEventValueMapBuilder<AuthorRegistered, AuthorRegisteredV1> builder) => builder.For(current => current.DisplayName, previous => previous.Name, map => map.Map("A. Birch", "Anna Birch"));` and leave `Upcast` and `Downcast` empty for this property. Assert both directions with the mapped values.
- **Generation three fails to register:** mark the former current payload `[EventTypeGenerationFor<AuthorRegistered>(2)]` and keep the generation-one type. Use `EventTypeMigration<AuthorRegisteredV2, AuthorRegisteredV1>` and `EventTypeMigration<AuthorRegistered, AuthorRegisteredV2>` for the two adjacent pairs. Test the oldest payload through the full chain and the current payload through the oldest consumer.

## Related skills

- [Declare a registration](../cratis-chronicle-record-event/SKILL.md)
- [Project registrations](../cratis-chronicle-project-view/SKILL.md)
