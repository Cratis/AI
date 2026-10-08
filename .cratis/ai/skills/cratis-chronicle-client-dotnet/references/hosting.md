## In a host

```csharp
var builder = Host.CreateApplicationBuilder(args);
builder.AddCratisChronicle(options => options.EventStore = "<EventStoreName>");
builder.Services.AddHostedService<<WorkerName>>();
await builder.Build().RunAsync();
```

`AddCratisChronicle` is an extension on **`IHostApplicationBuilder`**
(`Source/Clients/DotNET/ChronicleHostApplicationBuilderExtensions.cs:28`) and binds
the `Cratis:Chronicle` configuration section by default (`:25`, `:37`), with
`ValidateDataAnnotations().ValidateOnStart()`. The bound type is
`ChronicleClientOptions : ChronicleOptions`, which adds a `[Required] EventStore`
and an optional `EventStoreNamespaceResolverType`.

> **`AddCratisChronicle` on `IServiceCollection` does not exist**, despite what
> `Documentation/clients/dotnet/getting-started.md:61` shows. The real extensions
> are on `IHostApplicationBuilder`, `WebApplicationBuilder` (in the AspNetCore
> package), and Aspire's `IDistributedApplicationBuilder`. `IHostBuilder.AddCratisChronicle()`
> also exists but only registers concept type converters
> (`Source/Clients/DotNET/Hosting/HostBuilderExtensions.cs:18-23`) — it is not
> the wiring entry point.

`IChronicleBuilder` extensions are exactly five:
`WithArtifactsProvider`, `WithIdentityProvider`, `WithCorrelationIdAccessor`,
`WithNamespaceResolver`, `WithCamelCaseNamingPolicy`
(`Source/Clients/DotNET/ChronicleBuilderExtensions.cs`). **There is no
`WithClaimsBasedNamespaceResolver`**, despite a doc comment at
`ChronicleOptions.cs:141` referring to one. Pass the resolver instead:
`new ChronicleClient(options, namespaceResolver: new ClaimsBasedNamespaceResolver("tenant_id"))`.
