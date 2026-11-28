# Resolve and verify tenant scope in Go

Pass a `tenancy.Resolver` to the request host to select an ID. For a service deployed for one tenant, build it with `tenancy.NewResolver(tenancy.Options{Strategy: tenancy.Fixed, FixedID: tenant})` and handle the construction error at startup. A fixed selection still needs a membership policy.

Supply a `tenancy.MembershipFunc` that compares the authenticated `identity.Principal` and selected `tenancy.ID` against trusted grants. Apply it to both command and query pipelines. Accept forwarded caller headers only if ingress strips caller-supplied values, authenticates the caller and sets replacements; prevent clients from reaching the backend directly. Resolve the Mongo collection for the checked tenant on each operation rather than sharing one tenant's collection across requests.
