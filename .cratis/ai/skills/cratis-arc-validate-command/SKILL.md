---
name: cratis-arc-validate-command
description: Use when a developer needs an Arc command to reject invalid input or refuse a business rule before its handler runs. Not for uniqueness across writers (use cratis-chronicle-constrain-append).
compatibility: Requires an Arc backend with the command already declared.
---

# Validate a command before it runs

Attach each rule to the field it checks, in a validator that belongs to the [command](../cratis-arc-declare-command/SKILL.md). The pipeline runs blocking validation before the handler, so a rejected command changes nothing. A separate validate request gives early feedback; it is not needed to enforce the rule.

Choose by what the rule needs:

- **Only the input:** a field rule. This is the default.
- **Current state, to refuse with a message:** let the validator take the decision model, and check both that it exists and that it relates to the entity being changed.
- **An answer that must still hold when the event is appended:** a [protected model parameter](../cratis-chronicle-protect-decision/SKILL.md), not a database lookup.

## Read the reference for the host

The artifact being changed selects the one reference to read: `*.csproj` → [C#](references/csharp.md); a Node server `package.json` → [TypeScript](references/typescript.md); `*.kt` → [Kotlin](references/kotlin.md); `*.java` → [Java](references/java.md); `go.mod` → [Go](references/go.md); `mix.exs` → [Elixir](references/elixir.md). Another language's reference is not a template. Python has no released Arc SDK: call the owning service over HTTP.

## Expected outcome

Execute the command through the pipeline with an invalid value: the result is invalid, names the offending member, and nothing is recorded. With a valid value it succeeds once. A test that calls the handler directly proves no guard.

## Avoid

- Do not throw from the handler for a missing field; attach the rule to that field.
- Do not add a validator per rule. Add the rule to the command's existing validator.

## Related skills

- [Declare the command](../cratis-arc-declare-command/SKILL.md)
- [Constrain the append](../cratis-chronicle-constrain-append/SKILL.md)
