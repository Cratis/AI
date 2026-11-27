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

Choose the combined host when the app already uses Arc and Chronicle through `Cratis`: call `builder.AddCratis(configureChronicleOptions: options => options.EventStore = "library");` and `app.UseCratis();` instead of the two standalone calls. For namespace selection per tenant, see [Isolate tenant access](../cratis-arc-isolate-tenant/SKILL.md).

## Check the connection

In a disposable namespace, resolve the scoped `IEventStore` and use `var result = await eventStore.EventLog.Append(authorId, new AuthorRegistered("Aster"));` with a fresh `AuthorId`. Check `result.IsSuccess`, then read `await eventStore.EventLog.GetFromSequenceNumber(EventSequenceNumber.First, authorId)` (`using Cratis.Chronicle.Events;`). With the same store name but a different namespace, the read must not return the registration. When logging a `Cratis.Chronicle.Connections.ChronicleConnectionString` use `connectionString.Redacted` rather than the raw value.

## Avoid

- Don't create a client for each request.
- Don't omit `skipTlsValidation=false` and assume certificate validation is enabled.
- Don't assume the kernel's event storage determines read-model storage: the client's `DefaultSinkTypeId` selects that storage (MongoDB by default).

## When it goes off the usual path

- **The client cannot connect or register:** first verify the resolved host and port from the app's network. If it reaches the intended kernel, compare the installed client and running kernel versions for the operation that fails. Record versions and endpoint only, not credentials.
- **A development connection worked but a shared endpoint fails TLS:** verify the trusted certificate and hostname. The development image bundles dependencies and generates an untrusted certificate; configure production dependencies and certificates explicitly. Don't turn off validation for a shared endpoint.

## Related skills

- [Bind the deployment environment](../cratis-platform-configure-environment/SKILL.md) to keep the preview connection separate from shared settings.

- [Configure the Arc host](../cratis-arc-host-application/SKILL.md)
- [Diagnose observer progress](../cratis-chronicle-inspect-observer/SKILL.md)
