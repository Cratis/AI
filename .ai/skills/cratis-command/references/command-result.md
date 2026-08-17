# CommandResult — Reference

Arc wraps every command response in a `CommandResult` envelope.

## Shape

```ts
interface ICommandResult<TResponse = object> {
    correlationId: Guid;
    isSuccess: boolean;          // true when authorized + valid + no exceptions
    isAuthorized: boolean;       // false → user lacks permission
    isValid: boolean;            // false → one or more validators failed
    hasExceptions: boolean;      // true → unhandled server exception
    validationResults: ValidationResult[];
    exceptionMessages: string[];
    authorizationFailureReason: string;
    exceptionStackTrace: string;
    response?: TResponse;        // present when the backend returned a value
}

// class ValidationResult from @cratis/arc/validation
class ValidationResult {
    severity: ValidationResultSeverity;  // numeric enum, NOT a string
    message: string;                     // a developer diagnostic unless reason is 'rule'
    members: string[];                   // camelCase member paths the result is attributed to
    state: any;                          // the rule author's state, carried through
    reason: ValidationResultReason;      // defaults to 'rule'
    reasonDetail?: string;               // e.g. the violated constraint's name
}

enum ValidationResultSeverity { Unknown = 0, Information = 1, Warning = 2, Error = 3 }
```

> **There is no `propertyName` and no `'Info'`.** The field is **`members: string[]`** (one result can be attributed to several members), and `severity` is the **numeric** `ValidationResultSeverity` enum — compare against `ValidationResultSeverity.Error`, never the string `'Error'`.

Branch on **`reason`** rather than matching `message`: `'rule'` (an authored rule — its message is meant to be shown), `'concurrencyViolation'`, `'constraintViolation'`, `'validatorFailed'`, `'dependencyUnavailable'`, `'malformedRequest'`. The set is open, so treat an unrecognized value as `'rule'`.

## Handling all cases

```tsx
const handleSubmit = async () => {
    const result = await command.execute();

    if (!result.isAuthorized) {
        navigate('/login');
        return;
    }

    if (!result.isValid) {
        // Map errors by member for inline display — a result can name several members
        const fieldErrors: Record<string, string> = {};
        for (const v of result.validationResults) {
            for (const member of v.members) {
                fieldErrors[member] = v.message;
            }
        }
        setErrors(fieldErrors);
        return;
    }

    if (result.hasExceptions) {
        toast.error(result.exceptionMessages.join('\n'));
        return;
    }

    onSuccess(result.response);  // result.response typed when backend returns a value
};
```

## Accessing the returned value

A command is a model-bound `[Command]` record with a public instance `Handle()`. **Never inject `IEventLog` into `Handle()`** — analyzer **ARCCHR0007** flags it, and under the zero-warning gate that fails the build. Express the append through the return type instead:

```csharp
[Command]
public record CreateOrder(OrderId Id, CustomerId CustomerId, Money Total)
{
    public OrderCreated Handle() => new(CustomerId, Total);
}
```

`Id` derives from `EventSourceId<T>`, so it resolves the event source and `OrderCreated` is appended to that stream — the event never carries the id as a payload property.

Per ARCCHR0007's own description, `Handle()` may return **a single event, a tuple of event and result, a `Result<TEvent, ValidationResult>`, or a collection of events** (use `EventForEventSourceId` wrappers to target another stream). Return a plain value or `void` when the command appends nothing.

Then on the frontend:

```ts
const result = await createOrder.execute();
if (result.isSuccess) {
    const newId = result.response as string; // Guids come as strings
}
```
