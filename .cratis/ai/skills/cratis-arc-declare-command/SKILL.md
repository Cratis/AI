---
name: cratis-arc-declare-command
description: Use when a developer needs to add or change an Arc command that changes state or records an event. Not for calling an existing command (use cratis-arc-invoke-command).
compatibility: Requires an Arc backend; recording an event also requires its Chronicle integration.
---

# Declare a command

A command is one named state change: its input, and a handler that decides what happened. Declare it in the slice that owns the change, next to the events (`cratis-chronicle-record-event` skill) it records, with named values (`cratis-fundamentals-name-value` skill) for its identities.

Decide two things first:

- **Who owns the ID.** Keep it in the request when the caller already owns it; that is the default. Let the server allocate it only when the application, not the caller, creates the identity. Never replace a caller-owned ID with a fresh one.
- **What the handler returns.** A persisted fact (an event) and a response for the caller are different things. Return the fact and let the pipeline record it once; do not also append it in the handler. A command that records no event does not have to return one.

When two identities could own the history, name the owner explicitly instead of relying on property order.

## Read the reference for the host

The artifact being changed selects the one reference to read: `*.csproj` → [C#](references/csharp.md); a Node server `package.json` → [TypeScript](references/typescript.md); `*.kt` → [Kotlin](references/kotlin.md); `*.java` → [Java](references/java.md); `go.mod` → [Go](references/go.md); `mix.exs` → [Elixir](references/elixir.md). Another language's reference is not a template. [Python](references/python.md) has no released Arc SDK: call the owning service over HTTP.

## Expected outcome

Execute the command through its pipeline in a backend scenario (`cratis-specifications-exercise-backend` skill): a valid request succeeds and records the fact once, against the intended identity; an invalid one is refused and records nothing. With two candidate identities, use different values for each and assert which one received the event.

## Stop when

The handler has to read state to decide: protect the decision (`cratis-chronicle-protect-decision` skill) rather than reading the database directly in the handler.

## Related skills

- Deliver a lending slice (`cratis-platform-deliver-slice` skill): validate input, protect availability if lending depends on it, project `BookLent` unless already mapped, expose the live query, generate both proxies, then bind the page.
- [Invoke the command](../cratis-arc-invoke-command/SKILL.md)
- [Validate the command](../cratis-arc-validate-command/SKILL.md) to reject an empty name before the handler runs.
