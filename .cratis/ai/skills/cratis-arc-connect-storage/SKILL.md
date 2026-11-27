---
name: cratis-arc-connect-storage
description: Use when a developer needs to connect a typed MongoDB reader or register Neo4j graph views for projected relationships. Not for defining a projection (use cratis-chronicle-project-view).
compatibility: Requires the matching Arc storage integration; observable MongoDB queries require change streams.
---

# Connect Arc to MongoDB

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

In [the author query](../cratis-arc-expose-query/SKILL.md), take `IMongoCollection<Author>` as a method parameter. Register an author and check that `AllAuthors` returns it. With Arc's default database resolver, tenant `A` uses `library+A`, not `library`; this is not a naming rule the query should implement. Resolve tenant membership before selecting storage.

## When it goes off the usual path

- **An existing author is missing:** compare the reader's physical server, database and collection with the writer, then compare BSON field names before changing conventions.
- **Tenants use separate database names on the same server:** add `"ConnectionResolution": { "Connection": { "Resolver": "Template", "Template": { "Database": "tenant-{tenant}" } } }` inside `Cratis:MongoDB`. This replaces the default naming, not the stored data; provision or migrate the target databases before switching. Leave `AllAuthors` unchanged.

## When the read follows projected edges

Keep MongoDB for a flat document lookup. Use graph views when a graph projection already writes the nodes and edges and the screen needs a fixed traversal, such as a group and its members. A view reads those relationships; it does not create them or eager-load unrelated documents. For example, in a membership graph the projection maps `GroupCreated` to a `[Node]` with `[Key] Guid GroupId`. `MemberAdded` creates a `MemberOf` edge from its `PersonId` (`[Source<Person>]`) to its `GroupId` (`[Target<Group>]`). A group view can follow that same edge to the person. The event keys must name the projected nodes, not the ID of the membership event.

With an application-configured Neo4j server (5.6 or later), add the matching `Cratis.Arc.Neo4j.Chronicle` package and call `arc.WithNeo4j().WithNeo4jGraphViews()` on the Arc builder instead of registering MongoDB for this reader. Match the writer's database, tenant namespace, node keys and edge direction. [Query the graph view](../cratis-arc-expose-query/SKILL.md) with a known root and a known related node. If the root exists with an empty collection, inspect the projected edge before changing the query.

For changes to an EF table, [prepare a relational migration](../cratis-arc-migrate-relational-schema/SKILL.md) instead.

## Avoid

- Do not construct database or collection names in `AllAuthors`; inject the typed collection.
- Do not configure different naming policies on the reader and writer. Compare BSON field names if a known document cannot be read.
- Do not map concepts into nested `Value` documents; the configured serializers store their underlying values.

## Related skills

- [Expose AllAuthors](../cratis-arc-expose-query/SKILL.md)
- [Select the tenant](../cratis-arc-isolate-tenant/SKILL.md)
