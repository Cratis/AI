# Resolve and verify tenant scope in Kotlin

Select the Spring host resolver to match the verified principal claim or caller-selected header. Compare the selection to trusted membership before entering tenant-bound code. Select the Chronicle event store by the captured namespace; fail closed rather than opening the default namespace when a tenant is required.

For authorized background work use `withTenant(TenantId("acme")) { /* tenant-bound work */ }` inside the coroutine, substituting the checked ID. `currentTenant()` follows the coroutine into child work and the surrounding context is restored when the block exits. This scope carries an ID, not a grant. Test denial before opening storage separately from successful reads in two distinct namespaces.
