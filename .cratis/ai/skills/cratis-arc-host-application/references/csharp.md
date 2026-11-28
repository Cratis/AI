# Start an Arc host

For an Arc-only ASP.NET Core host, pair `AddCratisArc()` with `UseCratisArc()`. For a host that also uses Chronicle, follow the connection steps in the `cratis-chronicle-connect-application` skill (in `cratis/chronicle/client-dotnet`).

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

## Locate a missing host capability

Use `AddCratis` / `UseCratis` for the combined host, not a second Chronicle registration. Standalone `ArcApplication` uses `Hosting.ApplicationUrl`; ASP.NET uses its own listener settings. Verify the bound address before troubleshooting a route. If generated routes are absent, check discovery and endpoint mapping; distinguish an unmapped route from one challenging the caller. Check introspection and query health independently. Development identity/tenant fixtures and detailed exception responses belong only in development. Do not change a production environment to Development to make diagnostics appear.

Availability is distinct from authorization. Ask about the same part with the same arguments as execution. Suspension takes precedence over audience entitlement. If the host cannot evaluate availability, report a retryable evaluation failure, not permission or a permanent denial.

`builder.AddCratisArc(configureBuilder: arc => arc.WithoutControllers())` disables MVC endpoints at runtime; set the MSBuild property `CratisArcControllersSupport=false` to remove controller support for a trimmed or AOT publication. During configuration, call `options.AddJsonTypeInfoResolver(AppJsonContext.Default)` with the application's source-generated `System.Text.Json` context, before serializer options freeze. Include closed `CommandResult<TResponse>` types for typed command responses in that context. Run the published artifact and execute a typed-response command; assert the response deserializes with its expected data. Expose the embedded event-model viewer only when intended for that deployment.

## Declare availability

Use `Cratis.Arc.Availability` for typed gates. For a feature whose application context supplies a `Vessel` with `HasReported`, declare the shared block and scope in the feature's namespace:

```csharp
public class Plus : Audience;

public class DataQuality : AvailabilityBlock
{
    protected override IReadOnlyList<AvailabilityTerm> Lines =>
        [For<Plus>(), When.On<Vessel>(v => v.HasReported).IsTrue()];
}

[Available<DataQuality>]
public class FeatureAvailability : AvailabilityScope;

[Command]
[AvailableFor<Plus>]
public record ResetScore(VesselId Vessel);
```

Use `[AvailableWhen<HasPaidInvoice>]` when a gate needs an application implementation of `IAvailabilityCondition`. Each attribute is one line and every line must hold. Verify that a missing audience or unmet condition closes the gate.
