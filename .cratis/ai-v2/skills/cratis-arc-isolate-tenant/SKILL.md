---
name: cratis-arc-isolate-tenant
description: Resolves the request tenant and checks caller membership. Use when tenants share a deployment but must not see each other's authors. Not for choosing a database server (use cratis-arc-connect-storage).
compatibility: Requires Cratis.Arc in a web host with a verified caller identity.
---

# Check tenant membership before accessing authors

Select the tenant from a trusted claim. A resolver selects a tenant; it does not establish that the caller belongs to it. Register a separate synchronous `ITenantMembership` check.

In the Arc-only host's `Program.cs`, keep the existing authentication setup and add the tenant configuration below. In a combined Library host pass `configureArcOptions: options => options.UseClaimTenancy("tenant_id")` to the existing `AddCratis` call instead of registering Arc twice.

```csharp
using Catalog.Tenancy;
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

namespace Catalog.Tenancy;

public class ClaimsTenantMembership : ITenantMembership
{
    public bool IsMember(ClaimsPrincipal principal, TenantId tenantId) =>
        principal.Identity?.IsAuthenticated == true && tenantId != TenantId.NotSet &&
        principal.HasClaim("member_of", tenantId.Value);
}
```

Call the same author query with the same ID under two tenant identities. Each member should see only its tenant's name; a caller selecting a tenant without membership must receive no data.

## Avoid

- Do not trust membership supplied in a command body; inspect the verified principal.
- Do not perform I/O in `IsMember`; use membership already established for this request.
- Do not ship fixed or development tenancy as per-caller routing; both select one tenant.
- Explicit background scopes bypass request membership. Authorize first, then call `tenantScope.Begin(tenantId)` before resolving scoped services.

## Related skills

- [Authorize the operation](../cratis-arc-authorize-request/SKILL.md)
- [Connect MongoDB](../cratis-arc-connect-storage/SKILL.md)
