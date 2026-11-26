---
name: cratis-arc-validate-command
description: Use when adding command validation, a FluentValidation rule or a member-specific field rejection to an Arc command. Not for enforcing uniqueness across writers (cratis-chronicle-constrain-append).
---

# Reject invalid command input before writing

1. Specify the rejected member, value and valid control. Keep a registration-specific rule on `RegisterAuthor`; only move an invariant to a concept validator when it must apply at every use of that scalar. **Done:** blank input is rejected regardless of whether the caller used the form.
2. Derive a discoverable validator from `CommandValidator<TCommand>`. With `RegisterAuthor` in scope and FluentValidation imported:

```csharp
public sealed class RegisterAuthorValidator : CommandValidator<RegisterAuthor>
{
    public RegisterAuthorValidator() => RuleFor(command => command.Name).NotEmpty();
}
```

   **Done:** the validation result names the `Name` member; a generic exception or a successful empty response is not a field rejection. Do not query a list inside this rule to reserve a unique name across writers.
3. Dispatch blank input directly through the server pipeline on fresh state. Dispatch Aster separately with the same permissions. Run `dotnet test` on the fixture from [Exercise the backend](../cratis-specifications-exercise-backend/SKILL.md). **Done:** blank yields a member error and zero appends; Aster succeeds and appends once. If blank passes, inspect discovery and the dispatch path before adding another client-side guard.
