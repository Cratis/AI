---
name: cratis-arc-expose-mcp-operation
description: Use when making an application command or query available through MCP. Not for inspecting a Chronicle observer partition (cratis-chronicle-inspect-observer).
---

# Expose one scoped application tool

1. Select the smallest approved operation. Default to a one-shot read; an observable query is not a streaming MCP tool. Name the permitted caller, read scope and additional business permission. **Done:** one operation is approved by name and the neighboring command remains unlisted.
2. Reference `Cratis.Arc.Mcp`, assign and bind a capabilities port and install `WithCapabilities()` plus verified callers. Register `WithMcp`, then `MapArcMcp()` after `UseCratisArc()`. Configure the application name so the server and issuer agree on the read and write scopes; never accept an unsigned identity assertion. Keep exclusive catalog enforcement and explicitly expose the selected query with a stable snake_case tool name and a description. A write requires write scope and separate approval to expose; a command requiring approval cannot be a tool. **Done:** startup accepts the catalog without relaxing scope validation. For `McpToolHasNoScope` or `McpWriteToolLacksWriteScope`, fix the declaration rather than weakening authentication.
3. On a disposable host compare `tools/list` and `tools/call` for an authorized token, insufficient scope and no credentials. Try the name of the unlisted operation directly as well. **Done:** the authorized read returns the expected row, the unlisted name cannot execute, and refusal yields no protected data or write. A filtered listing alone is not execution evidence. For command/query authorization after tool selection use `cratis-arc-authorize-request`.
