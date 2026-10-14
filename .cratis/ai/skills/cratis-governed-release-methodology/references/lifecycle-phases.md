# Install-cycle lifecycle phases

This reference holds the lifecycle phases an install-cycle claim decomposes into.

## The lifecycle phases a real install cycle must cover

When you claim a consumer can adopt and un-adopt your artifact, these are the
phases that claim decomposes into. Run them against the exact artifact a
consumer would receive.

- **collision-negative** — with the artifact absent, nothing already present
  answers to its name. This is the baseline that makes the positive result mean
  something.
- **install** — it installs from the published location, not a local path.
- **discovery** — the host actually finds and lists it afterwards.
- **behavior-positive** — it does the thing it exists to do.
- **behavior-negative** — it declines the case it must decline. An artifact that
  never says no has not been tested for judgment.
- **update** — moving from the previous version to this one succeeds.
- **rollback** — moving back to the previous exact version succeeds. This is the
  phase teams skip and the one consumers need most.
- **uninstall** — it removes cleanly.
- **project-context-preservation** — consumer-owned files it never owned are
  untouched by install, update, rollback, and uninstall. Destroying local
  configuration during an upgrade is the most expensive failure in this list.
- **cleanup** — no residue in caches, registries, or host state.

Rollback and preservation are what convert "it works" into "it is safe to try."
A release path without a proven way back is not a release path; it is a
one-way door.
