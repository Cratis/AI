---
name: cratis-arc-expose-mcp-operation
description: Use when a developer needs to expose an authorized Arc command or a finite query as a scoped MCP tool. Not for exposing the HTTP query (use cratis-arc-expose-query).
compatibility: Requires Cratis.Arc.Mcp and Cratis.Arc.PersonalAccessTokens; the Library examples use Cratis and Cratis.Arc.MongoDB.
---

# Expose an author operation as an MCP tool

Start with a finite read. Expose a write only if the verified caller is allowed to make that change without a separate approval.

## Prepare the host

Add explicit package references to the host project for `Cratis.Arc.Mcp` and `Cratis.Arc.PersonalAccessTokens`, both at version `24.9.0`. Neither comes with `Cratis` or `Cratis.Arc`.

**Existing verified host:** extend its PAT scopes and tool catalog on the same Arc builder. Do not install a second verifier. The example below shows the resulting configuration for an Arc-only receiver. It assumes a `LibraryPersonDirectory` implementing `Cratis.Arc.Identity.Callers.ICallerPersonDirectory` that resolves verified account keys to persisted person records.

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

`direct` is the PAT format key. `ForResource` binds the receiver to its resource URI, credential audience and deployment environment. Match all three to the token issuer. Keep the application's durable `IPatAuthority`, `IPatRecoveryEpoch` and `IPatPolicy` registrations.

**Fresh local host:** start with the [MCP quick start’s local development adapters](https://www.cratis.io/arc/backend/csharp/mcp/quick-start/#local-development-adapters). In Development only, `UseDevelopmentPersonalAccessTokenAdapters()` after `WithPersonalAccessTokens(...)` supplies those three adapters in memory, not a person directory or an issuance endpoint. Issuance still needs a verified browser caller. Without one, exercise that path in an isolated spec using the [verified-caller acceptance fixture](https://github.com/Cratis/Arc/tree/v24.9.0/Samples/VerifiedCallerAcceptance.Specs); never install its signer or key in the host.

For a combined Library host, merge `options.EndpointGroups.Assign("capabilities", 5002)` into the `configureArcOptions` lambda on `builder.AddCratis(...)`. Extend that call's existing `configureArcBuilder` lambda with the `.WithCapabilities().WithPersonalAccessTokens(...).WithMcp(...)` chain above. Keep the existing MongoDB and Chronicle registration. `catalog` gives queries the default `catalog:read` scope and commands `catalog:write`. The local client endpoint here is `http://127.0.0.1:5002/mcp`. Use HTTPS for remote clients.

## Add a tool

For a list, annotate the **method** on the existing Author projection (`cratis-chronicle-project-view` skill in `cratis/chronicle`) in `Features/Authors/Listing/Author.cs` (`Library.Features.Authors.Listing`). Import `Cratis.Arc.Mcp` and `MongoDB.Driver`, then add this method to `Author`:

```csharp
[ExposeOverMcp("list_authors", Description = "Lists the library's authors.")]
public static IEnumerable<Author> ListAuthors(IMongoCollection<Author> collection) =>
    collection.Find(_ => true).ToList();
```

For an allowed write, import `Cratis.Arc.Mcp` in `Features/Authors/Registration/RegisterAuthor.cs` and add `[ExposeOverMcp("register_author", Description = "Registers an author in the library.")]` alongside `[Command]` on RegisterAuthor (`cratis-arc-declare-command` skill in `cratis/arc`).

Give the tool a name matching `^[a-z][a-z0-9_]{0,63}$` and a description. For an argument description on a command record parameter, use `[property: System.ComponentModel.Description("The author's display name")] string Name`.

## One-off scope check

With both tools configured and a client PAT issued for `catalog:read` only, list tools on the capabilities listener. Supply `PAT` privately; do not log it.

```sh
curl -fsS http://127.0.0.1:5002/mcp \
  -H "Authorization: Bearer $PAT" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

In the result, expect `list_authors` and no `register_author`.

## When it goes off the usual path

- **A command marked `[RequiresApproval]` is exposed:** Arc rejects the catalog at startup. Remove its MCP exposure, not the approval requirement. Keep the command on the approved application path.

## Avoid

- Do not expose `AllAuthors` returning `ISubject<T>`; a tool returns one result.
- Do not rely on hiding the tool. An insufficiently scoped caller must neither see it nor get data by calling it by name.
- Do not treat mapping `/mcp` as issuing credentials; configure verified callers and keep operation authorization in force.

## Related skills

- Declare the command (`cratis-arc-declare-command` skill in `cratis/arc`)
- [Protect the operation](../cratis-arc-authorize-request/SKILL.md)

## Diagnose admission with the client credential

Check startup first, then reachability of the capability listener and the mapped POST, then authentication, origin, tool listing and invocation. A public GET or a tool appearing under another profile proves none of these. Use `PatOnly` for a PAT, `OAuthOnly` for OAuth or `Combined` only when both are intended. Configure the public origin, resource and authorization servers from trusted deployment settings, never the incoming Host header. An absent Origin is not the same as a disallowed browser Origin.

Publication installs no caller credential. Check the verified caller installation, allowed scopes and the PAT authority, issuance policy and recovery epoch separately. Development adapters do not bypass issuance. Each tool needs effective scopes; a write needs a recognized write scope. Enforce policy both when listing and when calling by name, including for custom server tools. A challenge means check credential kind and validity; a forbidden tool can instead mean insufficient scopes or operation policy. Retest both list and call with the actual client's profile and credential.
