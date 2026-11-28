---
name: cratis-arc-invoke-command
description: Use when a developer needs to execute an existing Arc command from backend code, such as a service, job or import. Not for declaring the command (use cratis-arc-declare-command) or calling it from React (use cratis-arc-react-submit-command).
compatibility: Requires an Arc backend with the command already declared.
---

# Dispatch a command from backend code

Execute the [declared command](../cratis-arc-declare-command/SKILL.md) through the command pipeline, never by calling its handler: the pipeline runs authorization, validation and the append. Let the pipeline own its scope unless the caller must share dependencies it already holds. Wait for the result before recording the work as done.

A result is not an exception. Inspect it and tell apart a refused caller, invalid input, a temporary refusal and a fault before reading the response. Validation alone is early feedback, not a dry run: it runs no handler and does not replace checking the final result.

## Read the reference for the host

The artifact being changed selects the one reference to read: `*.csproj` → [C#](references/csharp.md); a Node server `package.json` → [TypeScript](references/typescript.md); `*.kt` → [Kotlin](references/kotlin.md); `*.java` → [Java](references/java.md); `go.mod` → [Go](references/go.md); `mix.exs` → [Elixir](references/elixir.md). Another language's reference is not a template. [Python](references/python.md) has no released Arc SDK: call the owning service over HTTP.

## Expected outcome

A valid command succeeds and its effect is visible once. An invalid or unauthorized one returns a failed result, changes nothing, and the calling code reports it rather than continuing.

## Stop when

Several commands form one job: decide first whether a failed item stops the job, is retried or is recorded while the rest continue. One successful execution does not mean the batch committed.

## Related skills

- [Declare a command](../cratis-arc-declare-command/SKILL.md)
- [Validate its inputs](../cratis-arc-validate-command/SKILL.md)
