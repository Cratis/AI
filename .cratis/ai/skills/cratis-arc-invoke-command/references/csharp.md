# C#: execute an Arc command from a service

Prerequisite: an Arc host with the command registered; `ICommandPipeline` comes from dependency injection.

Inject `ICommandPipeline` into the service that initiates registration. `Execute(command)` creates its own service scope. Await the result before recording the import as successful.

`RegisterAuthor` and `AuthorId` are the declared command and its identity. In `Features/Authors/Registration/AuthorImporter.cs`, using the `Cratis` global usings:

```csharp
namespace Library.Features.Authors.Registration;

public class AuthorImporter(ICommandPipeline commandPipeline)
{
    public async Task Import(AuthorId id, string name)
    {
        var result = await commandPipeline.Execute(new RegisterAuthor(id, name));
        if (!result.IsSuccess)
        {
            throw new InvalidOperationException($"Could not register author {id}. Correlation: {result.CorrelationId}");
        }
    }
}
```

Inspect the final result: `!IsAuthorized` means access was denied, `!IsValid` points to `ValidationResults`, and `HasExceptions` means execution failed. `IsRetryable` identifies a retryable result. Use `var preflight = await commandPipeline.Validate(command);` only for early feedback: it does not run `Provide()` or `Handle()` and does not replace checking the final result.

## When the caller owns the scope or runs a batch

- **The command must use scoped dependencies the caller already owns:** use `var result = await commandPipeline.Execute(command, services);` with the caller's scoped `IServiceProvider services`. The caller owns disposal. Otherwise let the pipeline create a scope.
- **An import spans several commands:** decide whether a failed item stops the job, gets retried, or is recorded while other items continue. One successful execution does not mean the batch committed.

## Avoid

- Do not call `Handle()` directly; the pipeline runs validation, authorization and the append.
- Do not pass the root provider or an unrelated scope to `Execute`.
- If using the server-generated ID variant of `RegisterAuthor`, execute `var result = await commandPipeline.Execute<AuthorId>(new RegisterAuthor(name));`. Check `result.IsSuccess` before reading `result.Response`.

## Classify a failure before using the response

`IsSuccess` is `IsAuthorized && IsValid && !HasExceptions`; `IsValid` alone does not establish success. Tell the failures apart, because each needs a different reaction:

| Check | Meaning |
| --- | --- |
| `!IsAuthorized` | The caller was refused. Do not retry. |
| `!IsValid` | The input or a rule was rejected; read `ValidationResults`. |
| `IsRetryable` | A temporary refusal: the same command can succeed later. |
| `IsMissingHandler` | No handler is registered. A deployment fault, not a domain refusal. |
| `HasExceptions` | Execution faulted. |

`result.GetRefusal()` returns a typed `CommandRefusal` for an authorization, constraint or rule refusal and `null` for success or a fault. Branch on it and on the typed validation data, not on rendered message text.

A command executed from inside another command returns a result like any other: awaiting it does not abort the parent. Check the child's result and propagate the failure. `Recovery` and `OperationOutcomes` are server-side observations and are not part of the HTTP response.
