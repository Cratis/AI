# Resolve and verify tenant scope in Node

When callers switch between tenants, configure the server with `tenancy: { sources: [TenantResolverType.Header], membershipClaim: 'memberships' }`. The `x-cratis-tenant-id` request header selects the tenant. Supply the authenticated principal through the host, with the trusted membership claim supplied by your identity provider, not the request body.

Call both a command and a query with a valid tenant ID outside that principal's grants. Expect HTTP 403 and verify neither handler ran. Then call as a member; use the handler's tenant context for storage rather than reading the header again.
