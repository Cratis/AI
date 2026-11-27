---
name: cratis-stage-render-slice
description: Use when an implementer needs to render an accepted Screenplay slice, review generated changes or fill a target gap. Not for accepting model behavior (use cratis-screenplay-accept-model).
compatibility: Requires the Cratis CLI and the toolchain named by the generated application README.
---

# Render into an owned destination

Start with the [accepted handoff](../cratis-screenplay-handoff-slice/SKILL.md): full source, exact revision, application name, scope and the outcomes the target must demonstrate. Render with the CLI's bundled Stage, not the standalone Screenplay compiler. Record `cratis --version` as well as `screenplay --version`. CLI 3.154.2 uses Screenplay 6.37.0 and Stage 6.4.1. Its Cratis render target can refuse a model accepted by standalone Screenplay 7.0.0. On `CLI-RENDER-004`, keep the accepted model intact and hand off the unsupported version to the target owner.

1. For a new application, choose an **empty** destination. Preview a whole-application render to include the scaffold and default Scene. Initial scoped publication adds the plain scaffold but not the default Scene.

   ```sh
   cratis render model --name Library --destination out --check
   ```

   Exit 6 means changes are pending, 0 means current. A refusal isn't an empty plan. Review the diagnostics, planned writes and removals. Don't rerun with `--force` to get past edited or colliding files. Save manual work and reconcile it with its owner first.
2. With approval, repeat the reviewed command without `--check`. For a later change to an already scaffolded destination, preview and then publish only the accepted scope with the same application identity:

   ```sh
   cratis render model --name Library --destination out --scope Library.Authors.RegisterAuthor --check
   ```

   Include any separately changed view slice explicitly. Compare the destination diff to the accepted scope, including deletions. Repeat the check against the same inputs: no pending writes should remain.
3. Map each accepted outcome to its generated implementation and a named target test. Inspect diagnostics and `STAGE-NOT-RUNNABLE.md` when present. A compiled stub that throws is a gap, not delivered behavior. Record the requirement identity, missing effect, application owner and failing target test. A refused plan is not permission to remove a rule from the model.
4. Fill an authorized gap only at a supported seam: for example, implement the generated host's `ConfigureServices` partial in the application-owned `Customizations/Program.cs` to register a directory adapter. In the global namespace, add `static partial void ConfigureServices(WebApplicationBuilder builder)` inside `public partial class Program`; add the registration to the existing implementation if present. Keep the generated declaration untouched. Registering a service doesn't replace a throwing stub. If the stub has no callable extension point, stop and choose a supported model attachment or a separately owned implementation with the team. Do not add another handler for the same generated route.
5. From `out/`, build `dotnet build Library.csproj --configuration Debug` to generate client proxies, then `npm install` and `npm run build`. With the configured local Chronicle available, run the affected target specs. For Library, prove registering Aster adds the row for the addressed ID, and a blank name reports `Name is required` without adding one. Rerender in a comparison copy and repeat the tests before declaring manual work regeneration-safe. A clean diff or a passing model test alone proves neither outcome on the target.
