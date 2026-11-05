---
name: cratis-arc-tenancy-typescript
description: Use when an Arc Node.js server must pick the tenant for each request, prove the caller belongs to it or send data to per-tenant storage. Not for caller authentication, Chronicle namespaces alone or the C# Arc resolver.
license: MIT
---

# Tenancy in an Arc Node.js server

Arc for TypeScript resolves one tenant per execution, after authentication and
before your code runs, and carries it as `context.tenantId` through commands,
queries, services and storage integrations. Three decisions stay separate:

| Decision | Made by |
| --- | --- |
| Selection: which tenant does the request name? | Arc, from a header, claim, query string, subdomain, fixed value or your resolver |
| Membership: may this caller use it? | `tenancy.membershipClaim`, your `tenancy.resolve`, or authorization rules |
| Storage isolation: where do reads and writes go? | The storage integration (MongoDB, Drizzle, Chronicle) |

None replaces another. A database per tenant does not stop a caller from naming
someone else's tenant in a header. The package is `@cratis/arc.core`
(`ArcApplication`, `TenantResolverType`).

## Choose how the tenant is selected

| Configure | Behavior |
| --- | --- |
| nothing | Reads the `x-cratis-tenant-id` header unchanged; missing means `tenantId` is `undefined` |
| `tenancy: { resolve(request, principal) }` | Your resolver alone decides (may be `async`); `undefined` means no tenant; no fallback; Arc does not apply `sources`, `required`, `membershipClaim` or lowercasing to it |
| `tenancy: { sources: [...] }` | Ordered built-in sources, first nonempty answer wins |
| `tenancy: { resolverType }` | One .NET-compatible source (defaults to `header` once `tenancy` is present); never combine with `sources` |

Built-in sources (`TenantResolverType`):

| Source | Option (default) | Reads |
| --- | --- | --- |
| `header` | `httpHeader` (`x-cratis-tenant-id`) | request header |
| `query` | `queryParameter` (`tenantId`) | query string |
| `claim` | `claimType` (`tenant_id`) | own string claim of an authenticated principal |
| `fixed` | `fixedTenantId` (`development`) | configured deployment value |
| `development` | `fixedTenantId` (`development`) | same fixed source; does **not** check the environment |
| `subdomain` | `baseDomain` (required) | the adapter's verified `native.authority`, never raw `Host`/`X-Forwarded-Host` |

Shared options: `required` (unresolved tenant answers 400) and
`membershipClaim` (a comma-separated own claim of an authenticated principal
must include the selected tenant, else 403). Tenant IDs are lowercased and must
be DNS labels (letters, digits, hyphens, at most 63 characters); an invalid
selected ID answers 400. A single-tenant app uses
`{ resolverType: TenantResolverType.Fixed, fixedTenantId: 'default' }`.

```typescript
const builder = ArcApplication.createBuilder({
    authentication: [/* verified handlers */],
    tenancy: {
        sources: [TenantResolverType.Claim, TenantResolverType.Header],
        claimType: 'tenant', membershipClaim: 'tenants', required: true
    }
});
```

This tries an own `tenant` claim first, then the header; a missing tenant is
400 and a tenant absent from the `tenants` claim is 403. `resolverType`,
`httpHeader`, `baseDomain`, `queryParameter`, `claimType`, `fixedTenantId`,
`required` and `membershipClaim` also bind from `Cratis:Arc:Tenancy` in
`appsettings.json`; `sources` and `resolve` are code-only.

## Prove membership

- A header, query string or subdomain value is a request, not proof. When
  tenants separate customers, use the `claim` source with `membershipClaim`, or
  derive the tenant from the principal in `tenancy.resolve` and check
  membership there; return lowercase IDs.
- Enforce membership in tenancy options or authorization, never in validators:
  a trusted direct caller can lower the blocking severity.
- Never use `development` or `fixed` to accept a browser-supplied tenant.
- Treat tenant IDs as internal metadata; keep them out of public URLs and
  error text when a customer name would reveal who else uses the system.

## Storage follows the tenant

| Integration | Tenant `acme` | Tenant `default` | No tenant |
| --- | --- | --- | --- |
| MongoDB, `database: 'tasks'` | database `tasks+acme` (or `databaseNameResolver`) | `tasks` | request fails |
| Drizzle | the connection `databaseFactory('acme', context)` returns | `databaseFactory('default', context)` or the `database` option | request fails |
| Chronicle | namespace `acme` | namespace `default` | namespace `Default` |

MongoDB and Drizzle lowercase the tenant; Chronicle passes it unchanged, so
return lowercase IDs from a custom resolver to keep all three aligned. A command
returned by a Chronicle reactor runs in the namespace of the triggering event.
None of these checks membership.

## Read the tenant, and keep it per request

Callbacks receive the execution context (`tenantId`, `principal`,
`correlationId`, `signal`, `allowedSeverity`); deep code can call
`currentContext()?.tenantId` (`undefined` outside an Arc execution).

| Execution | Tenant resolved | Holds |
| --- | --- | --- |
| HTTP command or query | once per request, after authentication | request scope |
| Observable query over SSE | once for the request | whole subscription |
| WebSocket or multiplexed hub | once when the connection opens | every subscription on it |
| Reactor-returned command | namespace of the triggering event | that command |
| Direct call (job) | `tenantId` in the context you pass | that call |

Keep tenant-scoped handles (collections, connections, caches) in scoped
services: a singleton keeps the first tenant that created it. Background work
that calls the server directly must pass a tenant on purpose. Put the tenant in
cache keys and logs.

## Specify and verify

`CommandScenario.for(...).withContext({ tenantId: 'acme', principal })` proves
your code uses the tenant it is given; it does not prove the resolver or storage
configuration. Cover four tenant states (none, `default`, two named tenants),
a denied selection (403, nothing read or written), concurrent requests for two
tenants, long-lived work (observable queries, reactors) and direct calls.
`cratis-arc-testing-typescript` has the scenario setup; use `ArcScenario` with
HTTP requests to test the resolver itself.

## Route near misses

- Authenticating callers, JWT/EasyAuth, identity details: `cratis-arc-command-typescript`
  (`identity-and-introspection.md`).
- Chronicle namespaces in a .NET or standalone setting: `cratis-chronicle-multi-tenancy`.
- C# Arc tenant resolution: the C# Arc skills.
