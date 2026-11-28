# C#: connect an Arc reader to MongoDB, EF Core or Neo4j

Choose by where the data already lives: MongoDB for documents (the default below), EF Core for a relational table, Neo4j for a projected graph. `Cratis:MongoDB`, `Cratis:EntityFrameworkCore` and `Cratis:Neo4j` are sibling configuration sections, not children of the generated-API options.

## MongoDB

Reference `Cratis.Arc.MongoDB` in the Library backend. Match the integration to the data the slice reads, not to Chronicle's storage. For a new database written by Chronicle, configure the same camel-case naming policy on both builders.

`Program.cs` (top-level statements in a Web SDK project):

```csharp
using Cratis.Arc.MongoDB;
using Microsoft.AspNetCore.Builder;

var builder = WebApplication.CreateBuilder(args);
builder.AddCratis(
    configureArcBuilder: arc => arc.WithMongoDB(configureMongoDB: mongo => mongo.WithCamelCaseNamingPolicy()),
    configureChronicleBuilder: chronicle => chronicle.WithCamelCaseNamingPolicy());
var app = builder.Build();
app.UseWebSockets();
app.UseCratis();
await app.RunAsync();
```

Set `Cratis:MongoDB:Server` and `Cratis:MongoDB:Database` in the host project's `appsettings.json`. For the default tenant, use the database that contains the projected author documents:

```json
{ "Cratis": { "MongoDB": { "Server": "mongodb://localhost:27017", "Database": "library" } } }
```

In the author query, take `IMongoCollection<Author>` as a method parameter. Register an author and check that `AllAuthors` returns it. With Arc's default database resolver, tenant `A` uses `library+A`, not `library`; this is not a naming rule the query should implement. Resolve tenant membership before selecting storage.

### Use native MongoDB operations

For ordinary reads, repositories and sinks, use `Builders<T>.Filter`, `.Sort` and `.Update` with the native driver. Use `Find` for documents and `Aggregate` for pipelines; compose `FilterDefinition<T>` and `PipelineDefinition<TInput, TOutput>` rather than queryables. Do not use `AsQueryable()` for ordinary reads: unsupported LINQ expressions, such as some casts on concept-valued members, fail at execution, not compilation. The exception is a provider-backed query Arc must compose for paging.

For the registered `IMongoCollection<Author> collection` above, import `MongoDB.Driver` and `MongoDB.Bson`. With the configured camel-case field names:

```csharp
FilterDefinition<Author> named = Builders<Author>.Filter.Eq(author => author.Name, "Aster");
var authors = collection.Find(named).ToList();
var counts = collection.Aggregate()
    .Match(named)
    .Group(new BsonDocument { { "_id", "$name" }, { "count", new BsonDocument("$sum", 1) } })
    .ToList();
```

With two Aster documents and one other author, expect two matches and a single Aster group with count two. Both reads filter in the database before `ToList()`; do not materialize first and filter in memory.

## When a document is missing or tenants use separate databases

- **An existing author is missing:** compare the reader's physical server, database and collection with the writer, then compare BSON field names before changing conventions.
- **Tenants use separate database names on the same server:** add `"ConnectionResolution": { "Connection": { "Resolver": "Template", "Template": { "Database": "tenant-{tenant}" } } }` inside `Cratis:MongoDB`. This replaces the default naming, not the stored data; provision or migrate the target databases before switching. Leave `AllAuthors` unchanged.

## When the read follows projected edges

Keep MongoDB for a flat document lookup. Use graph views when a graph projection already writes the nodes and edges and the screen needs a fixed traversal, such as a group and its members. A view reads those relationships; it does not create them or eager-load unrelated documents. For example, in a membership graph the projection maps `GroupCreated` to a `[Node]` with `[Key] Guid GroupId`. `MemberAdded` creates a `MemberOf` edge from its `PersonId` (`[Source<Person>]`) to its `GroupId` (`[Target<Group>]`). A group view can follow that same edge to the person. The event keys must name the projected nodes, not the ID of the membership event.

With an application-configured Neo4j server (5.6 or later), add the matching `Cratis.Arc.Neo4j.Chronicle` package and call `arc.WithNeo4j().WithNeo4jGraphViews()` on the Arc builder instead of registering MongoDB for this reader. Match the writer's database, tenant namespace, node keys and edge direction. Query the graph view with a known root and a known related node. If the root exists with an empty collection, inspect the projected edge before changing the query.

## Avoid with MongoDB

- Do not construct database or collection names in `AllAuthors`; inject the typed collection.
- Do not configure different naming policies on the reader and writer. Compare BSON field names if a known document cannot be read.
- Do not map concepts into nested `Value` documents; the configured serializers store their underlying values.

Reuse the registered Arc MongoDB services. A second, unconfigured `MongoClient` lacks the concept serializers, naming policy and tenant database selection, so it can read the wrong shape or the wrong database.

## EF Core

- **Discovery** runs only when `AutoDiscoverDbContexts` is on (the default) and the connection string is not empty, and it finds only `ReadOnlyDbContext` subclasses. A read model that a command takes as a parameter needs `[ReadModel]` and a public `DbSet<T>` on such a context; a set on a write context is not found.
- **`BaseDbContext`** supplies the conventions. An `OnModelCreating` override calls `base.OnModelCreating(modelBuilder)` first, or the conventions are lost.
- **`Upsert` is tracked** and needs `SaveChanges`. **`UpsertAsync`** writes immediately with native SQL on SQL Server, PostgreSQL and SQLite, bypassing change tracking and leaving tracked instances and generated values stale; other providers and mappings with generated keys, navigations or owned entities fall back to the tracked path and need `SaveChanges`. Use an application-assigned key, and never assume one call flushed unrelated pending changes.
- **Observation** (`Observe`, `ObserveSingle`, `ObserveById`) needs the observation services that `WithEntityFrameworkCore()` registers. A single-entity observation emits `null` when no row matches and stays subscribed. SQLite only sees writes made through the same application, so a passing in-process test does not prove that an external write is delivered.

## Neo4j

- Inject the scoped `IGraphSession`; it is a read session for the current tenant. Open `IGraphSessionFactory.Open(AccessMode.Write)` only for data no projection owns, and dispose it. Never write a projected graph from a query.
- The database name is computed by `GraphDatabaseName.For(prefix, eventStore, @namespace)`, the same algorithm the writer uses. Call it instead of building a similar-looking name.
- In single-database mode every tenant shares one database. The writer stamps `_namespace` on each element and the reader has to filter `WHERE n._namespace = $namespace`; receiving the `$namespace` parameter does not filter anything.
- `Query<T>` converts concept parameters and maps columns to members by name. When dropping to `Run` or `Session`, pass `graph.Parameters(...)` so the same conversion and `$namespace` apply.

## Verify the connection, not the startup

A host that starts has not connected. Read one known record through the query, then repeat with a second tenant and check that each sees only its own data. Connection and credentials resolve once per service scope for the current tenant: don't capture a resolved client, session or connection in a singleton.
