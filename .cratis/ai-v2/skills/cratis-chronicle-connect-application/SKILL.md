---
name: cratis-chronicle-connect-application
description: Use when connecting an application to a Chronicle kernel, choosing a store and namespace, or configuring the Chronicle endpoint and TLS. Not for request authorization (cratis-arc-authorize-request).
---

# Connect once, select the logical target explicitly

1. Resolve endpoint, TLS trust and credential source from host configuration. Do not print the connection string. Read references/tls.md when certificate validation fails; read references/local-orchestration.md for disposable services. **Done:** confirm reachability and the expected server identity without disclosing secrets.
2. Register one host-managed Chronicle client rather than constructing a connection per request. Resolve the store and namespace from trusted application scope. For Authors the namespace isolates the application's histories; it is neither the author ID nor evidence that the caller is allowed to read them. **Done:** a probe can name its expected logical target before connecting.
A fixture can own the client directly; `FromDevelopmentConnectionString()` targets the local development kernel and is not a production TLS policy:

```csharp
using var client = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString());
var expected = await client.GetEventStore(name, ns);
var control = await client.GetEventStore(name, ns + "-other");
```

3. Append a marked synthetic fact only on a disposable target, then read it from the expected source there and check that a sibling namespace lacks it. Release the client at host shutdown. **Done:** matching payload, store and namespace, absent control, orderly disposal. If the connection worked but the read is empty, compare logical targets before changing TLS.

Run `dotnet build Specs --configuration Release -warnaserror`, then `dotnet test Specs --configuration Release --no-build` from the example fixture. The fixture owns one client for its lifetime; a TCP handshake alone does not exercise target selection.
