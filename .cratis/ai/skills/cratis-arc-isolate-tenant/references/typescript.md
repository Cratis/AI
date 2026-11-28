# Resolve and verify tenant scope in Node

When callers switch between tenants, configure the server with `tenancy: { sources: [TenantResolverType.Header], required: true, membershipClaim: 'memberships' }`. The `x-cratis-tenant-id` request header selects the tenant. Supply the authenticated principal through the host, with the trusted membership claim supplied by your identity provider, not the request body.

On this tenant-only host, call both a command and a query as an authenticated caller. Omit the header (400), then select a valid tenant outside the caller's grants (403). Assert zero handler calls and zero storage accesses for each refusal. Membership is not checked for an absent selection: on a mixed host, explicitly refuse absence before a tenant-only operation. Then call as a member; use the handler's tenant context for storage rather than reading the header again.
