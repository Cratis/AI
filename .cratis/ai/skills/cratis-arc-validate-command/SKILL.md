---
name: cratis-arc-validate-command
description: Use when a model-bound command needs member-level validation to reject a missing or invalid field. Not for enforcing uniqueness across writers (use cratis-chronicle-constrain-append).
compatibility: Requires the Cratis package, which supplies Arc and FluentValidation global usings.
---

# Require an author name

Use a command validator for the registration rule below on a plain string. To require a nonempty value wherever `AuthorName` is itself validated, put `public class AuthorNameValidator : ConceptValidator<AuthorName> { public AuthorNameValidator() => RuleFor(name => name.Value).NotEmpty(); }` next to `AuthorName`. Import `Cratis.Arc.Validation` and `FluentValidation`.

Add the validator beside [RegisterAuthor](../cratis-arc-declare-command/SKILL.md) in `Features/Authors/Registration/RegisterAuthor.cs`. Arc discovers `CommandValidator<RegisterAuthor>`; no dependency injection registration is necessary. Keep the file's existing namespace declaration; add the validator class below the command. Add `using Cratis.Arc.Commands;` for the base class and `using FluentValidation;` for the rule extensions unless those namespaces are already in scope.

```csharp
public class RegisterAuthorValidator : CommandValidator<RegisterAuthor>
{
    public RegisterAuthorValidator()
    {
        RuleFor(command => command.Name).NotEmpty().WithMessage("Name is required");
    }
}
```

The execute pipeline applies blocking validation before `Handle`. A separate `/validate` request can provide early feedback, but is not needed to enforce the rule. Execute registration with an empty name. Expect `IsValid` and `IsSuccess` to be false, `ValidationResults` to identify the name member, and no event to be appended. With `Aster`, expect success and one registration.

## When it goes off the usual path

- **A warning is allowed to pass:** Arc filters it out of `ValidationResults`; do not expect it alongside a successful result. To block even confirmed warnings, put `[BlockOnValidationSeverity(ValidationResultSeverity.Warning)]` on the command. Import `Cratis.Arc.Commands.ModelBound` and `Cratis.Arc.Validation`.

## Avoid

- Do not throw from `Handle` for a missing field; attach the rule to that field.
- Do not register a validator per rule. Add registration-specific rules to the existing validator.
- Do not use a validation lookup to win a race. [Protect a decision](../cratis-chronicle-protect-decision/SKILL.md) based on current state, or use an append constraint for uniqueness across writers.

## Related skills

- [Declare the command](../cratis-arc-declare-command/SKILL.md)
- [Constrain the append](../cratis-chronicle-constrain-append/SKILL.md)
