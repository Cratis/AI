<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Dependency map

`scripts/dependency-map.tsv` is the machine-readable producer-to-consumer map that
`closure`, `verify-pack` and `verify-assets` read. It holds no versions: read pins live
from the consumer manifests (`Directory.Packages.props`, `package.json`, `Dockerfile`).

## Rows

Tab-separated, `#` starts a comment.

| Row | Fields | Meaning |
| --- | --- | --- |
| `pack` | repo, eco, target, `ENV=VAL,...` | An ordered pack target; the optional MSBuild properties reach that pack as `-p:` arguments through `CRATIS_LOCAL_PACK_PROPERTIES`, never as exported environment variables |
| `ids` | repo, eco, comma-separated IDs | The packages `verify-pack` expects in the feed |
| `uses` | consumer, producer, eco, manifest | An edge; the manifest is the pin file, or the Yarn project directory for npm |
| `image` | repo, dockerfile, tag suffix | A producer image a consumer builds on |

`eco` is `nuget`, `npm` or `image`. For npm, `.` means the repository root; any other
manifest directory becomes `--dir` for `use-npm`, `verify-assets` and `clean`.

## Read the closure

```bash
bash "$local" closure CONSUMER=path PRODUCER=path [PRODUCER=path ...]
```

It prints, and never runs, the steps: one `stamp` over every named producer, each
producer's pack with its map environment, `verify-pack`, the consumer overlay,
`verify-assets`, `check`, `restore` and `clean`. Name producers in dependency order.
When a producer reaches the consumer through a repository you did not name, it warns
that the released version of that hop is kept. Name the hop to rebuild it, or accept
the released one and treat a binary break as a finding. Exit 2 means an unknown name,
a missing edge, the wrong order, or a missing ID map for a planned producer/ecosystem.

## Multi-hop and cycles

- **One stamp.** `stamp` over several producers takes the highest next-patch line, so
  no packed package sorts below a released pin (NU1605) and one `clean --stamp` removes
  everything. Overlay the earlier producer into the later one (`use-nuget`) before it
  packs, then `restore` it.
- **Arc and Chronicle depend on each other.** Arc's Chronicle-facing packages are
  built against a released Chronicle, and Chronicle's clients against a released Arc.
  Inspect the nuspec dependencies of the packed IDs, record them, and do not break the
  cycle. The same holds for Chronicle and Orleans.
- **Image and package pins are coupled.** A consumer that builds `FROM` a producer image
  may derive the tag from the producer's NuGet pin. Check the consumer's publish workflow
  before tagging a local image.

## Extend it

Add `pack` rows only from the producer's publish workflow on the default branch, not
a stale clone. Add `ids` for every package a consumer must resolve: a missing ID is a
silent partial overlay. Add one `uses` row per consumer manifest that pins the producer.
Run `closure` against real checkouts to prove the new rows before relying on them.

## Pack plan and verification scope

`closure` builds one `(producer, ecosystem)` plan from the downstream edges. Each planned pack
is followed by `verify-pack STAMP PRODUCER --ecosystem nuget|npm`; it never checks an ecosystem
that was not packed. A NuGet-only Stage → Arc edge therefore requires only Arc's NuGet artifacts,
not its npm tarballs. A missing artifact at the exact stamp fails; a file from an older stamp is not
accepted. Unrelated feed artifacts do not expand the dependency verification scope.

A planned ecosystem without an `ids` row cannot be verified. `closure` rejects that map before
printing executable steps, rather than succeeding vacuously or falling back to another ecosystem.
For example, the current Screenplay map has only npm IDs but Stage → Screenplay is a NuGet edge;
add the NuGet ID map from the producer's publish workflow before using that closure.

Generated `verify-assets` commands use repeatable `--producer NAME` options. They check the
planned feed artifacts first, scan only those producers' IDs in the selected ecosystem, and require
at least one consumed package from each named producer. Packages in unrelated feed artifacts
cannot mask an absent producer. Not every mapped ID needs to be consumed by every downstream.
Without `--producer`, `verify-assets` retains its feed-wide inspection behavior; without
`--ecosystem`, `verify-pack` retains its repository-wide behavior for manual full-pack runs.
