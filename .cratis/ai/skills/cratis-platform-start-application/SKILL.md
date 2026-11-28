---
name: cratis-platform-start-application
description: Use when scaffolding a new Cratis application in .NET, Kotlin, or Java. Not for checking an existing host's Chronicle connection (use cratis-platform-configure-environment).
---

# Scaffold and run a local Cratis application

This is the code-first path. If the repository has `.play` files under `model/` or the user asks for Screenplay or Stage, do not scaffold with `cratis new`. [Discover the timeline](../cratis-modeling-discover-timeline/SKILL.md) and [design the event model](../cratis-modeling-design-event-model/SKILL.md) first. For Stage generation, the initial render supplies the scaffold. If those skills are missing, select `cratis/screenplay`.

## Choose the backend

Use Cratis CLI 3.154.2 for the commands below. Start in an empty parent directory with Docker running and access to the package feeds. Compose-based recipes also need the Docker Compose plugin. `Library` is the example application name.

- Default: for .NET, use [C# with React](references/csharp.md). Choose its Aspire variant for app-host orchestration, or a Chronicle-only template when no Arc or React stack is needed.
- For a Kotlin Spring Boot backend with React, use [Kotlin](references/kotlin.md).
- For a Java Spring Boot backend with React, use [Java](references/java.md).

There is no Go, Elixir, Python, or TypeScript-only Cratis application template. For Go, Elixir, or TypeScript, create a service in that stack and use `cratis-arc-host-application` to wire and verify it. If needed, install the skill with `cratis/arc/go`, `cratis/arc/elixir`, or `cratis/arc/server-typescript`, respectively. For Python, follow that skill's TypeScript host route and call the service's authenticated HTTP endpoint from Python.

All these application templates default to MongoDB. If the project requires another Chronicle store, add `--database postgresql`, `--database mssql`, or `--database sqlite` to the scaffold command. The template version pins the scaffold, not the resolved dependencies; check generated project and package versions before applying version-specific recipes.

## After creation

1. Read the scaffold summary and work from `Library`. The examples decline script post-actions with `--allow-scripts no`, so review the frontend dependencies and scripts before installing them yourself. Declining scripts does not undo creation.
2. The scaffold writes `.cratis/ai.json`, and `cratis new` attempts the same sync as `cratis ai update`. If the sync did not run, run `cratis ai update` in `Library`; if it failed, diagnose the reported error before retrying. Use `cratis ai profiles list` to confirm the recommended profile from the recipe is available. If not, select a compatible CLI and corpus. If the generated selection differs from the recipe or uses the wrong harness, replace the placeholders below with the recipe's values and your harness (for example, `pi`):

   ```sh
   cratis ai install --profiles <profile> --harnesses <harness> --languages <languages>
   ```

   Check `cratis ai status` for the expected selection. Resolve conflicts without overwriting local edits.
3. For a Compose-based recipe, keep the generated port mappings on loopback because the development dashboard allows anonymous access. Run `docker compose up -d`. For this local self-signed endpoint only, `curl --insecure https://localhost:35000/health` should print `Healthy`. If not, check `docker compose ps` and the service logs before starting the app. For the Aspire recipe, let the app host start the containers instead.
4. Start the app using the selected recipe. For the React sample, open Vite's local URL (normally `http://localhost:9000`), choose **Demo → Register**, and enter a disposable name. It should appear in the list. If not, check that Vite reaches the backend and the backend reaches its intended store. Use the generated `SomeModule/SomeFeature/Registration/` slice as the house example: organize by module, feature, then behavior.
5. Stop foreground app processes with Ctrl+C. For Compose, run `docker compose stop` to preserve containers and their data; do not remove them to diagnose a startup failure.

The demo is a smoke check, not the domain design. Before implementing the first real feature, [discover the business timeline](../cratis-modeling-discover-timeline/SKILL.md) with someone who can decide what should happen.
