# Publish and release pipelines

Use this when a release, package-publish or deploy workflow queues, loses runs,
or rebuilds what a pull-request run already built and tested. Release method and
assurance tiers belong to `cratis-governed-release-methodology`.

## Concurrency for publishing

```yaml
concurrency:
  group: publish-${{ github.repository }}
  cancel-in-progress: false
  queue: max
```

- Pull-request verification cancels superseded runs. Publish never does: a
  cancelled half-publish is worse than a queued one.
- A concurrency group holds one running and, by default, one pending run; a newer
  arrival replaces the pending one. `queue: max` keeps up to 100 pending runs in
  the group and processes them in order. It is valid only while
  `cancel-in-progress` is `false` or unset; never combine it with `true`.
- Replacement only happens between runs of the same group. Decide from the group
  key whether the queue matters: a group keyed on `github.ref` for `pull_request`
  `closed` events is `refs/pull/N/merge`, one group per pull request, so two merges
  never compete and `queue: max` changes nothing. It matters when releases share a
  group: a push to the default branch, or a repository-wide key like the one above.
- A replaced pending run is lost work only when that run alone would have released
  something. Release tooling that aggregates everything since the last release
  loses nothing when a pending run is replaced; such a workflow may keep one
  pending slot, with a comment beside the `concurrency` block saying so.
- Groups are repository-scoped; this is not an organization-wide release lock.
- Check the symptom in the report: many cancelled publish runs under one group
  point at a replaced pending slot; cancelled runs spread across per-PR groups do
  not.

## Publish from the tested artifacts

A publish job that rebuilds can ship something different from what was tested,
and pays the build twice.

- Build once per publish run (per architecture where a native build differs),
  pack with `--no-build`, and publish exactly those packages and images.
- Share build output between jobs of the run as an artifact (see
  `build-once-and-shard.md`). Do not pull a pull-request run's artifact into a
  release: artifacts expire and belong to another commit.
- Build the way consumers' strictest CI builds (`Release`, analyzers on); a
  `--no-build` pack of a `Debug` build ships the wrong thing.
- When several services publish images from one build, build the image once,
  push it, and have the per-service jobs reuse it; compare the per-job pull time
  against rebuilding from the Docker cache.
- Keep a version resolved once in an early job and passed down as an output, so
  every job in the run packs the same version.

## Timeouts and permissions

- Publish and release jobs use a 60-minute `timeout-minutes` tier, per the rule.
- Grant `contents: write` or `packages: write` on the job that publishes, not on
  the workflow, and keep build jobs on `contents: read`.
- Prefer OIDC trusted publishing to a long-lived registry API key where the
  registry supports it. See `security-and-pinning.md`.

## Speed without weakening the release

- Do not skip validation on the release path to save minutes; move other work off
  it instead (docs jobs, matrices already covered by schedule).
- Canary before promotion and recovery disposition are release-method questions;
  hand them to `cratis-governed-release-methodology`.
