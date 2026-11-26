---
name: cratis-arc-invoke-command
description: Runs a command from application code and handles failure. Use when a job or service must register an author. Not for implementing Handle (use cratis-arc-declare-command).
compatibility: Requires the Cratis package and a configured Arc command pipeline.
---

# Dispatch a command from a service

Inject `ICommandPipeline` into the service that initiates registration. `Execute(command)` creates its own service scope. Await the result before recording the import as successful.

`RegisterAuthor` and `AuthorId` come from [Declare a command](../cratis-arc-declare-command/SKILL.md). In `Authors/AuthorImporter.cs`, using the `Cratis` global usings:

```csharp
namespace Catalog.Authors;

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

`IsSuccess` is true when `IsAuthorized` and `IsValid` are true and `HasExceptions` is false. Use `ValidationResults` for invalid input; `IsRetryable` identifies a retryable result.

## Avoid

- Do not call `Handle()` directly; the pipeline runs validation, authorization and the append.
- Do not pass an unrelated service provider to `Execute`; use the command-only overload.
- Do not infer success from a response value. Only `Execute<TResponse>` gives a typed `Response`; check `IsSuccess` before reading it.

## Related skills

- [Declare a command](../cratis-arc-declare-command/SKILL.md)
- [Validate its inputs](../cratis-arc-validate-command/SKILL.md)
