# MCP protocol check

`Specs/Exposure.cs` exposes one one-shot `list_authors` read. `FixtureHost.cs` starts a loopback capability listener using Arc's PAT-only MCP profile, its verifier and a disposable in-memory authority. Each run makes two fresh credentials with different scopes. No external host, production issuer, environment token or container is required. Do not log request headers or copy these fixture adapters to an application.

Build `Specs/Specs.csproj` in Release with warnings as errors, then run `dotnet test Specs/Specs.csproj -c Release --no-build`. The check requires a positive call returning Aster, refusal without the read scope or without credentials, and refusal of a tool outside the catalog.
