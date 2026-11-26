---
name: cratis-chronicle-connect-application
description: Use when registering the standalone Chronicle client in an ASP.NET Core application or setting its endpoint and event store. Not for setting tenant authorization policy (use cratis-arc-isolate-tenant).
compatibility: .NET SDK and a disposable Chronicle kernel for connection checks.
---

# Connect an ASP.NET Core library service to Chronicle

1. Reference `Cratis.Chronicle.AspNetCore` in the standalone web project. Configure the endpoint under `Cratis:Chronicle:ConnectionString` in `appsettings.json`. Replace the example host and port with those of the Chronicle kernel. Use a certificate trusted by the application and enable validation explicitly:

```json
{
  "Cratis": {
    "Chronicle": {
      "ConnectionString": "chronicle://library.example:35000?skipTlsValidation=false"
    }
  }
}
```

2. Register Chronicle once in `Program.cs` and set the logical store name. In a web project with implicit usings the builder extensions need no additional import.
3. Build the app, add the Chronicle middleware, then run it:

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args)
    .AddCratisChronicle(options => options.EventStore = "library");

var app = builder.Build();
app.UseCratisChronicle();
await app.RunAsync();
```

For an Arc + Chronicle app using the combined `Cratis` package, use `builder.AddCratis(configureChronicleOptions: options => options.EventStore = "library");` and `app.UseCratis();` instead of the two standalone calls. For namespace selection per tenant, see [Isolate tenant access](../cratis-arc-isolate-tenant/SKILL.md).

## Check the connection

Append an `AuthorRegistered` event in the library store and check `result.IsSuccess` before reading the author's events back. With the same store name but a different namespace, reading that ID must not return the registration. When logging a `Cratis.Chronicle.Connections.ChronicleConnectionString` use `connectionString.Redacted` rather than the raw value.

## Avoid

- Don't create a client for each request.
- Don't omit `skipTlsValidation=false` and assume certificate validation is enabled.
- Don't assume the kernel's event storage determines read-model storage: the client's `DefaultSinkTypeId` selects that storage (MongoDB by default).

## Related skills

- [Configure the Arc host](../cratis-arc-host-application/SKILL.md)
- [Diagnose observer progress](../cratis-chronicle-inspect-observer/SKILL.md)
