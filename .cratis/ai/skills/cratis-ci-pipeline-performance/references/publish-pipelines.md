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
- Without `queue: max`, a newer pending run replaces the single pending slot even
  when `cancel-in-progress` is `false`. Where a replaced run loses a release (each
  merge is a release), a dropped pending run is lost work: use `queue: max`.
- A workflow that deliberately aggregates triggers into one run, and documents
  that single-pending design, may keep it. Say so in a comment next to the
  `concurrency` block.
- Do not combine `queue: max` with `cancel-in-progress: true`.
- Groups are repository-scoped; this is not an organization-wide release lock.
- Check the symptom in the report: many cancelled publish runs on `closed` pull
  request events point at a replaced pending slot.

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
