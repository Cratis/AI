# Check compatibility while old readers stay deployed

Use this one-off rollout check only when generation-one consumers must keep reading as the new writer goes live. Reuse an existing hosted compatibility suite if this is a standing public contract. For the ordinary rename, the migration spec in [the skill](../SKILL.md) is enough.

Use `Cratis.Chronicle.Testing` in the test project only. Compile the original generation-one `AuthorRegistered` unchanged in a test-support project named `GenerationOne`. Give the project reference an alias: `<ProjectReference Include="../GenerationOne/GenerationOne.csproj" Aliases="v1" />`. At the start of the test file, before other imports, write `extern alias v1;` then `using V1Registration = v1::Library.Features.Authors.Registration.AuthorRegistered;`.

Import `Cratis.Chronicle`, `Cratis.Chronicle.Testing`, `Cratis.Chronicle.Events`, `Cratis.Chronicle.Projections.ModelBound`, `Library.Features.Authors` and `Library.Features.Authors.Registration`. Keep both projections in the test assembly:

```csharp
[FromEvent<AuthorRegistered>] public record CurrentAuthor(AuthorId Id, string DisplayName);
[FromEvent<AuthorRegisteredV1>] public record PreviousAuthor(AuthorId Id, string Name);
```

Use a disposable development kernel. Append an original event before connecting the upgraded client:

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

Get `var store = await updated.GetEventStore(storeName, "migration-test");` and a different `var newAuthorId = AuthorId.New();`. Append `new AuthorRegistered("Birch")` for `newAuthorId` and check acceptance. Read `await store.ReadModels.GetInstanceById<CurrentAuthor>(oldAuthorId.Value)` until `DisplayName` is `"Aster"` and `await store.ReadModels.GetInstanceById<PreviousAuthor>(newAuthorId.Value)` until `Name` is `"Birch"`; stop with a timeout if either hasn't arrived after 30 seconds. Filtering on the stored event type ID alone does not select a generation.

If the deployed reader is a replayable PDL projection, save its definition with `GenerationDelivery = Pinned` while V1 is the latest registered generation. Register V2 and append a V2 event without resaving the declaration. Replay from the beginning and check the V1 field mapping against both an originally V1 event and the V2 event. Check the persisted definition’s resolved generation as well as the output.
