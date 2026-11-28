---
name: cratis-arc-diagnose-live-query
description: Use when a live Arc query shows its first result but a later change never reaches the client. Not for declaring the query (use cratis-arc-expose-query).
compatibility: Requires a running Arc backend, its database and credentials for the affected caller.
---

# Find the missing live update

Trace one write on one open subscription to [the query](../cratis-arc-expose-query/SKILL.md), as the same authenticated caller, tenant and database throughout. Work from storage outward and stop at the first stage that fails:

1. **The write succeeded.** Require a successful [command](../cratis-arc-declare-command/SKILL.md) result before looking for an update.
2. **The row is stored** where the reader looks. If not, check the [projection](../cratis-chronicle-project-view/SKILL.md) and the [storage connection](../cratis-arc-connect-storage/SKILL.md), not delivery.
3. **The server source emits.** The query returns the provider's observable, not a materialized list, and the store can notify changes.
4. **The transport delivers.** A direct stream carries the changed row.
5. **The client receives it.** Only then inspect the frontend.

Three states look alike and are not: an empty first result, a first result that is not ready yet, and a subscription that was never opened. A one-shot request that succeeds does not prove that a sustained subscription delivers later writes, and repeating snapshots is not a subscription. Transports, routes and statuses differ between hosts; take them from the reference.

## Read the reference for the host

The artifact being changed selects the one reference to read: `*.csproj` → [C#](references/csharp.md); a Node server `package.json` → [TypeScript](references/typescript.md); `*.kt` → [Kotlin](references/kotlin.md); `*.java` → [Java](references/java.md); `go.mod` → [Go](references/go.md); `mix.exs` → [Elixir](references/elixir.md). Another language's reference is not a template. Python has no released Arc SDK: call the owning service over HTTP.

## Expected outcome

The stage that drops the change is identified by a write whose known ID appears in the store and then does or does not appear in a later result on the same subscription. `node scripts/check-frames.mjs < capture.sse`, run from the skill directory, counts ready results in a saved event stream; two results alone do not prove delivery of that ID.

## Stop when

Updates stop after an identity change: reconnect through the [account-switch reconnection](../cratis-arc-react-bind-slice/SKILL.md), then check whether the [emission guard](../cratis-arc-authorize-request/SKILL.md) denies the new caller.

## Avoid

- Do not reconnect between the write and the inspection; a new subscription starts with a fresh snapshot.
- Do not require a delta on the first result. It is a snapshot; later changes need a stable item identity, or only additions and removals are reported.
- Do not use a health endpoint to check that a row exists; it describes connections.

## Related skills

- [Connect the Mongo reader](../cratis-arc-connect-storage/SKILL.md)
- [Generate proxies](../cratis-arc-generate-proxies/SKILL.md)
