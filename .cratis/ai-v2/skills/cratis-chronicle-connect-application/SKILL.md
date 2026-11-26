---
name: cratis-chronicle-connect-application
compatibility: .NET SDK and a disposable Chronicle kernel for connection checks.
description: Use when connecting an application to a Chronicle kernel, choosing a store and namespace, or configuring the Chronicle endpoint and TLS. Not for request authorization (cratis-arc-authorize-request).
---

# Connect once, select the logical target explicitly

**Requires (container-hosted kernel):** Check `docker info` before starting local services. If the daemon is unavailable, use a provisioned disposable kernel or leave the connection check unverified.

1. Resolve endpoint, TLS trust and credential source from host configuration. Do not print the connection string. Read references/tls.md when certificate validation fails; read references/local-orchestration.md for disposable services. **Done:** confirm reachability and the expected server identity without disclosing secrets.
2. Register one host-managed Chronicle client rather than constructing a connection per request. Resolve the store and namespace from trusted application scope. For Authors the namespace isolates the application's histories; it is neither the author ID nor evidence that the caller is allowed to read them. **Done:** a probe can name its expected logical target before connecting.
A disposable probe can own the client directly; `FromDevelopmentConnectionString()` targets the local development kernel and is not a production TLS policy:

```csharp
        using var client = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString());
        const string name = "corpus-connect";
        var ns = Guid.NewGuid().ToString();
        var expected = await client.GetEventStore(name, ns);
        var control = await client.GetEventStore(name, ns + "-other");
```

3. Append a marked synthetic fact only on a disposable target, then read it from the expected source there and check that a sibling namespace lacks it. Release the client at host shutdown. **Done:** matching payload, store and namespace, absent control, orderly disposal. If the connection worked but the read is empty, compare logical targets before changing TLS.

Run `dotnet test -c Release` in the application's connection spec project against the disposable kernel. The marker must appear under the intended source only in the selected namespace; a TCP handshake does not test namespace selection.
