# Connect an ASP.NET Core library service to Chronicle

Start with a running kernel, its trusted endpoint and credentials for the application. If none exists, start a kernel (the `cratis-chronicle-deploy-kernel` skill, when installed) first. Supply credentials through the deployment secret store rather than committing a credential-bearing connection string.

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

Choose the combined host when the app already uses Arc and Chronicle through `Cratis`: call `builder.AddCratis(configureChronicleOptions: options => options.EventStore = "library");` and `app.UseCratis();` instead of the two standalone calls. For namespace selection per tenant, see Isolate tenant access (the `cratis-arc-isolate-tenant` skill, when installed).

## Check the connection

One-off wiring check, not a committed spec of namespace isolation. For a change to an application's tenant boundary, use its existing backend fixture (the `cratis-specifications-exercise-backend` skill, when installed).

In a disposable namespace, resolve the scoped `IEventStore` and use [the registration event and source ID](../../cratis-chronicle-record-event/SKILL.md): `var result = await eventStore.EventLog.Append(authorId, new AuthorRegistered("Aster"));` with a fresh `AuthorId`. Check `result.IsSuccess`, then read `await eventStore.EventLog.GetFromSequenceNumber(EventSequenceNumber.First, authorId)` (`using Cratis.Chronicle.Events;`). With the same store name but a different namespace, the read must not return the registration. When logging a `Cratis.Chronicle.Connections.ChronicleConnectionString` use `connectionString.Redacted` rather than the raw value.

## Avoid

- Don't create a client for each request.
- Don't omit `skipTlsValidation=false` and assume certificate validation is enabled.
- Don't assume the kernel's event storage determines read-model storage: the client's `DefaultSinkTypeId` selects that storage (MongoDB by default).

## When it goes off the usual path

- **The client cannot connect or register:** first verify the resolved host and port from the app's network. If it reaches the intended kernel, compare the installed client and running kernel versions for the operation that fails. Record versions and endpoint only, not credentials.
- **A development connection worked but a shared endpoint fails TLS:** verify the trusted certificate and hostname. The development image bundles dependencies and generates an untrusted certificate; configure production dependencies and certificates explicitly. Don't turn off validation for a shared endpoint.

## Related skills

- Configure the Arc host (the `cratis-arc-host-application` skill, when installed)
- Diagnose observer progress (the `cratis-chronicle-inspect-observer` skill, when installed)

## Select namespace and wait for registration

`GetEventStore(name, namespace)` selects explicitly. Omit the namespace and one configured `IEventStoreNamespaceResolver` decides it: the plain default returns Default; ASP.NET Core supplies a header resolver. Do not treat an untrusted header as tenant authorization. Normalize the authorized namespace, pass it explicitly in a background worker, and include it in cache keys. Never retain a scoped tenant store on a singleton. Events, positions, claims, materialized state and erasure effects are namespace-scoped even when definitions are shared per store. Listing is not ensuring or removing a namespace.

Use hosted DI for a long-lived worker. In a short-lived tool own and dispose the client after the registered work finishes. A transport connection, store selection, artifact registration and observer subscription are separate milestones. Await registration and inspect its outcome rather than adding a sleep; a compiled CLR type is not a store-local artifact registration. When using explicit aliases, resolve through that store's own registry. Additional event information is produced by client serialization. For synthetic data, implement `ICanSeedEvents` with explicit source IDs and scope it with `ForNamespace` unless it really belongs in every tenant. A program's complete discovered global declaration replaces its previous one for future namespaces; it never retracts appended events. Explicitly queued additions remain append-only. Seeding is not a synchronous readiness gate. Enable certificate validation explicitly for shared deployments; mTLS client certificates do not replace validation of the server. Load PKCS#12 credentials from a protected mount and never log passwords. `Unimplemented` on the compatibility handshake uses the older exchange; `Unavailable` logs that the check was unreachable, not that the versions agree.
