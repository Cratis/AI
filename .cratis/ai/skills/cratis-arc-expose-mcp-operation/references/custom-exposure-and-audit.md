# C#: Customize MCP exposure and diagnose calls

## Keep tools inside Arc's catalog

Prefer the attribute. When an Arc command or finite query cannot be annotated, use the existing `WithMcp` builder: `mcp.Expose<RegisterAuthor>("register_author", "Registers an author.")` for the command, or `mcp.ExposeQuery<Author>(nameof(Author.ListAuthors), "list_authors", "Lists authors.")` for the query. Don't register the same operation both ways.

For a tool that is not one command or query, implement `IMcpToolSource` and register it with `mcp.AddToolSource<TSource>()`. Return its descriptors from `Describe()` using `McpToolDescriptor.Custom`, with explicit scopes and `McpToolAccess.Read` or `McpToolAccess.Write`. Handle the tool in `Invoke(McpToolInvocation invocation)`, using `invocation.Caller` for verified identity and tenant and `invocation.Services` for request services. Arguments are not an identity source. Keep `ExclusiveTools` enabled (the default); directly registered server tools outside the catalog do not get its scope protection when exclusivity is off.

A caller must hold every scope in the tool's required set or every scope in one declared `AlternativeScopes` set. Each scope set on a write tool must include `WriteScope` or a value from `WriteScopes`. For PAT-enabled hosts, keep those scopes in `PatOptions.AllowedScopes`. With the intended credential, check that listing hides out-of-scope tools and that a call by name cannot bypass that restriction. Scope checks do not replace operation authorization.

## Find where a refusal occurred

- **Listener:** Assigning the capabilities port does not bind it. Confirm the host binds that port and accepts the MCP POST there. By default the capability gate also protects health and readiness routes on that port; a rejected anonymous probe is not proof MCP is down. Move anonymous probes off the capabilities port, then retest `/mcp` separately with the intended credential.
- **HTTP admission:** A `401` and `WWW-Authenticate` point to credential admission; check the client profile, credential kind, validity and binding. For `403`, distinguish `origin_not_allowed` (compare the exact browser origin with `PublicOrigin` and `AllowedOrigins`) from `insufficient_scope` (compare the advertised required set with the caller's scopes) and `forbidden` (check the tool authorizers). Don't loosen either check to make a probe pass.
- **Tool refusal:** An MCP result with `isError: true` is a tool-level error even if HTTP succeeded. Inspect the result content for scope or operation-policy refusal, bad input or execution failure. Do not treat HTTP success alone as proof the tool ran successfully.

## Use the audit without disclosing personal data

Filter the `Cratis.Arc.Mcp.McpCallAudit` information logs for event `5102`. It records the tool name and kind, person and tenant identifiers when present, credential ID and kind, outcome and correlation ID. It does not log the credential value, arguments or results. Restrict access and apply a retention limit: the identifiers can still be personal data. Share redacted findings, not the raw identifiers. A credential rejected before a verified caller is admitted produces no tool-call audit record; use the HTTP admission response and safe authentication diagnostics instead.
