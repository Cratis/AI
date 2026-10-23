<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Worked examples

## Contents

- Chronicle kernel → Studio integration specs
- Fundamentals → Arc (NuGet)
- Components → Studio frontend (npm)
- Chronicle clients → Direct (NuGet)

Run times below are rounded from one measured run on a shared machine; queue wait is not included.
Use absolute producer/consumer paths for your checkouts and the entry point's
`local` helper variable. These recipes define work to execute, not pre-verified
results. Substitute actual regression filters and CI commands; stop on a failed
step. Apply the entry point's check/restore/cleanup sequence to both repositories.


## Chronicle kernel → Studio integration specs

1. Reproduce Studio's integration bug against its released client/kernel. Record
   the regression filter and inspect Studio's CI build/test commands.
2. Generate the stamp and pack client packages plus their full dependency closure.
   A client solution filter can omit CodeAnalysis. Include its package explicitly:

   ```bash
   stamp=$(bash "$local" stamp "$producer")
   bash "$local" pack-nuget "$producer" "$stamp" path/to/client.slnf
   bash "$local" pack-nuget "$producer" "$stamp" \
     Source/Clients/DotNET.CodeAnalysis.Package/DotNET.CodeAnalysis.Package.csproj
   ```

   Create the filter in ignored scratch space with paths appropriate to that
   Chronicle checkout. Inspect the nuspec dependencies: Contracts and every other
   local dependency must exist in the feed at the same stamp. Do not proceed if a
   required package is missing simply because one pack command passed.
3. Publish the Release development kernel for the daemon's RID, build Workbench
   `wwwroot`, and build/inspect `cratis/chronicle:<stamp>-development-slim` as in
   [docker-images.md](docker-images.md). Preserve generated proxy edits.
4. Run `use-nuget` with the client IDs Studio needs. Include transitive IDs missing
   from Studio CPM explicitly. Source the printed env and use its generated NuGet
   config when source mapping requires it. Verify local assets after restore.
5. Select the image and run Studio's actual solution/spec project:

   ```bash
   export CHRONICLE_KERNEL_VERSION="$stamp"
   cd "$consumer"
   dotnet build path/to/Studio.slnx -c Release -p:StudioFullBuild=true -warnaserror
   dotnet test Source/Integrations/Specs/Specs.csproj -c Release --no-build \
     --filter '<regression>'
   ```

   Studio defaults kernel selection to the client version when the environment
   override is absent. Ensure logs show the stamped local image. Local Debug
   Studio builds skip analyzers; use `-p:StudioFullBuild=true` to match CI analyzer
   coverage. Then run all required consumer gates, not only the filtered spec.
6. If the bug remains, change Chronicle and repeat with a distinct stamp. If it
   passes, run `check` before commits/pushes, restore, unset overrides, check again,
   stop task-owned containers and review/apply stamp-scoped cleanup. Release the
   producer normally and bump Studio to released pins later; never commit local
   package versions or the local image selector.

In run time this loop takes minutes: client packs about 1–2 minutes, kernel
publish a few minutes, image build seconds with a warm cache, the Studio spec
project build about 6 minutes, and the spec class itself seconds. When the spec
fails because the local kernel refuses to start (for example a startup
requirement the consumer's container setup does not satisfy yet), that is a
real finding about the consumer, not about the overlay: read the container log
before changing the producer.

## Fundamentals → Arc (NuGet)

```bash
bash "$local" closure Arc=$arc Fundamentals=$fundamentals     # prints the steps
stamp=$(bash "$local" stamp "$fundamentals")
(cd "$fundamentals" && bash "$local" pack-nuget . "$stamp" Fundamentals.slnx)
bash "$local" verify-pack "$stamp" Fundamentals
bash "$local" use-nuget "$arc" "$stamp"
```

Gates (Arc `dotnet-build.yml`), run in this order after sourcing the printed env:
`yarn install --immutable`; in `Source/DotNET/Screenplay.Embedded`: `npm ci --workspaces=false`,
`npm run typecheck`, `npm test`, `npm run build`; `dotnet build --configuration Release
-p:CratisSpecsTargetFramework=net10.0`; then `dotnet test <project> --no-build --configuration
Release --framework net10.0` for each project that `python3 scripts/ci-test-shards.py projects
--shard specs-N` prints. Finish with `verify-assets "$arc" "$stamp"`.

- Pass: `verify-assets` shows every stamped Fundamentals ID at the stamp (88 resolutions in
  the measured run), build has 0 warnings and 0 errors, 18 spec projects run and none fail.
- Time: pack about 4 min, build about 6 min, the spec projects about 18 min.
- Pitfall: skipping the embedded viewer build makes four `Screenplay.Embedded.Specs` fail
  with a 404 for the viewer. It is the missing step, not the overlay.
- Pitfall: Arc's own `@cratis/fundamentals` npm line is out of scope for the NuGet stamp.
- Skip producer specs when the producer is unchanged `origin/main`; its CI covered that SHA.

For a JavaScript Fundamentals fix, run the producer's build and `pack-npm`, then `use-npm` in
Arc and install. Include every affected workspace tarball so no transitive copy stays released.

## Components → Studio frontend (npm)

```bash
bash "$local" closure Studio=$studio Components=$components
(cd "$components" && yarn install --immutable && yarn workspace @cratis/components run ci && yarn build)
stamp=$(bash "$local" stamp "$components")
(cd "$components" && bash "$local" pack-npm . "$stamp")
bash "$local" verify-pack "$stamp" Components
bash "$local" use-npm "$studio" "$stamp"
(cd "$studio" && yarn install)        # not --immutable: the overlay edits the lock
bash "$local" verify-assets "$studio" "$stamp" --npm
```

Gates: from `Source/<App>` run `yarn ci` for each Studio application that uses
`@cratis/components` (Core, Admin, Editor, EventModels, Viewer, ScreenMigration), `node
scripts/generate-scene-package-catalog.mjs --check`, then in Core `yarn build` and the
`initial-bundle-guard.mjs` budget check, and `yarn build-storybook` where the script exists.

- Pass: every installed `@cratis/components*` copy is at the stamp (`verify-assets --npm`),
  `yarn why` shows one resolution, and every gate above exits 0.
- Time: Components `ci` about 7 min, all-workspace build about 1 min, pack about 2 min,
  Studio install under 30 s, Studio gates about 8 min.
- Pitfall: `yarn workspace @cratis/components run ci` builds only the core package. Run
  `yarn build` at the Components root before `pack-npm`, or the adapter tarballs have no
  `dist` and Studio fails with `Failed to resolve entry for package
  "@cratis/components.primereact"`.
- Pitfall: the root `package.json` version is a placeholder, so the stamp base comes from tags.
  Resolutions bypass the prerelease ranges that npm would otherwise ignore.

## Chronicle clients → Direct (NuGet)

```bash
bash "$local" closure Direct=$direct Chronicle=$chronicle     # warns about unnamed Arc and Orleans hops
stamp=$(bash "$local" stamp "$chronicle")
(cd "$chronicle" && CRATIS_LOCAL_PACK_PROPERTIES='IsPackaging=true DisableProxyGenerator=true DisableDockerBuild=true' \
  bash "$local" pack-nuget . "$stamp" Source/Clients/Packages.slnf)
bash "$local" verify-pack "$stamp" Chronicle
bash "$local" use-nuget "$direct" "$stamp"
```

Gates (Direct `build.yml`): `dotnet build Source/Direct/Direct.csproj -c Release
-p:DisableProxyGenerator=true`, the same in Debug with `-warnaserror`, `dotnet test` of that
project with `--no-build`, and `dotnet test Source/Assurance/Assurance.csproj`. Then
`verify-assets "$direct" "$stamp"`. Image-based specs also need the producer image tag.

- Pass: `verify-pack` finds every Chronicle ID; `verify-assets` shows every stamped ID at the stamp.
- Time: pack about 5 min; the Release build about 2 min.
- Pitfall: pass pack properties as `-p:` arguments (`CRATIS_LOCAL_PACK_PROPERTIES`), never
  as environment variables. An exported `IsPackaging=true` reaches Chronicle's nested
  `dotnet run` code generator and fails with a multi-target error.
- Pitfall: a consumer whose pins lag the producer's own pins fails with NU1109 or NU1605
  (Arc, Orleans, Screenplay, MongoDB.Driver floors). That is the upgrade the consumer
  would need anyway. Record the bump list; do not edit tracked pins to get past it.
- Pitfall: `use-nuget` turns central transitive pinning on. A consumer that does not use it
  can show false NU1109 floors from build-only packages; compare against the consumer's
  own setting before trusting them.
- Pitfall: `verify-assets` can list a released package pulled in by another dependency
  (here `Cratis.Chronicle.AspNetCore`); name it in the overlay IDs or treat it as a finding.
