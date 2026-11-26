---
name: cratis-arc-validate-command
description: Use when a model-bound command needs member-level validation to reject a missing or invalid field. Not for enforcing uniqueness across writers (use cratis-chronicle-constrain-append).
compatibility: Requires the Cratis package, which supplies Arc and FluentValidation global usings.
---

# Require an author name

Add the validator beside [RegisterAuthor](../cratis-arc-declare-command/SKILL.md) in `Features/Authors/Registration/RegisterAuthor.cs`. Arc discovers `CommandValidator<RegisterAuthor>`; no dependency injection registration is necessary. Keep the file's existing namespace declaration; add the validator class below the command.

```csharp
public class RegisterAuthorValidator : CommandValidator<RegisterAuthor>
{
    public RegisterAuthorValidator()
    {
        RuleFor(command => command.Name).NotEmpty().WithMessage("Name is required");
    }
}
```

Execute registration with an empty name. Expect `IsValid` and `IsSuccess` to be false, `ValidationResults` to identify the name member, and no event to be appended. With `Aster`, expect success and one registration.

## Avoid

- Do not throw from `Handle` for a missing field; attach the rule to that field.
- Do not register a validator per rule. Add registration-specific rules to the existing validator.
- Do not use a validation lookup to guarantee uniqueness; use an append constraint.

## Related skills

- [Declare the command](../cratis-arc-declare-command/SKILL.md)
- [Constrain the append](../cratis-chronicle-constrain-append/SKILL.md)
