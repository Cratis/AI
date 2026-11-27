---
name: cratis-arc-expose-mcp-operation
description: Use when a developer needs to expose an authorized Arc command or a finite query as a scoped MCP tool. Not for exposing the HTTP query (use cratis-arc-expose-query).
compatibility: Requires Cratis.Arc.Mcp and Cratis.Arc.PersonalAccessTokens; the Library examples use Cratis and Cratis.Arc.MongoDB.
---

# Expose an author operation as an MCP tool

Start with a finite read. Expose a write only if the verified caller is allowed to make that change without a separate approval.

## Prepare the host

If verified callers are already configured, extend the existing scopes and tool catalog without adding another verifier. For a new local Arc-only Web SDK host, install the personal access token (PAT) verifier, bind a separate capabilities port and enable MCP on the same Arc builder. Use your application's existing `LibraryPersonDirectory` implementation of `Cratis.Arc.Identity.Callers.ICallerPersonDirectory`: its `Find` must resolve the verified account key against persisted person records. The example assumes that type is in `Library.Identity`. In `Program.cs`:

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
    configureBuilder: arc => arc.WithCapabilities()
    .WithPersonalAccessTokens(new PatOptions("direct") { AllowedScopes = ["catalog:read", "catalog:write"] },
        callers => callers.ForResource("urn:catalog", "catalog-mcp", "development").UsePersonDirectory<LibraryPersonDirectory>())
    .WithMcp(mcp => mcp.Configure(options => options.ApplicationName = "catalog")));
var app = builder.Build();
app.UseCratisArc();
app.MapArcMcp();
await app.RunAsync();
```

`direct` is the PAT format key. `ForResource` binds the receiver to its resource URI, credential audience and deployment environment. Match all three to the token issuer. The default token adapters refuse issuance and verification. If the application supplies the implementations below, import `Microsoft.Extensions.DependencyInjection` and register them before `Build()`:

```csharp
builder.Services.AddScoped<IPatAuthority, LibraryPatAuthority>();
builder.Services.AddScoped<IPatRecoveryEpoch, LibraryPatRecoveryEpoch>();
builder.Services.AddScoped<IPatPolicy, LibraryPatPolicy>();
```

For a combined Library host, merge `options.EndpointGroups.Assign("capabilities", 5002)` into the `configureArcOptions` lambda on `builder.AddCratis(...)`. Extend that call's existing `configureArcBuilder` lambda with the `.WithCapabilities().WithPersonalAccessTokens(...).WithMcp(...)` chain above. Keep the existing MongoDB and Chronicle registration. `catalog` gives queries the default `catalog:read` scope and commands `catalog:write`. The local client endpoint here is `http://127.0.0.1:5002/mcp`. Use HTTPS for remote clients.

## Add a tool

For a list, annotate the **method** on the existing [Author projection](../cratis-chronicle-project-view/SKILL.md) in `Features/Authors/Listing/Author.cs` (`Library.Features.Authors.Listing`). Import `Cratis.Arc.Mcp` and `MongoDB.Driver`, then add this method to `Author`:

```csharp
[ExposeOverMcp("list_authors", Description = "Lists the library's authors.")]
public static IEnumerable<Author> ListAuthors(IMongoCollection<Author> collection) =>
    collection.Find(_ => true).ToList();
```

For an allowed write, import `Cratis.Arc.Mcp` in `Features/Authors/Registration/RegisterAuthor.cs` and add `[ExposeOverMcp("register_author", Description = "Registers an author in the library.")]` alongside `[Command]` on [RegisterAuthor](../cratis-arc-declare-command/SKILL.md).

Give the tool a name matching `^[a-z][a-z0-9_]{0,63}$` and a description. For an argument description on a command record parameter, use `[property: System.ComponentModel.Description("The author's display name")] string Name`.

## When it goes off the usual path

- **A command marked `[RequiresApproval]` is exposed:** Arc rejects the catalog at startup. Remove its MCP exposure, not the approval requirement. Keep the command on the approved application path.

## Avoid

- Do not expose `AllAuthors` returning `ISubject<T>`; a tool returns one result.
- Do not rely on hiding the tool. An insufficiently scoped caller must neither see it nor get data by calling it by name.
- Do not treat mapping `/mcp` as issuing credentials; configure verified callers and keep operation authorization in force.

## Related skills

- [Declare the command](../cratis-arc-declare-command/SKILL.md)
- [Protect the operation](../cratis-arc-authorize-request/SKILL.md)
