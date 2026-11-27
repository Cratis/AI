---
name: cratis-arc-host-application
description: Use when a developer needs to start an ASP.NET Core host and verify a model-bound Arc query without an event store. Not for an application that also needs Chronicle (use cratis-chronicle-connect-application).
compatibility: Requires Microsoft.NET.Sdk.Web and the Cratis.Arc package.
---

# Start an Arc host

For an Arc-only ASP.NET Core host, pair `AddCratisArc()` with `UseCratisArc()`. For a host that also uses Chronicle, follow [Connect Chronicle](../cratis-chronicle-connect-application/SKILL.md) instead.

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

Add a read model with a public static query when starting from an empty project. For a finite smoke query with no database, add this probe in `Features/Diagnostics/LibraryStatus.cs`:

```csharp
using Cratis.Arc.Queries.ModelBound;

namespace Library.Features.Diagnostics;

[ReadModel]
public record LibraryStatus(string State)
{
    public static LibraryStatus CurrentStatus() => new("Open");
}
```

Run `dotnet run` from the host project directory. With the options above, request `GET /api/features/diagnostics/current-status` at the listening address printed at startup. Expect HTTP 200, `isSuccess: true` and `data.state` equal to `Open`. When testing an existing query, use its route and required credentials. For an observable query, append `?waitForFirstResult=true` to request one result.

## When it goes off the usual path

- **The host probe passes but an append cannot connect:** check the configured endpoint and availability of the separate Chronicle kernel. `CurrentStatus` verifies Arc's HTTP route, not event appends or projection delivery.

## Avoid

- Do not omit either half of `AddCratisArc()` / `UseCratisArc()`.
- Do not add a controller for a model-bound query; put the method on its read model.
- When adding Chronicle, replace the Arc-only registration rather than registering Arc twice.

## Related skills

- [Expose an author query](../cratis-arc-expose-query/SKILL.md)
- [Connect Chronicle](../cratis-chronicle-connect-application/SKILL.md)
