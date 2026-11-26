---
name: cratis-arc-expose-mcp-operation
description: Publishes an Arc command or query as an MCP tool. Use when a client needs to call a command or a finite query over MCP. Not for exposing the HTTP query (use cratis-arc-expose-query).
compatibility: Requires Cratis.Arc.Mcp and Cratis.Arc.PersonalAccessTokens; the Library examples use Cratis and Cratis.Arc.MongoDB.
---

# Expose an author operation as an MCP tool

In a local Arc-only Web SDK host, install the personal access token (PAT) verifier, bind a separate capabilities port and enable MCP on the same Arc builder. Use your application's existing `LibraryPersonDirectory` implementation of `Cratis.Arc.Identity.Callers.ICallerPersonDirectory`: its `Find` must resolve the verified account key against persisted person records. The example assumes that type is in `Library.Identity`. In `Program.cs`:

```csharp
using Cratis.Arc;
using Library.Identity;
using Cratis.Arc.Mcp;
using Cratis.Arc.PersonalAccessTokens;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:5000", "http://127.0.0.1:5002");
builder.AddCratisArc(options => options.EndpointGroups.Assign("capabilities", 5002),
    configureBuilder: arc => arc
    .WithPersonalAccessTokens(new PatOptions("direct") { AllowedScopes = ["catalog:read", "catalog:write"] },
        callers => callers.ForResource("urn:catalog", "catalog-mcp", "development").UsePersonDirectory<LibraryPersonDirectory>())
    .WithCapabilities()
    .WithMcp(mcp => mcp.Configure(options => options.ApplicationName = "catalog")));
var app = builder.Build();
app.UseCratisArc();
app.MapArcMcp();
await app.RunAsync();
```

`direct` is the PAT format key. `ForResource` binds the receiver to its resource URI, credential audience and deployment environment. Match all three to the token issuer. Register your authoritative `IPatAuthority`, `IPatRecoveryEpoch` and `IPatPolicy` implementations before `Build()`; the default adapters refuse issuance and verification. If PAT callers are already installed for this resource, retain that installation and only add the allowed scopes, capabilities and MCP configuration. Do not install a second verifier.

In a combined Library host, assign the port in `AddCratis`'s `configureArcOptions` and chain the three builder calls above after `WithMongoDB` in `configureArcBuilder`. Keep Chronicle registration. `catalog` gives queries the default `catalog:read` scope and commands `catalog:write`. The local client endpoint here is `http://127.0.0.1:5002/mcp`. Use HTTPS for remote clients.

In `Features/Authors/Registration/RegisterAuthor.cs` (`Library.Features.Authors.Registration`) annotate the [command](../cratis-arc-declare-command/SKILL.md) itself. Its `AuthorId` and `AuthorRegistered` stay unchanged:

```csharp
// Import Cratis.Arc.Mcp and add alongside [Command] on RegisterAuthor.
[ExposeOverMcp("register_author", Description = "Registers an author in the library.")]
```

For a list, annotate the **method** on the existing [Author projection](../cratis-chronicle-project-view/SKILL.md) in `Features/Authors/Listing/Author.cs` (`Library.Features.Authors.Listing`). Import `Cratis.Arc.Mcp` and `MongoDB.Driver`, then add this method to `Author`:

```csharp
[ExposeOverMcp("list_authors", Description = "Lists the library's authors.")]
public static IEnumerable<Author> ListAuthors(IMongoCollection<Author> collection) =>
    collection.Find(_ => true).ToList();
```

Give the tool a name matching `^[a-z][a-z0-9_]{0,63}$` and a description. `System.ComponentModel.DescriptionAttribute` on a query parameter or command property describes the argument.

## Avoid

- Do not expose `AllAuthors` returning `ISubject<T>`; a tool returns one result.
- Do not rely on hiding the tool. An insufficiently scoped caller must neither see it nor get data by calling it by name.
- Do not treat mapping `/mcp` as issuing credentials; configure verified callers and keep operation authorization in force.

## Related skills

- [Declare the command](../cratis-arc-declare-command/SKILL.md)
- [Protect the operation](../cratis-arc-authorize-request/SKILL.md)
