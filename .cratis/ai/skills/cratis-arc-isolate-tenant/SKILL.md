---
name: cratis-arc-isolate-tenant
description: Use when resolving a request tenant, checking membership or isolating a background job's storage scope. Not for choosing a database server (use cratis-arc-connect-storage).
---

# Resolve and verify tenant scope

Select the tenant, check the authenticated caller's membership, then open storage for that tenant. A request header, host or query parameter expresses a choice, not a grant. Reject missing selections when the operation requires a named tenant.

Read the recipe for the **server** handling the operation:

- For ASP.NET Core, read [C#](references/csharp.md).
- For a Node server, read [TypeScript](references/typescript.md).
- For a Kotlin Spring host, read [Kotlin](references/kotlin.md).
- For a Java Spring host, read [Java](references/java.md).
- For a Go service, read [Go](references/go.md).
- For an OTP application, read [Elixir](references/elixir.md).

For a Python caller, read [Python](references/python.md): no Arc application tenancy recipe is verified, so call a supported service that owns membership checks and storage selection.

Prove both boundaries: a nonmember cannot run the operation, and authorized writes of the same ID with different values in two tenants return only the local value on each read. Stop before enabling the route if either check fails.
