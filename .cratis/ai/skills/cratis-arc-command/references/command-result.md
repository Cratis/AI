# CommandResult and ValidationResult

## Contents

- Server side
- Map integration exceptions
- Severity filtering
- Client side
- Executing with a severity

Source: `Cratis.Arc.Core` and `@cratis/arc`.
Sources: `Source/DotNET/Arc.Core/Commands/CommandResult.cs`,
`CommandValidationResults.cs` and `Source/JavaScript/Arc/commands/Command.ts`.

## Server side

`Cratis.Arc.Commands.CommandResult`:

| Member | Type | Notes |
| --- | --- | --- |
| `CorrelationId` | `CorrelationId` | Defaults to `CorrelationId.NotSet` |
| `IsSuccess` | `bool` | Computed: `IsAuthorized && IsValid && !HasExceptions` |
| `IsAuthorized` | `bool` | Settable; defaults to `true` |
| `IsValid` | `bool` | Computed: `!ValidationResults.Any()` |
| `HasExceptions` | `bool` | Computed: `ExceptionMessages.Any()` |
| `ValidationResults` | `IEnumerable<ValidationResult>` | |
| `ExceptionMessages` | `IEnumerable<string>` | |
| `ExceptionStackTrace` | `string` | |
| `AuthorizationFailureReason` | `string` | |

`CommandResult<TResult>` adds a `Response` of `TResult`.

`IsValid` and `HasExceptions` are **derived**, not stored. There is no way to
set them directly — a result is invalid because it carries validation results.

Factories: `Success`, `Unauthorized`, `MissingHandler`, `Error`, `InvalidBody`,
`FromException`.

⚠️ **A failed result carries no response.** The pipeline clears the response once
every execution scope has completed and the result is not successful, so a
transaction that rolls back after `Handle` returned a value does not leak that
value into the error body.

## Map integration exceptions

Requires Arc 22.100.0 or later for `Cratis.Arc.Commands.ICommandExceptionMapper`.
Check `dotnet list package --include-transitive`; older Arc has no mapper hook
and uses `CommandResult.FromException` for unhandled execution exceptions.

Implement the interface for an integration's typed failures, not ordinary
user-correctable rejections (return validation results for those):

```csharp
bool TryMap(CommandContext context, Exception exception,
    [NotNullWhen(true)] out CommandResult? result);
```

`NotNullWhen` is from `System.Diagnostics.CodeAnalysis`. Return `true` with a
non-null **failure** preserving `context.CorrelationId`, or `false` with `null`
to decline. Match exception types/properties rather than parsing messages.
Implementations are convention-discovered through `IInstancesOf<ICommandExceptionMapper>`
(`Cratis.Types`) and resolved from the command's service scope. The first accepting
mapper wins. Mapping runs for exceptions escaping command execution or response
processing, before execution scopes complete, so a mapped failure still rolls
back pending work. If no mapper accepts, the pipeline falls back to
`CommandResult.FromException`; a throwing mapper produces `CommandResult.Error`
and scopes still complete with
failure. This hook does not replace validation-only or scope-completion exception
handling. Specify accepting, declining and throwing cases and assert rollback
and correlation preservation, not only the message.

## Severity filtering

`ValidationResultSeverity`: `Unknown = 0`, `Information = 1`, `Warning = 2`,
`Error = 3`.

Only *blocking* results survive onto the result. For an unannotated command,
with no `allowedSeverity`, only `Error` blocks; with a caller threshold, anything
strictly greater blocks. `[BlockOnValidationSeverity(ValidationResultSeverity.Warning)]`
(`Cratis.Arc.Commands.ModelBound`) declares an inclusive blocking floor across
HTTP, Validate, Provide and in-process execution. Caller `X-Allowed-Severity` or
`allowedSeverity` can tighten, never loosen, that floor; attributed commands
also block `Unknown`. The generated proxy carries `blockOnValidationSeverity`
and applies it client-side. This attribute does not change an unannotated
command's legacy filtering.

## Client side

`@cratis/arc` `ICommandResult<TResponse = object>`:

```ts
readonly correlationId: Guid;
readonly isSuccess: boolean;
readonly isAuthorized: boolean;
readonly isValid: boolean;
readonly hasExceptions: boolean;
readonly validationResults: ValidationResult[];
readonly exceptionMessages: string[];
readonly authorizationFailureReason: string;
readonly exceptionStackTrace: string;
readonly response?: TResponse;
```

`ValidationResult` is a class with these readonly members:

```ts
severity: ValidationResultSeverity   // numeric enum, 0..3
message: string
members: string[]
state: any
reason: ValidationResultReason       // defaults to Rule
reasonDetail?: string
```

⚠️ **There is no `propertyName` and no string severity.** A rule attributes its
failure to one or more `members`, and `severity` is the numeric
`ValidationResultSeverity` enum. Code that reads `v.propertyName` or compares
`v.severity === 'Error'` is reading fields that do not exist.

Match an application-authored rule failure to a field through `members`. Branch
on `reason` and `reasonDetail`, never parse `message`: non-rule messages are
developer diagnostics, not user-facing copy. `reasonDetail` identifies the
specific cause (a constraint name, for instance). Validator refusals, explicit
`ValidationResult` outcomes from `Provide()`/`Handle()`, and
`IEnumerable<ValidationResult>` outcomes from `Provide()` share
`validationResults`, subject to blocking severity. Validators own refusals when
usable facts exist; `Provide()` short-circuits only when acquisition yields
nothing usable, and `Handle()` must not duplicate business validation. Use
`response` only on success.

```tsx
const result = await command.execute();

if (!result.isAuthorized) { /* the caller is not allowed to do this */ }
else if (!result.isValid) {
    // Non-rule outcomes need safe application feedback, not raw diagnostic text.
    const hasDiagnostics = result.validationResults.some(v => v.reason !== ValidationResultReason.Rule);
    if (hasDiagnostics) { /* choose safe copy by reason/reasonDetail */ }
    else {
        const errorFor = (property: string) =>
            result.validationResults.find(v => v.members.includes(property))?.message;
    }
}
else if (result.hasExceptions) { /* server fault */ }
else { /* result.response */ }
```

`members` is **camelCased on purpose**, so a form can match a server failure to
the field that caused it without transforming anything. A nested member is a
dotted path from the graph root — `address.postalCode`. A failure raised by a
`ConceptValidator<T>` is attributed to the field holding the concept, not to the
concept's inner `Value`, because TypeScript erases the concept to its primitive
and names the field the same way.

`reason` also distinguishes a genuine rejection from a validator that threw
while validating hostile or partial input: the latter arrives as a single result
with a `ValidatorFailed` (`validatorFailed`) reason and a generic message, replacing every message
the validator's author wrote. Do not read the message to tell the two apart.
Other non-rule reasons include `dependencyUnavailable` (facts unavailable before
rules), `concurrencyViolation`, `constraintViolation` and `frameworkFailure`.
They need safe application feedback and an appropriate refresh/retry path, not
blanket field-error rendering. The reason set is open; unknown reasons need a
safe fallback. Never show `exceptionMessages`/`exceptionStackTrace` to users.

`CommandForm` renders raw validation messages; `toastCommandResult` joins them
into its invalid-result toast. Neither sanitizes non-rule diagnostics. Use
application-owned feedback and suppress built-in form errors with
`showErrors={false}` where necessary. See the React page skill's
[queries-and-commands.md](../../cratis-arc-react-page/references/queries-and-commands.md).

## Executing with a severity

`command.execute(allowedSeverity?, ignoreWarnings?)` mirrors the server-side
filtering. `command.validate()` runs authorization and validation on the server
without the handler; `command.validateClientSide()` runs only the extracted
rules locally and never touches the network.
