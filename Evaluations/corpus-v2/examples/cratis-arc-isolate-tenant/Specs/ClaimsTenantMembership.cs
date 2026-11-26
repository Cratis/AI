using System.Security.Claims;
using Cratis.Arc.Tenancy;

namespace Catalog.Tenancy;

public class ClaimsTenantMembership : ITenantMembership
{
    public bool IsMember(ClaimsPrincipal principal, TenantId tenantId) =>
        principal.Identity?.IsAuthenticated == true && tenantId != TenantId.NotSet &&
        principal.HasClaim("member_of", tenantId.Value);
}
