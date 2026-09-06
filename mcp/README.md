# MCP server declarations

This directory holds **authored** MCP server declarations. A declaration records
what a server *is* — stable identity, product owner, package or endpoint
reference, transport, authentication type, the profiles that require it, and
where each host would read it. It is passive configuration metadata.

A declaration is not a server, not an installer, and not permission to run
anything:

- it never contains server bytes, an argument vector, or a start command;
- it never contains a credential, a token, or a credential-shaped placeholder —
  authentication is delegated to the host and the server;
- `classification.emission` keeps executable, installation, invocation, prompt
  invocation, runtime configuration, and server bytes all `false`;
- `distribution/assurance-lanes.json` already requires the governed S9/S10 lane
  for MCP operation, so no declaration can reach a supported claim through the
  basic passive lane.

| File | Server | Status | Resolvable |
| --- | --- | --- | --- |
| `cratis-chronicle-mcp.json` | Chronicle MCP | `declared-not-published` | yes |
| `cratis-studio-mcp.json` | Studio MCP | `extension-point-not-published` | **no** |

**Studio MCP is an extension point only. It is not published and not shipped.**
`tooling/resolve-profiles.mjs` refuses to place a declaration with
`resolvable: false` into a resolved manifest, whatever a profile asks for, and
`tooling/mcp-declaration-validation.mjs` refuses to let a profile require one.
`skills/cratis-studio-mcp-safety-guidance` and
`catalog/studio-mcp-tool-classifications.json` remain the only Studio MCP
surface.

`mcp-server-declaration.schema.json` is the contract. Validate with:

```bash
node tooling/mcp-declaration-validation.mjs
```

Read [MCP declarations in profiles](../Documentation/mcp-declarations.md) for
the model, and [the profile reference](../Documentation/profile-reference.md)
for how a profile requires a server.
