---
name: cratis-arc-invoke-command
description: Use when a job, service or reactor must execute a command outside an HTTP request or handle its failure. Not for implementing Handle (use cratis-arc-declare-command).
compatibility: Requires the Cratis package and a configured Arc command pipeline.
---

# Dispatch a command from a service

Inject `ICommandPipeline` into the service that initiates registration. `Execute(command)` creates its own service scope. Await the result before recording the import as successful.

`RegisterAuthor` and `AuthorId` come from [Declare a command](../cratis-arc-declare-command/SKILL.md). In `Features/Authors/Registration/AuthorImporter.cs`, using the `Cratis` global usings:

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

Inspect the final result: `!IsAuthorized` means access was denied, `!IsValid` points to `ValidationResults`, and `HasExceptions` means execution failed. `IsRetryable` identifies a retryable result. Use `Validate(command)` only for early feedback: it does not run `Provide()` or `Handle()` and does not replace checking the final result.

## When it goes off the usual path

- **The command must use scoped dependencies the caller already owns:** pass the existing scoped provider to `Execute(command, services)`. The caller owns disposal. Otherwise let the pipeline create a scope.
- **An import spans several commands:** decide whether a failed item stops the job, gets retried, or is recorded while other items continue. One successful execution does not mean the batch committed.

## Avoid

- Do not call `Handle()` directly; the pipeline runs validation, authorization and the append.
- Do not pass the root provider or an unrelated scope to `Execute`.
- Choose `Execute<TResponse>` only if the command contract returns a value the caller uses. Check `IsSuccess` before reading the typed `Response`.

## Related skills

- [Declare a command](../cratis-arc-declare-command/SKILL.md)
- [Validate its inputs](../cratis-arc-validate-command/SKILL.md)
