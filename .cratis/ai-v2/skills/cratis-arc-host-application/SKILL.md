---
name: cratis-arc-host-application
description: Use when configuring Arc startup in Program.cs or diagnosing a host that fails to start or discover a slice. Not for implementing the query that an existing endpoint calls (cratis-arc-expose-query).
compatibility: Requires the .NET SDK.
---

# Discover a slice in a web host

1. Choose one public command or static query in an application assembly and identify its expected route, including prefix and skipped namespace segments. **Done:** there is a specific endpoint to probe, not just a health page. If the contract itself is missing, create it before diagnosing discovery.
2. For an Arc-only host register Arc before building, then activate it on the built app. Register handler dependencies before `Build()`. Do not introduce a Chronicle connection merely to discover a slice.

```csharp
        var builder = WebApplication.CreateBuilder(args);
        builder.AddCratisArc();
        var app = builder.Build();
        app.UseCratisArc();
        await app.RunAsync();
```

   **Done:** startup completes with the intended environment. For a host already using the full-stack `AddCratis`/`UseCratis` composition, keep that pair rather than registering Arc twice.
3. Start with `dotnet run` and request the known endpoint on the reported loopback address as the intended test identity. **Done:** a successful query result contains the seeded value. For 404 compare the host route options and assembly discovery; for refusal inspect authorization, not discovery. If only the published build fails, repeat the probe on the untrimmed Release artifact. Arc 24.9.0 does not support trimmed or NativeAOT publishing. Hand missing bindings to [Configure the environment](../cratis-platform-configure-environment/SKILL.md) without dumping settings.
