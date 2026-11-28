---
name: cratis-stage-render-slice
description: Use when an implementer needs to invoke Stage generation and review the generated target. Not for implementing the working outcome by hand (use cratis-platform-deliver-slice).
compatibility: Requires the Cratis CLI and the toolchain named by the generated application README.
---

# Render into an owned destination

Start with the accepted handoff (`cratis-screenplay-handoff-slice` skill in `cratis/screenplay`): full source, exact revision, application name, scope and the outcomes the target must demonstrate. Render with the CLI's bundled Stage, not the standalone Screenplay compiler. Record `cratis --version` as well as `screenplay --version`. CLI 3.154.2 uses Screenplay 6.37.0 and Stage 6.4.1. For this renderer use Screenplay 6.37.0 to author new models; 7.0.0 is the standalone authoring pin, not this CLI's compiler. Matching versions does not guarantee target support. On `CLI-RENDER-004` the semantic model version is not admitted: keep the accepted model intact, use a renderer verified to admit it or implement from the handoff (`cratis-platform-deliver-slice` skill in `cratis/application`) with the owner's agreement.

1. For a new application, choose an **empty** destination separate from `model/`. Do not run `cratis new` there first: a template scaffold is not a previous Stage publication, and existing files can collide. Preview a whole-application render to include the scaffold and default Scene. Initial scoped publication adds the plain scaffold but not the default Scene.

   ```sh
   cratis render model --name Library --destination out --check
   ```

   Exit 6 means changes are pending, 0 means current. A refusal isn't an empty plan. Review the diagnostics, planned writes and removals. Don't rerun with `--force` to get past edited or colliding files. Save manual work and reconcile it with its owner first.
   If a scoped projection is refused for overwriting identity, compare the assignment with the resolved key. A simple assignment restating its event-source, event-property or literal key can be admitted; assigning a different value is not equivalent. Do not delete a correct key to get past the check.
2. [Review ownership and the planner result](references/review-render-plan.md). Get publication approval from the requesting user unless they named another owner. Then repeat the reviewed command without `--check`. For a later change to an already scaffolded destination, preview and then publish only the accepted scope with the same application identity:

   ```sh
   cratis render model --name Library --destination out --scope Library.Authors.RegisterAuthor --check
   ```

   Include any separately changed view slice explicitly. Compare the destination diff to the accepted scope, including deletions. Repeat the check against the same inputs: no pending writes should remain.
3. Map each accepted outcome to its generated implementation and a target check. Inspect diagnostics and `STAGE-NOT-RUNNABLE.md` when present. A compiled stub that throws is a gap, not delivered behavior. Record the requirement identity, missing effect, application owner and target check that remains unmet. A refused plan is not permission to remove a rule from the model.
4. Fill an authorized gap only at a supported seam: for example, implement the generated host's `ConfigureServices` partial in the application-owned `Customizations/Program.cs` to register a directory adapter. In the global namespace, add `static partial void ConfigureServices(WebApplicationBuilder builder)` inside `public partial class Program`; add the registration to the existing implementation if present. Keep the generated declaration untouched. Registering a service doesn't replace a throwing stub. If the stub has no callable extension point, stop and choose a supported model attachment or a separately owned implementation with the team. Do not add another handler for the same generated route.
5. From `out/`, build `dotnet build Library.csproj --configuration Debug` to generate client proxies, then `npm install` and `npm run build`. With the configured local Chronicle available, run the existing covering specs. Commit a case only for an uncovered consequential decision; check the visible outcome once on the running target. For Library, prove registering Aster adds the row for the addressed ID, and a blank name reports `Name is required` without adding one. Rerender in a comparison copy and repeat the tests before declaring manual work regeneration-safe. A clean diff or a passing model test alone proves neither outcome on the target.
