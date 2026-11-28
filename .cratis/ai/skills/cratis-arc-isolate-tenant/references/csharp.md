# Check tenant membership before accessing authors

Keep the host's existing selection mechanism, including header selection when callers choose a tenant. A resolver selects a tenant; it does not establish that the caller belongs to it. A request header expresses a selection, not membership. Register a separate synchronous `ITenantMembership` check against trusted membership claims.

In the Arc-only host's `Program.cs`, keep the existing authentication and tenant resolver setup and register the check. If the caller selects the tenant by header, replace the claim registration below with `builder.AddCratisArc(options => options.UseHeaderTenancy("X-Library-Tenant"));` and send `X-Library-Tenant: tenant-a` on the request. In a combined Library host, configure claim selection with `builder.AddCratis(configureArcOptions: options => options.UseClaimTenancy("tenant_id"));` rather than registering Arc twice.

```csharp
using Library.Tenancy;
using Cratis.Arc.Tenancy;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);
builder.AddCratisArc(options => options.UseClaimTenancy("tenant_id"));
builder.Services.AddScoped<ITenantMembership, ClaimsTenantMembership>();
var app = builder.Build();
app.UseCratisArc();
await app.RunAsync();
```

In `Tenancy/ClaimsTenantMembership.cs`, use the **verified** membership claims supplied by your identity provider. Here `tenant_id` selects the active tenant and each `member_of` claim grants membership in one tenant.

```csharp
using System.Security.Claims;
using Cratis.Arc.Tenancy;

namespace Library.Tenancy;

public class ClaimsTenantMembership : ITenantMembership
{
    public bool IsMember(ClaimsPrincipal principal, TenantId tenantId) =>
        principal.Identity?.IsAuthenticated == true && !tenantId.IsDefault &&
        !string.IsNullOrWhiteSpace(tenantId.Value) &&
        principal.HasClaim("member_of", tenantId.Value);
}
```

`IsDefault` rejects both `TenantId.NotSet` and `TenantId.Default`; use this guard when selection is mandatory. Test both a missing selection and an explicit default selection as well as a nonmember selection.

Register the same `AuthorId` with different names in tenant A and tenant B as authorized members. Call `AllAuthors` in each tenant and check that the matching row has only that tenant's name. If using Chronicle, verify that each tenant's configured event store or namespace contains only its own registration for that ID. Denying a nonmember does not prove storage isolation: also check that a caller whose `tenant_id` names a tenant missing from its `member_of` claims gets HTTP 403.

## When it goes off the usual path

- **One deployment tenant contains several organizations:** use `options.UseFixedTenancy("library")` when every organization shares the `library` Chronicle namespace through tenant-based namespace resolution. With `ClaimsTenantMembership` above, the caller still needs a verified `member_of` claim with value `library`. Tenant membership does not grant access to every row. For example, filter an editor's author list to their authorized organization and check the author's organization before allowing an edit. Test that an editor for A cannot edit B's author by ID even though both use `library`.
- **An authorized background job runs without a request:** inject `ITenantScope tenantScope` and call `using var scope = tenantScope.Begin(tenantId);` before resolving tenant-bound services in a fresh DI scope. The worker must authorize `tenantId` first; `Begin` does not run `ITenantMembership`. Do not reuse services from a previous tenant's job.

## Avoid

- Do not trust membership supplied in a command body; inspect the verified principal.
- Do not perform I/O in `IsMember`; use membership already established for this request.
- Do not configure a single fixed tenant for a host serving multiple tenants.

`ITenantIdResolver` returns a tenant identity; `TenantId.NotSet` is a sentinel, not null. Header, query and host selection remain caller-controlled until membership has been checked. Never carry an unchecked selection into an explicit worker scope.
