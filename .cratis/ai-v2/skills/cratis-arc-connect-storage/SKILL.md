---
name: cratis-arc-connect-storage
description: Registers MongoDB for typed Arc queries. Use when adding MongoDB to a host or when IMongoCollection does not resolve or returns no authors. Not for defining a projection (use cratis-chronicle-project-view).
compatibility: Requires Cratis and Cratis.Arc.MongoDB; observable queries require MongoDB change streams.
---

# Connect Arc to MongoDB

Reference `Cratis.Arc.MongoDB` in the Library backend. For a new database written by Chronicle, configure the same camel-case naming policy on both builders. For an existing database, match its naming policy.

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

Set both required reader values in the host project's `appsettings.json`. The example uses a local Mongo server and a database named `library`; it does not configure Chronicle's writer. Point the writer at the same server and tenant database before checking projected rows:

```json
{ "Cratis": { "MongoDB": { "Server": "mongodb://localhost:27017", "Database": "library" } } }
```

In [the author query](../cratis-arc-expose-query/SKILL.md), take `IMongoCollection<Author>` as a method parameter. Check that a known author written to the configured server and tenant database can be read by ID.

## Avoid

- Do not construct database or collection names in `AllAuthors`; inject the typed collection.
- Do not configure different naming policies on the reader and writer. Compare BSON field names if a known document cannot be read.
- Do not map concepts into nested `Value` documents; the configured serializers store their underlying values.

## Related skills

- [Expose AllAuthors](../cratis-arc-expose-query/SKILL.md)
- [Select the tenant](../cratis-arc-isolate-tenant/SKILL.md)
