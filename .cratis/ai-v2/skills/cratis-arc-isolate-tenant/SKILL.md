---
name: cratis-arc-isolate-tenant
description: Use when two tenants must not share query results, observations or writes. Not for event store connection setup (cratis-chronicle-connect-application).
---

# Bind the operation to one authorized partition

1. Resolve tenant membership from an authenticated principal at entry. For claim resolution set `Cratis:Arc:Tenancy:ResolverType` to `Claim` and `ClaimType` under that section to the issuer's tenant claim; an absent claim can resolve to an empty string, so reject missing or unmapped tenants before touching storage. **Done:** changing a client parameter cannot select another tenant. Use `cratis-arc-authorize-request` for establishing the principal.
2. Bind scoped storage and the Chronicle namespace (if used) to that resolved tenant. Keep an author ID distinct from its namespace. Capture scope for live delivery; do not reuse a mutable global current tenant or key a cache by author ID alone. **Done:** two tenants can store different names under the same author ID and a write from A cannot change B's value.
3. As each tenant fetch the same ID, subscribe, then write under A while B stays subscribed. Include a permitted update under B as a positive delivery control. **Done:** B receives its own update and never A's row; switching tenant closes the old subscription and clears previously displayed data. If a one-shot read passes but a later update leaks, inspect the observer's captured partition rather than adding a browser filter.
