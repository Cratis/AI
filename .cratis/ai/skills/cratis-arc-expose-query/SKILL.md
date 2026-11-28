---
name: cratis-arc-expose-query
description: Use when a developer needs to expose an Arc read model to a client as a query, either as a snapshot or as a live result. Not for returning one page (use cratis-arc-page-query).
compatibility: Requires an Arc backend with storage connected for the read model.
---

# Expose a read model as a query

A query serves an existing read model; it does not define how facts build its rows. Start from the [projection](../cratis-chronicle-project-view/SKILL.md) that owns the row shape and [connect its storage](../cratis-arc-connect-storage/SKILL.md) first. Declare the query on the read model, with the storage handle as a dependency Arc supplies, not as a client argument.

Choose a live query when the view must stay current while it is open; choose a snapshot otherwise. A live query returns the SDK's observable type and must not be materialized into a list, or subscribers miss later deliveries. Keep helpers private so they are not exposed as queries.

## Read the reference for the host

The artifact being changed selects the one reference to read: `*.csproj` → [C#](references/csharp.md); a Node server `package.json` → [TypeScript](references/typescript.md); `*.kt` → [Kotlin](references/kotlin.md); `*.java` → [Java](references/java.md); `go.mod` → [Go](references/go.md); `mix.exs` → [Elixir](references/elixir.md). Another language's reference is not a template. [Python](references/python.md) has no released Arc SDK: call the owning service over HTTP.

## Expected outcome

For a snapshot: the query returns the known rows. For a live query: subscribe, check the first result, change the data, then check that the same subscription delivers the change. A first result does not prove a later one.

## Stop when

- **The first result looks empty:** a ready, successful result with an empty list is valid. If none is ready, keep it pending or show the transport failure; do not show an empty list.
- **Initial rows load but changes never arrive:** [diagnose the live query](../cratis-arc-diagnose-live-query/SKILL.md) before changing the projection or adding client polling.

## Related skills

- [Page an author search](../cratis-arc-page-query/SKILL.md) when the server should return one page rather than the whole list.
- [Expose a query as an MCP tool](../cratis-arc-expose-mcp-operation/SKILL.md) when a tool caller needs a snapshot.
- [Generate the frontend contract](../cratis-arc-generate-proxies/SKILL.md)
