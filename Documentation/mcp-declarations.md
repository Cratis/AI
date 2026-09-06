# MCP declarations in profiles

A profile can say which MCP servers it needs. It says so by naming a
**declaration** under [`mcp/`](../mcp/README.md), and by nothing else.

**Studio MCP is an extension point only. It is not published and it is not
shipped.** It is modeled here so a future server has a defined shape to fill in,
and the resolver refuses to place it in any manifest. See
[Studio MCP](#studio-mcp-is-an-extension-point-only) below.

## What a declaration is

A declaration is **authored** metadata. In the evidence vocabulary of
[capability catalog v2](./capability-catalog-v2.md#normalized-evidence), a
declaration is authored source, not generated output, not evaluated behavior,
and not a support claim. No declaration in this repository has reached
`install-tested` or any higher technical tier, and none is `supported`.

Each declaration records:

| Field | What it answers |
| --- | --- |
| `id`, `displayName`, `product` | Stable identity, and which product owns the implementation |
| `status`, `resolvable` | Whether the resolver may ever include it |
| `owner` | Owning repository and component, and that Cratis AI does not distribute it |
| `reference` | Package or endpoint reference, and the authority that resolves it |
| `transport` | Declared transport, alternatives, and the state of the evidence for it |
| `authentication` | Authentication type and the explicit statement that credentials are delegated |
| `requires` | Profiles that require the server, capabilities it needs, and the passive guidance skills that classify its use |
| `hostConfigurationMapping` | Where each host would read the server, and whether emission is allowed |
| `classification` | Passive configuration versus executable code, plus the assurance lane and emission flags |
| `distributionBoundary` | How a generated package must treat the declaration |

## Passive configuration versus executable code

The two halves are classified separately and deliberately:

- `classification.declarationContentClass` is `passive-configuration`. The
  declaration file is metadata. It carries no server bytes, no argument vector,
  and no start command.
- `classification.serverImplementationClass` is `executable-code`. The server it
  names is executable and is owned and distributed by its product repository.

`classification.assuranceLane` is `governed-support`, which matches
[`distribution/assurance-lanes.json`](../distribution/assurance-lanes.json):
`mcp-operation` already requires the governed S9/S10 lane, so no declaration can
reach a supported claim through the basic passive lane.

`classification.emission` keeps `executableAllowed`, `installationAllowed`,
`invocationAllowed`, `promptInvocationAllowed`, `runtimeConfigurationAllowed`,
and `serverBytesAllowed` all `false`, matching the emission block the Chronicle
and Studio classification catalogs already use.

Whether a declaration may travel inside a passive package is a release-process
decision. `forbiddenRepositoryContent` in
[`distribution/generated-repository-contract.json`](../distribution/generated-repository-contract.json)
does not name MCP content today, and changing it belongs to Phase 2 of
[Cratis/AI#264](https://github.com/Cratis/AI/issues/264). The classification
above is what such a decision has to honor; `distributionBoundary` records that
the decision has not been made.

## Credentials are never declared

No declaration contains a credential, a token, a password, or a
credential-shaped placeholder. `authentication.credentialHandling` is always
`delegated-to-host-and-server` and `credentialsEmittedByCratisAi` is always
`false` — the same delegation the passive guidance skills already state.

`tooling/mcp-declaration-validation.mjs` enforces this by rejecting any
credential-bearing field name and any `${...}`, `<...>`, `Bearer …`, or
token-prefixed value.

## How a profile requires a server

```json
{
  "id": "cratis/chronicle",
  "mcpServers": ["cratis-chronicle-mcp"]
}
```

`tooling/resolve-profiles.mjs` then includes the server in the resolved manifest
with the same explainability skills get — annotated with every profile that
pulled it in:

```json
{
  "id": "cratis-chronicle-mcp",
  "status": "declared-not-published",
  "transport": "stdio",
  "authenticationType": "delegated",
  "declarationContentClass": "passive-configuration",
  "serverImplementationClass": "executable-code",
  "declarationPath": "mcp/cratis-chronicle-mcp.json",
  "includedBy": ["cratis/chronicle"]
}
```

The validator requires the relationship to be recorded on both sides: a profile
may only require a server that lists it in `requires.profileIds`.

## Chronicle MCP

`mcp/cratis-chronicle-mcp.json` is the one real declaration. It is
`declared-not-published`: the identity, transport, authentication type, and host
mapping are declared, and the server itself stays owned and distributed by
`Cratis/Chronicle`.

It does not change the existing passive boundary. `skills/cratis-chronicle-mcp-inspection`,
[`catalog/chronicle-mcp-tool-classifications.json`](../catalog/chronicle-mcp-tool-classifications.json),
[`catalog/mcp-guidance-products.json`](../catalog/mcp-guidance-products.json),
and [Chronicle MCP passive guidance](./chronicle-mcp-guidance.md) stay exactly as
they are: no tool or prompt is admitted, and `authorityState` remains
`NO_ADMITTED_TOOL_EFFECT_EVIDENCE`. The declaration says what the server *is*;
the classification catalog still says nothing may be invoked.

`public-chronicle-mcp` and `cratis/chronicle` are the profiles that require it.
Arc profiles deliberately do not: Chronicle MCP inspects a running Chronicle
store, and requiring it from an Arc profile would reintroduce exactly the
Arc-implies-Chronicle coupling the meta-profiles exist to avoid.

## Studio MCP is an extension point only

`mcp/cratis-studio-mcp.json` carries `status: "extension-point-not-published"`
and `resolvable: false`. That combination is enforced, not conventional:

- `tooling/resolve-profiles.mjs` never places a declaration with
  `resolvable: false` into `mcpServers`. It lands in `rejected` with the reason
  naming its status, whatever profile asked for it.
- `tooling/mcp-declaration-validation.mjs` rejects any profile that requires it,
  and rejects any declaration whose `resolvable` flag disagrees with its status.
- `tooling/specs/mcp-declarations.spec.mjs` asserts both: that Studio MCP is
  absent from every profile's resolved manifest in the real catalog, and that a
  profile deliberately constructed to demand it still does not get it.

Nothing about a Studio MCP implementation is admitted — no source, operation,
prompt, resource, schema, or revision. `skills/cratis-studio-mcp-safety-guidance`
and [`catalog/studio-mcp-tool-classifications.json`](../catalog/studio-mcp-tool-classifications.json)
remain the only Studio MCP surface, and
[Studio MCP passive guidance](./studio-mcp-guidance.md) remains the only
description of it.

## Host projection

`hostConfigurationMapping` records where each host would read the server, using
[`tooling/specifications/agent-plugins/1.0.0/mcp.schema.json`](../tooling/specifications/agent-plugins/1.0.0/mcp.schema.json)
as the canonical projection shape for the Agent Plugins package.

Every mapping sets `emissionAllowed: false`. Nothing is projected into a host
configuration today, and turning that on is governed-lane work, not an authoring
change.
