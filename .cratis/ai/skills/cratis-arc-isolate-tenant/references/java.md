# Resolve and verify tenant scope in Java

On a tenant-only Spring host set `cratis.arc.tenancy.resolvers=header` and `cratis.arc.tenancy.required=true`. Missing selection otherwise bypasses the evaluator. The default evaluator permits anonymous callers and empty membership sets. Replace it with an `io.cratis.arc.springboot.TenantAccessEvaluator` bean in a Spring configuration class. Here the identity provider issues one `tenant_id` claim per granted tenant; the header only selects one.

```java
@Bean
TenantAccessEvaluator tenantAccess() {
    return (tenant, context) -> {
        var caller = context.getPrincipal();
        return !tenant.isDefault() && caller != null && caller.isAuthenticated()
            && caller.getClaims().stream().anyMatch(c ->
                "tenant_id".equals(c.getType()) && tenant.value().equals(c.getValue()));
    };
}
```

Through both command and query routes, omit the header as a member (400). With a named tenant selected, try an anonymous caller, an authenticated caller without grants and one granted only a different tenant. Each must be denied before any handler or storage access; a matching grant must reach only its namespace.

For Chronicle resolve the event store with the captured tenant namespace; do not silently substitute a shared store when that namespace is missing. For synchronous work already authorized for a tenant, `TenantContextBridge.withTenant(tenantId, runnable)` bounds ambient scope to the callback. It does not authenticate the caller. Exercise Java command and query routes with two tenants and confirm the scope does not leak into the next call.
