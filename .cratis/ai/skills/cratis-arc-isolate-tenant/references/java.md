# Resolve and verify tenant scope in Java

In a Java Spring host choose a `TenantResolverStrategy` appropriate to the identity source. `CLAIM` selects a principal claim; `HEADER` selects the caller's requested tenant. Neither proves membership. Deny unauthorized selections before the Java route touches a store.

For Chronicle resolve the event store with the captured tenant namespace; do not silently substitute a shared store when that namespace is missing. For synchronous work already authorized for a tenant, `TenantContextBridge.withTenant(tenantId, runnable)` bounds ambient scope to the callback. It does not authenticate the caller. Exercise Java command and query routes with two tenants and confirm the scope does not leak into the next call.
