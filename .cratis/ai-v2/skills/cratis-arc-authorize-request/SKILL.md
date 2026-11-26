---
name: cratis-arc-authorize-request
description: Use when configuring authentication, authorization or permissions for an Arc query or command. Not for partitioning tenant data (cratis-arc-isolate-tenant).
compatibility: Requires the .NET SDK.
---

# Enforce access before data leaves the server

1. Identify who authenticates the caller and which principal reaches Arc. Accept forwarded identity headers only behind an ingress that authenticates, strips incoming copies and is the sole route to the app. Otherwise leave trust disabled. **Done:** an arbitrary client-supplied actor cannot become a catalog editor.
2. Require the server permission on the command and separately on the read method. For a live query whose membership can change, register an `IGuardObservableQueryEmission` checking current server-side access before each delivery. A connection-time role check alone does not detect revocation. **Done:** an insufficient caller sees neither rows nor side effects, even without the UI. If the task is to scope the rows within granted access, use [Isolate a tenant](../cratis-arc-isolate-tenant/SKILL.md).
3. Exercise anonymous, insufficient and authorized callers against the real dispatch/transport. After a permitted subscription's initial response, revoke access then produce another update. **Done:** only the authorized operation succeeds, denied writes leave the stream unchanged, and no new protected payload crosses the connection after revocation. A guard runs at delivery, not on a timer; don't assert instant idle disconnect. If a revoked reader still sees updates, verify that the guard runs for each delivery and reads current membership. Record verdicts and synthetic IDs only, never tokens or claim dumps.

For example, check current membership on delivery, not just on subscription:

```csharp
public sealed class CatalogAccess(IReadOnlySet<string> readers) : IGuardObservableQueryEmission
{
    public Task<ObservableQueryEmissionVerdict> Guard(ObservableQueryEmissionContext context)
    {
        var actor = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var permitted = context.Principal?.Identity?.IsAuthenticated == true && actor is not null && readers.Contains(actor);
        return Task.FromResult(permitted ? ObservableQueryEmissionVerdict.Allow : ObservableQueryEmissionVerdict.DenyAndTerminate);
    }
}
```

Run `dotnet test -c Release` in the application's spec project. Expect the permitted read to succeed and revocation to stop subsequent protected data.
