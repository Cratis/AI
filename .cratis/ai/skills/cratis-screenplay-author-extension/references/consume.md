# Consume an extension package

Declare the system in the model using the approved package name and version. For example:

```play
system Payments
  extension "cratis/stripe" version 2
```

From the model workspace, run `cratis extension restore` to resolve a newly added reference and populate the digest-keyed cache. Review `screenplay.lock` (including the artifact digest and contract hash) and commit it with the reference. The compiler consumes the restored contract for that lock, not the latest release in the range; a resolved contract alone does not prove a compatible backend loaded.

Use `cratis extension restore --locked` in CI; it never writes the lock. To prepare for offline restore, run `cratis extension vendor ./vendor` on a trusted setup, then `cratis extension restore --locked --source ./vendor` on the offline setup. The vendor folder contains the pinned packages and signatures; the cache is the local restored store, not the reviewable lock.

A changed digest or contract, altered or unallowed publisher, or bad signature is a refusal. Fail the gate and report it to the owner; review a proposed package and lock diff rather than relocking or adding publisher trust to make CI pass. For package readiness, use the strict verification step in the authoring skill.
