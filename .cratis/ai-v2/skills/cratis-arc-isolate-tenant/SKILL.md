---
name: cratis-arc-isolate-tenant
description: Use when resolving the request tenant or checking caller membership to keep tenants in a shared deployment from seeing each other's data. Not for choosing a database server (use cratis-arc-connect-storage).
compatibility: Requires Cratis.Arc in a web host with a verified caller identity.
---

# Check tenant membership before accessing authors

Keep the host's existing selection mechanism, including header selection when callers choose a tenant. A resolver selects a tenant; it does not establish that the caller belongs to it. Register a separate synchronous `ITenantMembership` check against trusted membership claims.

In the Arc-only host's `Program.cs`, keep the existing authentication and tenant resolver setup and register the check. For header selection, keep `options.UseHeaderTenancy(...)` with the configured header name. The example selects from a claim; for a combined Library host, configure the same resolver through `AddCratis(configureArcOptions: ...)` instead of registering Arc twice.

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

Call `AllAuthors` as a member of tenant A and as a member of tenant B. Each sees only its own tenant's authors. A caller whose `tenant_id` names a tenant missing from its `member_of` claims gets HTTP 403.

## Avoid

- Do not trust membership supplied in a command body; inspect the verified principal.
- Do not perform I/O in `IsMember`; use membership already established for this request.
- Do not use `UseFixedTenancy()` or `UseDevelopmentTenancy()` for per-caller routing; both select one tenant for every caller.
- Do not rely on request membership in background work. Inject `ITenantScope tenantScope` into the worker. After authorizing its target `TenantId tenantId`, use `using var scope = tenantScope.Begin(tenantId);` before resolving tenant-bound services in a fresh DI scope. An explicit selection does not run `ITenantMembership`.

## Related skills

- [Authorize the operation](../cratis-arc-authorize-request/SKILL.md)
- [Connect MongoDB](../cratis-arc-connect-storage/SKILL.md)
