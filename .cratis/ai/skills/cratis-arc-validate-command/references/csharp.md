# C#: validate an Arc command

Prerequisite: `Cratis.Arc`; validators use FluentValidation.

Use a command validator for the registration rule below on a plain string. To require a nonempty value wherever `AuthorName` is itself validated, put `public class AuthorNameValidator : ConceptValidator<AuthorName> { public AuthorNameValidator() => RuleFor(name => name.Value).NotEmpty(); }` next to `AuthorName`. Import `Cratis.Arc.Validation` and `FluentValidation`.

Add the validator beside `RegisterAuthor` in `Features/Authors/Registration/RegisterAuthor.cs`. Arc discovers `CommandValidator<RegisterAuthor>`; no dependency injection registration is necessary. Keep the file's existing namespace declaration; add the validator class below the command. Add `using Cratis.Arc.Commands;` for the base class and `using FluentValidation;` for the rule extensions unless those namespaces are already in scope.

```csharp
public class RegisterAuthorValidator : CommandValidator<RegisterAuthor>
{
    public RegisterAuthorValidator()
    {
        RuleFor(command => command.Name).NotEmpty().WithMessage("Name is required");
    }
}
```

The execute pipeline applies blocking validation before `Handle`. A separate `/validate` request can provide early feedback, but is not needed to enforce the rule. For a one-off wiring check, execute registration with an empty name. Expect `IsValid` and `IsSuccess` to be false, `ValidationResults` to identify the name member, and no event to be appended. With `Aster`, expect success and one registration.

Refuse with a message → request the decision model in the validator. Need the state to build the event → take it as a `Handle` parameter. Both are protected by default.

For a relationship rule, take the related model as a typed validator constructor parameter (for example, `[LookUpBy(nameof(CancelReservation.ReservationId))] Reservation? reservation`, from `Cratis.Arc.Commands`). Check both existence and the relationship to the entity being changed. Nullable allows an absent instance; it doesn't turn an invalid key into a valid one. For a committed spec of this relationship rule, supply an existing reservation for a different book: the command must still be rejected.

## When a warning may pass

- **A warning is allowed to pass:** Arc filters it out of `ValidationResults`; do not expect it alongside a successful result. To block even confirmed warnings, put `[BlockOnValidationSeverity(ValidationResultSeverity.Warning)]` on the command. Import `Cratis.Arc.Commands.ModelBound` and `Cratis.Arc.Validation`.

## Avoid

- Do not throw from `Handle` for a missing field; attach the rule to that field.
- Do not register a validator per rule. Add registration-specific rules to the existing validator.
- Do not substitute a database lookup for a protected model parameter. For uniqueness across writers use an append constraint.

## Where each kind of check belongs

| Check | Place |
| --- | --- |
| Shape of the input | Rule on the field in the validator |
| Business refusal with a message | Validator that takes the decision model |
| Acquiring data | `Provide()` |
| The decision | `Handle()` |
| An answer that must still hold at append | Protected read model parameter |
| An invariant of the store, such as uniqueness | Append constraint |
| A fault | Exception |

A test that calls `Handle()` directly proves none of these guards; execute through the pipeline.

## Severity

A result blocks when its severity is greater than the allowed threshold, and an allowed result is removed, not returned beside success. To show a warning the first request must block it.

- Without a declared policy only `Error` blocks.
- `X-Allowed-Severity` is capped at `Warning` on model-bound HTTP endpoints, so a client cannot waive errors by sending `3`. Relaxing that takes an explicit command or host setting.
- The effective threshold is the stricter of the declared policy and the caller's request: a caller can ask for more blocking, never less.
- A command under read protection `On` has an `Error` floor even without `[BlockOnValidationSeverity]`: `Error` and `Unknown` always block.

## Read models as validator inputs

`[ReadModel]` marks a type; it does not load it. The provider that owns the type does: Chronicle, an EF Core `ReadOnlyDbContext` or MongoDB. Work out which one before debugging a missing instance, and tell apart no instance for a valid key, no provider for the type, and an invalid key. Declare the parameter non-nullable when the rule needs the state, so absence refuses; use a nullable parameter only when the rule handles absence.

## Dates and malformed input

`[property: ExplicitOffset]` on a `DateTimeOffset` or `DateTime` command property refuses a JSON instant without an offset or `Z`. It does not apply to route or query-string values, and `DateOnly` has no offset to require.

Authorization is checked before a malformed body is reported, so a refused caller gets 403 rather than a binding error. Member paths in results are camel-cased per segment and keep array indices, such as `lines[2].quantity`; pass them through unchanged for field feedback.
