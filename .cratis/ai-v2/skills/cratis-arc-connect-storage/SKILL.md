---
name: cratis-arc-connect-storage
description: Use when adding MongoDB to an Arc host for typed queries or when IMongoCollection does not resolve or returns no rows. Not for defining a projection (use cratis-chronicle-project-view).
compatibility: Requires Cratis and Cratis.Arc.MongoDB; observable queries require MongoDB change streams.
---

# Connect Arc to MongoDB

Use `Cratis.Arc.MongoDB` for the Library author view. Choose `Cratis.Arc.EntityFrameworkCore` with `WithEntityFrameworkCore(...)` for a relational read through a `DbContext`, or `Cratis.Arc.Neo4j` with `WithNeo4j()` for a graph traversal. Match the integration to the data the slice reads, not to Chronicle's storage.

Reference `Cratis.Arc.MongoDB` in the Library backend. For a new database written by Chronicle, configure the same camel-case naming policy on both builders.

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
- **Tenants use separate servers or credentials:** use MongoDB `ConnectionResolution` to resolve the authorized tenant's binding before opening its database. Keep connection resolution out of `AllAuthors`; let Arc inject the collection.

## Avoid

- Do not construct database or collection names in `AllAuthors`; inject the typed collection.
- Do not configure different naming policies on the reader and writer. Compare BSON field names if a known document cannot be read.
- Do not map concepts into nested `Value` documents; the configured serializers store their underlying values.

## Related skills

- [Expose AllAuthors](../cratis-arc-expose-query/SKILL.md)
- [Select the tenant](../cratis-arc-isolate-tenant/SKILL.md)
