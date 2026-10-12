<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Chronicle MCP deployment and denials

Verified at **Cratis/Chronicle.Mcp v2.0.0**:
[configuration](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Documentation/configuration.md),
[deployment profiles](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Documentation/deployment-profiles.md),
[ToolCatalog.cs](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Authorization/ToolCatalog.cs#L23-L43)
and [Program.cs](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Program.cs).

## Registration and target

The product documents Docker/stdio launch using `docker run -i --rm`, passing
`Cratis__Chronicle__Mcp__ConnectionString` into the container. Use a verified
image/version and your harness's stdio registration shape, only when setup is
requested. The registry identity is `io.github.Cratis/chronicle-mcp`, but
`server.json` at this tag still names version/image **1.4.0**; do not treat that
manifest as a v2.0.0 image pin. The [tagged README](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/README.md)
documents transport setup.

`cratis ai` v3.53.1 only writes the Screenplay descriptor, not Chronicle or
Studio ([AiMcpHarnesses.cs](https://github.com/Cratis/cli/blob/v3.53.1/Source/Cli/Commands/Ai/AiMcpHarnesses.cs)).
Do not add an unsupported descriptor to the corpus catalog.

For unset connection values: explicit options → `CHRONICLE_CONNECTION_STRING`
→ active CLI context (`~/.cratis/config.json`) → development defaults
(`chronicle://localhost:35000`, store `default`, namespace `Default`).
`UseCliConfiguration=false` disables CLI inheritance. A Docker container sees
only its own configuration unless host paths are mounted. Keep credentials in
a secret store or environment, never committed configuration. Profile/policy
settings do not fall back to CLI contexts or development credentials.

## Mutation policy

All settings are under `Cratis:Chronicle:Mcp` (environment prefix
`Cratis__Chronicle__Mcp__`). `Profile=ReadOnly` is the default. `Profile=Mutation`
requires `Authorization.Principal`, a future `Authorization.ExpiresAt` and
`Authorization.Grants` with a matching principal. Each grant names `Principal`,
`EventStore`, `Namespace`, `Operations` and `Targets` (job-id strings).
Unknown profiles, invalid grants and operation wildcards prevent startup.

Matching is ordinal, case-sensitive and exact; all dimensions must match the
same grant. `*` is allowed for store, namespace and target only, never principal
or operation. Prefer narrow grants. Omitted scope uses the same configured
defaults as the tool. Chronicle credentials do not grant MCP mutation rights.

Every mutation rechecks policy, expiry and `RevokedPrincipals`. Reloadable JSON
changes take effect on the next call; environment changes require restart.
Changing the registered tool set requires restart. .NET merges arrays across
configuration sources; an environment override does not remove existing JSON
grants. Use one unambiguous source for authorization lists.

## Denials

A denial returns `isError: true` and identical JSON in structured content and a
text block, for example:

```json
{"error":{"code":"not_authorized","operation":"stop_job"}}
```

| Code | Meaning |
| --- | --- |
| `bad_request` | missing or invalid target (`jobId` must parse as Guid) |
| `not_authenticated` | missing deployment principal |
| `policy_invalid` | malformed/unbindable policy or current profile no longer permits mutations |
| `policy_expired` | missing or reached expiry |
| `principal_revoked` | deployment principal revoked |
| `not_authorized` | no matching grant |
| `chronicle_denied` | Chronicle gRPC PermissionDenied/Unauthenticated, including on reads |

Mutation checks run in table order through `not_authorized`, first failure wins;
`chronicle_denied` occurs only after reaching Chronicle. The envelope/log omits
scope, target, principal, credentials and exception text. These codes are
verified in [DenialCodes.cs](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Authorization/DenialCodes.cs).
Never turn a denial into success or widen policy automatically.
