---
name: cratis-platform-start-application
description: Use when an application author needs to go from an empty directory to a running Cratis .NET and React application. Not for an existing host with the wrong connection (use cratis-platform-configure-environment).
---

# Start a local Library application

This scaffold is the code-first path. If the repository has `.play` files under `model/` or the user asks for Screenplay or Stage, skip `cratis new`. [Discover the timeline](../cratis-modeling-discover-timeline/SKILL.md) and [design the event model](../cratis-modeling-design-event-model/SKILL.md) first. For Stage generation, the initial render supplies the application scaffold.

Use a development machine with the Cratis CLI (scaffold syntax below: 3.154.2), .NET 11 SDK, Docker Compose, npm and Node.js `^20.19.0` or `>=22.12.0`. Start in an empty parent directory with access to the package feeds. `Library` is the example application name.

```sh
cratis new cratis --language csharp -n Library -o Library --version 1.9.2 --packageManager npm --allow-scripts no
cd Library
```

Read the scaffold summary. Declining template scripts skips frontend installation; it does not undo file creation. The template version pins the scaffold, not the product packages resolved during creation. Check the generated project and package versions before applying version-specific recipes.

The template can synchronize its own AI selection, which may name an older profile. In `Library`, run `cratis ai profiles list`. If `cratis/application` is not listed, select a compatible CLI and corpus before continuing; don't assume the scaffold installed it. To select that profile, replace `<your-harness>` with the harness you use (for example, `pi`):

```sh
cratis ai install --profiles cratis/application --harnesses <your-harness> --languages csharp,typescript
cratis ai status
```

Check the selected profile, harness and languages. Resolve reported installation conflicts without overwriting local edits.

1. Keep the generated Compose port mappings on loopback. The development dashboard allows anonymous access. Start infrastructure with `docker compose up -d`. For the generated local self-signed endpoint only, `curl --insecure https://localhost:35000/health` should print `Healthy`. If not, inspect `docker compose ps` and the service logs before starting the app.
2. Review the generated frontend dependencies and scripts, then run `npm install` in `Library`. Start `dotnet run` as a background job or in a dedicated terminal. Run `npm run dev` in the same directory while the backend stays up.
3. Open `http://localhost:9000`, choose **Demo → Register**, and enter a disposable name. The name should appear in the list. If the page loads but registration fails, check that Vite can reach the backend and that the backend can reach the intended local store.
4. Stop the backend job and Vite (Ctrl+C for a foreground process); `docker compose stop` preserves the containers and their data. Do not remove containers to diagnose a startup failure.

The demo is a smoke check, not the domain design. Before implementing the first real feature, [discover the business timeline](../cratis-modeling-discover-timeline/SKILL.md) with someone who can decide what should happen.
