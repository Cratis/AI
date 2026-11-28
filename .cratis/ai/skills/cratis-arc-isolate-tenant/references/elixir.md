# Resolve and verify tenant scope in Elixir

Configure one resolver, not a chain. For example, `tenancy: [resolver: :claim, claim_type: "tenant_id"]` selects from the authenticated principal. `Cratis.Arc.Tenancy` provides selection, not admission. A `:subdomain` resolver falls back to a caller-controlled header when the host doesn't match; strip it at ingress. Leave `trust_forwarded_identity_headers` disabled unless authenticated ingress replaces the headers and the backend is inaccessible directly.

Enforce membership in a `Cratis.Arc.Filter` before command or query execution; enriching a result is too late. Check `ctx.tenant` against trusted grants. Reject a default tenant where selection is mandatory: `nil` is not an automatic denial. Verify writes land in distinct tenant databases or Chronicle namespaces; a fixed explicit namespace overrides automatic tenant mapping.
