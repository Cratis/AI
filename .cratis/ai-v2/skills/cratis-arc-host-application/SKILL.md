---
name: cratis-arc-host-application
description: Use when starting an Arc-only ASP.NET Core application to host a model-bound query without Chronicle. Not for an application that also needs Chronicle (use cratis-chronicle-connect-application).
compatibility: Requires Microsoft.NET.Sdk.Web and the Cratis.Arc package.
---

# Start an Arc host

In a `Microsoft.NET.Sdk.Web` project with `<ImplicitUsings>enable</ImplicitUsings>`, reference `Cratis.Arc`. Register Arc on the builder and activate it on the built application in `Program.cs` (top-level statements, no namespace).

```csharp
using Microsoft.AspNetCore.Builder;

var builder = WebApplication.CreateBuilder(args);
builder.AddCratisArc(options =>
{
    options.GeneratedApis.RoutePrefix = "api";
    options.GeneratedApis.SegmentsToSkipForRoute = 1;
});
var app = builder.Build();
app.UseCratisArc();
await app.RunAsync();
```

Run `dotnet run` from the host project directory. Use the listening address printed at startup and the credentials required by the existing query. With the options above, namespace `Library.Features.Authors.Listing` and method `AllAuthors` map to `/api/features/authors/listing/all-authors`. For an observable query, append `?waitForFirstResult=true` to request one result. Expect HTTP 200, `isSuccess: true` and the expected authors in `data`.

## Avoid

- Do not omit either half of `AddCratisArc()` / `UseCratisArc()`.
- Do not add a controller for a model-bound query; put the method on its read model.
- Do not register Arc twice in an application using Chronicle. The `Cratis` package composes both through `AddCratis()` / `UseCratis()`.

## Related skills

- [Expose an author query](../cratis-arc-expose-query/SKILL.md)
- [Connect Chronicle](../cratis-chronicle-connect-application/SKILL.md)
