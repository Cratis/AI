---
name: cratis-arc-connect-storage
description: Use when a developer needs to connect an Arc backend to the database that holds its read models. Not for changing an EF table schema (use cratis-arc-migrate-relational-schema).
compatibility: Requires an Arc backend and a reachable database.
---

# Connect Arc to the database it reads

Match the integration to the data the slice reads, not to Chronicle's storage. Use the integration the SDK ships for that database, so naming, value serialization and tenant database selection agree with the writer. Take the typed collection, repository or session as a parameter of [the query](../cratis-arc-expose-query/SKILL.md); don't build database or collection names in the query.

Resolve tenant membership before selecting storage. For changes to an EF table, [prepare a relational migration](../cratis-arc-migrate-relational-schema/SKILL.md) instead.

## Read the reference for the host

The artifact being changed selects the one reference to read: `*.csproj` → [C#](references/csharp.md); a Node server `package.json` → [TypeScript](references/typescript.md); `*.kt` → [Kotlin](references/kotlin.md); `*.java` → [Java](references/java.md); `go.mod` → [Go](references/go.md); `mix.exs` → [Elixir](references/elixir.md). Another language's reference is not a template. [Python](references/python.md) has no released Arc SDK: call the owning service over HTTP.

## Expected outcome

Write one record through its normal path and read it back through the query. Then repeat as a second tenant: each sees only its own record. A host that starts has not proved a connection.

## Stop when

A known record is missing: compare the reader's physical server, database and collection with the writer, then the stored field names, before changing conventions or data.

## Related skills

- [Expose AllAuthors](../cratis-arc-expose-query/SKILL.md)
- [Select the tenant](../cratis-arc-isolate-tenant/SKILL.md)
