# Resolve and verify tenant scope in Kotlin

On a tenant-only Spring host set `cratis.arc.tenancy.resolvers=header` and `cratis.arc.tenancy.required=true`. Missing selection otherwise bypasses the evaluator. The default evaluator permits anonymous callers and empty membership sets. Replace it with an `io.cratis.arc.springboot.TenantAccessEvaluator` bean in a Spring configuration class. Here the identity provider issues one `tenant_id` claim per granted tenant; the header only selects one.

```kotlin
@Bean
fun tenantAccess() = TenantAccessEvaluator { tenant, context ->
    val caller = context.principal
    !tenant.isDefault && caller != null && caller.isAuthenticated &&
        caller.claims.any { it.type == "tenant_id" && it.value == tenant.value() }
}
```

Through both command and query routes, omit the header as a member (400). With a named tenant selected, try an anonymous caller, an authenticated caller without grants and one granted only a different tenant. Each must be denied before any handler or storage access; a matching grant must reach only its namespace.

For authorized background work use `withTenant(TenantId("acme")) { /* tenant-bound work */ }` inside the coroutine, substituting the checked ID. `currentTenant()` follows the coroutine into child work and the surrounding context is restored when the block exits. This scope carries an ID, not a grant. Test denial before opening storage separately from successful reads in two distinct namespaces.
