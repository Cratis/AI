---
name: cratis-arc-expose-mcp-operation
description: Publishes an Arc command or query as an MCP tool. Use when a client needs to register or list authors through MCP. Not for exposing the HTTP query (use cratis-arc-expose-query).
compatibility: Requires Cratis.Arc.Mcp on a host configured to authenticate MCP clients; the Library examples use Cratis and Cratis.Arc.MongoDB.
---

# Expose an author operation as an MCP tool

On the existing Arc registration in `Program.cs`, enable capabilities and MCP. Start with a host that authenticates MCP callers and supplies their granted scopes. Keep that configuration. For a local Arc-only Web SDK host, bind a second listener for capabilities and map the endpoint:

```csharp
using Cratis.Arc;
using Cratis.Arc.Mcp;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:5000", "http://127.0.0.1:5002");
builder.AddCratisArc(options => options.EndpointGroups.Assign("capabilities", 5002),
    configureBuilder: arc => arc.WithCapabilities()
    .WithMcp(mcp => mcp.Configure(options => options.ApplicationName = "catalog")));
var app = builder.Build();
app.UseCratisArc();
app.MapArcMcp();
await app.RunAsync();
```

In the Library host apply the port assignment in `AddCratis(configureArcOptions: ...)` and chain `WithCapabilities().WithMcp(...)` onto the existing `configureArcBuilder` expression; keep the existing Chronicle and Mongo registration. `catalog` gives queries the default `catalog:read` scope and commands `catalog:write`. The local client endpoint here is `http://127.0.0.1:5002/mcp`. Use HTTPS for remote clients.

In `Authors/RegisterAuthor.cs` annotate the [command](../cratis-arc-declare-command/SKILL.md) itself. Its `AuthorId` and `AuthorRegistered` stay unchanged:

```csharp
using Cratis.Arc.Mcp;

namespace Catalog.Authors;

[Command]
[ExposeOverMcp("register_author", Description = "Registers an author in the library.")]
public record RegisterAuthor(AuthorId Id, string Name)
{
    public AuthorRegistered Handle() => new(Name);
}
```

For a list, annotate the **method** on the existing `Author` read model in `Authors/Author.cs`. Add the imports and `ListAuthors` method; keep the existing `AllAuthors` method and event mapping:

```csharp
using Cratis.Arc.Mcp;
using MongoDB.Driver;

namespace Catalog.Authors;

[ReadModel]
[FromEvent<AuthorRegistered>]
public record Author(AuthorId Id, string Name)
{
    [ExposeOverMcp("list_authors", Description = "Lists the library's authors.")]
    public static IEnumerable<Author> ListAuthors(IMongoCollection<Author> collection) =>
        collection.Find(_ => true).ToList();
}
```

Give the tool a name matching `^[a-z][a-z0-9_]{0,63}$` and a description. `System.ComponentModel.DescriptionAttribute` on a query parameter or command property describes the argument.

## Avoid

- Do not expose `AllAuthors` returning `ISubject<T>`; a tool returns one result.
- Do not rely on hiding the tool. An insufficiently scoped caller must neither see it nor get data by calling it by name.
- Do not treat mapping `/mcp` as issuing credentials; configure verified callers and keep operation authorization in force.

## Related skills

- [Declare the command](../cratis-arc-declare-command/SKILL.md)
- [Protect the operation](../cratis-arc-authorize-request/SKILL.md)
