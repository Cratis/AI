---
name: cratis-arc-authorize-request
description: Use when a developer needs to require sign-in or restrict an Arc command or query by role or policy. Not for selecting a tenant (use cratis-arc-isolate-tenant).
compatibility: Requires an Arc backend whose host already authenticates callers.
---

# Restrict a command or query to permitted callers

Declare the requirement on the command (the `cratis-arc-declare-command` skill, when installed) or query, not in a field validator, so the pipeline refuses the caller before a handler runs. Require sign-in by default. Choose a role when access depends on group membership, and a named policy when the rule needs more than roles.

The host's authentication mechanism establishes the caller; a header, cookie or property the caller can write is not identity. If access depends on ownership, compare the verified principal with the resource's owner, never with a caller-supplied owner ID.

## Read the reference for the host

The artifact being changed selects the one reference to read: `*.csproj` → [C#](references/csharp.md); a Node server `package.json` → [TypeScript](references/typescript.md); `*.kt` → [Kotlin](references/kotlin.md); `*.java` → [Java](references/java.md); `go.mod` → [Go](references/go.md); `mix.exs` → [Elixir](references/elixir.md). Another language's reference is not a template. [Python](references/python.md) has no released Arc SDK: call the owning service over HTTP.

## Expected outcome

Execute through the pipeline as an anonymous caller, a signed-in caller without the requirement and one with it. The first two are refused and write nothing; the third succeeds. Check the server verdict rather than whether the UI shows a control.

Invocation authorization does not continually recheck a live subscription. The reference says whether the SDK can recheck each emission; otherwise reopen the subscription after access changes.

## Stop when

No authentication mechanism is configured: configure one first, because a requirement then refuses everyone or protects nothing.

## Avoid

- Do not authorize only in React; protect the server operation.
- Do not test access by invoking the handler directly; this bypasses the pipeline.

## Related skills

- [Check tenant membership](../cratis-arc-isolate-tenant/SKILL.md)
- Exercise the backend (the `cratis-specifications-exercise-backend` skill, when installed)
