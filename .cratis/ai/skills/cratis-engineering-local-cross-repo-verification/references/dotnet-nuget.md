<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# .NET and NuGet

## Contents

- CPM overlay
- Source mapping
- Versions and cache
- Retire a hand-rolled feed
- Mixed-version compositions (opt-in)
- Non-CPM escape
- Restoration and drift

## CPM overlay

Execute the helper from the entry point. `pack-nuget PRODUCER STAMP TARGET...`
passes `PackageVersion` and `Version` to Release `dotnet pack`. Use the entire
changed dependency closure, not just the top-level package. Unchanged dependencies
may remain released; inspect the resulting nuspec and restore graph to distinguish
them from an accidental published fallback.

`use-nuget CONSUMER STAMP [ID...]` requires a root `Directory.Packages.props`.
Without IDs it selects every package with `<id>.<stamp>.nupkg` in the feed,
including transitive dependencies absent from the consumer props. The generated
overlay imports the consumer's real props, uses `PackageVersion Update` for IDs
already pinned there and `PackageVersion Include` for the others, and enables
`CentralPackageTransitivePinningEnabled` so the added IDs pin transitive packages.
An `Update` alone cannot add an absent ID. It does not copy or edit the props in git.

```bash
bash "$local" use-nuget "$consumer" "$stamp" Cratis.Chronicle Cratis.Chronicle.CodeAnalysis
# Source the absolute env path printed by the command.
source /absolute/session/path/env
cd "$consumer"
dotnet restore path/to/consumer.slnx
dotnet build path/to/consumer.slnx -c Release --no-restore -warnaserror
```

Transitive pinning stays as the consumer sets it; `--pin-transitive` forces it on so stamped IDs the
consumer does not pin still take effect (it can raise NU1109 floors).

The printed properties are `DirectoryPackagesPropsPath` and
`RestoreAdditionalProjectSources`. For an IDE, launch it from that shell, or pass
the printed `-p:` properties explicitly to its build. Verify restore uses the
stamp in `obj/project.assets.json`; shell environment changes do not reconfigure
an already-running IDE. A config overlay printed below must also reach IDE restore.

The `CRATIS_LOCAL_RUN` adapter applies to pack steps, not these restore/build
commands; route each heavy command separately through the host's build queue.

## Source mapping

If a tracked root NuGet config has `packageSourceMapping`, the helper prints an
additional restore command with `--configfile <session>/nuget.config`. Use it.
The generated config preserves existing entries, makes relative sources absolute,
adds a `cratis-local` source, removes exact selected-ID mappings from remote
sources, and maps those IDs exactly to the local source. Exact local matches take
precedence over wildcard patterns. Inspect the generated config and restore output
for nested/imported/unsupported configuration; do not assume this is a general
NuGet XML rewriter. An incomplete mapping or existing `cratis-local` key is refused.

## Versions and cache

Generate a fresh stamp with the helper, not `0.0.0-local`. The next-patch prerelease
must sort above the versions required transitively or NuGet may report NU1605.
A stale highest tag or dependency with a newer minimum needs investigation, not a
warning suppression. The suffix is `-local.<12-digit-UTC-minute>.g<sha7>`; the `g` prefix makes an
all-digit SHA unambiguously nonnumeric in SemVer. Dirty edits are not encoded.
Wait for a distinct UTC minute or commit before repacking changed contents.
On a major-version branch, use `bash "$local" stamp --base-version 5.0.0 "$producer"`
(also with `--train`). It accepts only a SemVer core without leading zeros,
prerelease or metadata and uses it verbatim; no patch increment is added.
An explicit base still must meet the consumer's minimum.

Prefer a private cache per consumer worktree so another checkout's cached package
cannot mask a same-version repack. The optional `use-nuget` hint uses a sibling of
the session directory, not a tracked path:

```bash
export NUGET_PACKAGES="$(git -C "$consumer" rev-parse --absolute-git-dir)/cratis-local-nuget"
dotnet restore path/to/consumer.slnx
# After restoring overlays/removing live local references, keep this export for:
bash "$local" clean "$consumer" --stamp "$stamp"
bash "$local" clean "$consumer" --stamp "$stamp" --apply
unset NUGET_PACKAGES
```

A private cache still reuses its own downloads: changed bits need a distinct stamp,
or reviewed cleanup of that stamp before repacking. It does not make same-version
repacking safe. `clean` honors the active `NUGET_PACKAGES`, touches only recognized
`-local`/`-train` version folders there, and leaves released versions alone. With
no export, it uses the shared `$HOME/.nuget/packages` cache; never clear that whole
cache. Restore local overlays and remove live manifest references before cleanup;
registered live references refuse the entire request even in dry-run.

The helper uses a folder feed, so NuGet's HTTP cache is not involved. When diagnosing
an HTTP feed instead, `dotnet restore --no-http-cache` bypasses its HTTP cache only;
it does not bypass packages already in `NUGET_PACKAGES`. Use a fresh worktree cache
or review stamp-scoped cleanup too, and preserve any required `--configfile` option.

## Retire a hand-rolled feed

Stop packing new `-local.N` versions. Restore consumers' released pins and sources,
then use helper-generated stamps and overlays for the next trial. Confirm restore
resolves the helper stamp and run `check` before committing. Inventory the old
feed separately: `clean` recognizes only its local/train grammar, not `-local.N`.
Remove old artifacts only after checking all their consumers and reviewing exact
targets; never rename old packages into a helper stamp or clear a whole shared cache.

## Mixed-version compositions (opt-in)

Use a composition when products have independent local versions. It never packs
or rebuilds producers. Write a tab-separated manifest under `.ai-work/`:

```text
# Separate fields with literal tabs.
producer	Chronicle	22.138.1-local.202610240544.gd1ad215	/absolute/worktree/Chronicle
producer	Screenplay	0.2.2-local.202610240544.g91916a3	/absolute/worktree/Screenplay
producer	Stage	0.1.18-local.202610240544.g524bdce	/absolute/worktree/Stage
package	Chronicle	Cratis.Chronicle.InProcess
package	Screenplay	Cratis.Screenplay
package	Stage	Cratis.Stage
```

Each producer needs a valid local/train stamp, an existing absolute Git worktree
root and at least one package. Paths declare provenance, not cryptographic artifact
authenticity. Package IDs have one owner, case-insensitively.
Declare the complete local dependency closure. Only blank lines and lines starting
with `#` are ignored. No npm rows or implicit merging with an active overlay.

```bash
bash "$local" verify-pack --composition .ai-work/composition.tsv --json
bash "$local" use-nuget "$consumer" --composition .ai-work/composition.tsv --pin-transitive
# Source the printed env; use the printed --configfile for consumer restore.
# Run the consumer's own restore/build/specs, then:
bash "$local" verify-assets "$consumer" --composition .ai-work/composition.tsv --json
bash "$local" restore "$consumer"
```

`verify-assets` reads every `obj/project.assets.json` under the consumer and fails
closed on any project that resolved an owned ID at another version, including stale
assets from an earlier restore. Restore every project under the consumer with the
printed config, or remove the `obj` folders of projects outside the build, before
running it.

Transitive pinning is optional. The overlay imports the consumer's CPM file and
removes/re-includes owned IDs at exact producer versions. Its generated NuGet
config gives local IDs exclusive exact source mappings, removes conflicting remote
exact mappings and preserves unrelated sources/mappings/settings. Remote wildcards
remain less specific. Always pass the printed config during restore. Consumer
files are never edited. Ambiguous or inherited-only source configuration fails
closed instead of guessing.

Validation requires Node, `unzip` and the selected .NET SDK. A scratch MSBuild task
loads its `NuGet.Versioning.dll`: `NuGetVersion.TryParse`, `VersionRange.TryParse`
and `VersionRange.Satisfies` supply native semantics, never a range approximation.
Its `NuGet.Frameworks.dll` supplies `NuGetFramework.Parse` and
`FrameworkReducer.GetNearest` for selecting the applicable dependency group.
Nuspec XML is parsed structurally, across dependency groups. For example,
`[22.136.4,23.0.0)` admits the selected Chronicle prerelease above. Missing/corrupt
packages, mismatched metadata, malformed/incompatible ranges and undeclared local
dependencies fail. Nothing is rebuilt to make a range pass.

Assets verification examines every `obj/project.assets.json` and target, checks
package versions against `libraries`, and validates dependency edges against their
resolved target. The nearest native framework group must have its owned dependencies
consumed and represented by target edges. Owned IDs must resolve at their producer's exact version. Unused
declared IDs need not appear, but at least one owned ID must be consumed. Malformed
or failed-restore assets, missing dependency nodes and undeclared local packages fail.

Activation stages the normalized manifest, props, config and env together. A shared
mutation lock and journal protect publication and registration. The next mutation
rolls back incomplete work or finishes committed work after interruption. Changed
files, unknown ownership and live locks are preserved and refused: inspect rather
than deleting a lock by age. Identical activation is a no-op; restore before changing
a composition. Incompatible legacy NuGet/npm sessions are refused with backups
untouched. Active compositions retain member artifacts against `clean`; restore
before cleaning any member. Repeated restore is safe and never edits consumer files.

Exit codes: `0` success; `1` findings; `2` invalid input, unavailable native validation
or unsafe state. Composition JSON is `{"packages":[{"id":...,"version":...,"producer":...}]}`,
with no global `stamp`. Legacy JSON and uniform-stamp commands remain unchanged.

## Non-CPM escape

The helper refuses a consumer without root CPM props. Use an untracked isolated
project/worktree copy with explicit `PackageReference` versions and restore with
`--source "$CRATIS_LOCAL_FEED/nuget"` plus the normal remote sources. Supply every
needed source because `--source` replaces configured sources. Inspect the resolved
graph. Never edit versions intended to ship merely to make local proof work.

## Restoration and drift

`restore` removes session props, generated config and env files, then runs `check`.
It cannot unset variables in the calling shell:

```bash
bash "$local" restore "$consumer"
unset DirectoryPackagesPropsPath RestoreAdditionalProjectSources
bash "$local" check "$consumer"
```

Inspect producer and consumer diffs. Workbench builds in particular can regenerate
tracked proxies. Prefer a throwaway worktree; revert only known disposable output
with `git checkout -- <generated-path>` after checking it was clean beforehand.
No blanket checkout/reset is part of this workflow.
