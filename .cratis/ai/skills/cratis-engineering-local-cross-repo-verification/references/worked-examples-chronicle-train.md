<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Worked examples: Arc → Chronicle and Fundamentals → Arc → Chronicle

Throwaway detached worktrees of each repository at its default branch; one stamp for the whole run.
Set `local` to the helper, `T` to the stamp, and source the consumer's `cratis-local/env` for
`dotnet` commands.

## Arc → Chronicle (NuGet and Workbench npm)

```bash
bash "$local" closure Chronicle=$chronicle Arc=$arc
stamp=$(bash "$local" stamp "$arc")
# Arc: yarn install, then the embedded viewer (npm ci, typecheck, build in Source/DotNET/Screenplay.Embedded)
export CRATIS_LOCAL_PACK_PROPERTIES=CratisSpecsTargetFramework=net10.0
(cd "$arc" && bash "$local" pack-nuget . "$stamp" Arc.slnx && yarn build && bash "$local" pack-npm . "$stamp")
bash "$local" verify-pack "$stamp" Arc
bash "$local" use-nuget "$chronicle" "$stamp"; bash "$local" use-npm "$chronicle" "$stamp" --dir Source/Workbench
```

Gates: Chronicle `dotnet build` in Release with `DisableProxyGenerator=true` and `DisableDockerBuild=true`, the
non-integration specs; Workbench `yarn install` then `yarn ci` with `NODE_OPTIONS=--max-old-space-size=4096`.

- Pass: Release build clean; every spec assembly passes; `verify-assets` shows the stamp for every Arc ID; the Workbench
  copies of the Arc packages are at the stamp.
- Result when the consumer's other pins lag: the build passes, but the specs fail with
  `MissingMethodException` on a Fundamentals method the newer Arc calls. The consumer pins an older
  Fundamentals than the producer was built against. Record it and re-run as the three-repository
  chain below; do not edit the consumer's pins.
- Pitfall: the Arc embedded viewer must be built before the .NET build, or the Arc build fails.
- Pitfall: Chronicle resolves Arc packages to the stamp only where its manifests pin them; a released
  package that depends on a released Arc package keeps that version (needs `--pin-transitive`, which can
  raise NU1109 floors; prefer recording it).
- Pitfall: the Workbench is its own Yarn project with its own lockfile. `restore` refuses to put back a
  changed lockfile; in a throwaway worktree check out the two manifests and remove the helper's backup folder.

## Fundamentals → Arc → Chronicle under one train stamp

```bash
stamp=$(bash "$local" stamp --train $fundamentals $arc $chronicle)   # X.Y.Z-train.g<sha7>, no minute
(cd "$fundamentals" && bash "$local" pack-nuget . "$stamp" Fundamentals.slnx)
bash "$local" use-nuget "$arc" "$stamp"                               # Arc builds against the new Fundamentals
(cd "$arc" && bash "$local" pack-nuget . "$stamp" Arc.slnx)
bash "$local" verify-pack "$stamp" Fundamentals --json                # then Arc, same stamp
bash "$local" use-nuget "$chronicle" "$stamp"                         # all upstream IDs in one overlay
```

Gates: Chronicle Release build and the non-integration specs, as above.

- Pass: every spec assembly passes (no `MissingMethodException`), which the two-repository run did not.
  A binary mismatch between layers disappears only when every layer carries the same stamp.
- The stamp is deterministic for the combined state and changes when any producer's HEAD changes (it hashes every producer's HEAD).
- Order: pack the upstream first, overlay it into the next repository, pack that, and so on; `verify-pack`
  each producer before overlaying it.
- Pitfall: `verify-pack` for a repository with npm packages reports them missing when only NuGet was packed;
  that is the scope of the run, not a failure of the NuGet legs.
- Time: each pack 15–30 minutes with queue waits; the Chronicle build and specs about 5 minutes of run time each.
