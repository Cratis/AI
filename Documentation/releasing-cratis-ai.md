# Release Cratis AI

A merged release pull request is the recurring human release approval. Do not
run a second manual publication, promotion, or rollout approval after merge.

One-time external App, registry, canary-scope, and marketplace account setup is
tracked in [AI#181](https://github.com/Cratis/AI/issues/181).

## 1. Prepare approved profile state

The release PR includes every required profile, target, source-contract,
security, evaluation, artifact, and runtime approval. The approval-driven
materializer must resolve every requested profile without blockers.

## 2. Add one immutable release request

Create `distribution/releases/v<version>.json`:

```json
{
  "schemaVersion": "1.0.0",
  "state": "release-on-merge",
  "version": "0.1.0-preview.1",
  "profiles": ["public-fundamentals"],
  "canaries": [
    {
      "profileId": "public-fundamentals",
      "canaryId": "samples-chronicle-backend"
    }
  ],
  "automation": {
    "generatedDistribution": true,
    "githubRelease": true,
    "npmPublish": true,
    "canary": true,
    "autoPromote": true,
    "autoRollback": true,
    "subscriberUpdates": true,
    "marketplaces": "automatic-where-supported-submit-otherwise"
  }
}
```

The filename and `version` must match. Each profile has exactly one registered
canary. Requests are append-only and version-unique.

## 3. Open the release PR

The release workflow runs during pull-request validation and:

- validates the request and all catalogs;
- resolves every profile through the approval-driven materializer;
- regenerates root-native harness artifacts;
- packages deterministic release archives and the Pi npm tarball;
- verifies checksums, provenance, SBOM, and focused release specs;
- uploads short-lived PR review artifacts.

If any profile is not approved or any release artifact differs from its source
revision/digest, the PR cannot pass.

## 4. Review and merge

Review:

- exact profile and target inventory;
- product/source revisions and digests;
- package versions;
- generated host roots;
- provenance, SBOM, and checksums;
- selected canaries;
- release notes and known limitations.

Merging the release PR to `main` means **release exactly this request**.

## 5. Automatic post-merge flow

After merge, `Release Approved AI Profiles` automatically:

1. regenerates each profile from the merge commit;
2. runs the named canaries against the exact generated package;
3. stops before publication if a canary fails;
4. creates the immutable `Cratis/AI.Distribution` release branch and GitHub
   release;
5. publishes profile Pi/npm packages through trusted OIDC;
6. opens/auto-merges the generated distribution index PR when App policy allows;
7. hands the release to Workflows#73 for subscriber update pull requests;
8. updates marketplaces automatically where supported and records one-time
   manual vendor submissions under AI#147.

No developer-machine token or manual `npm publish` command is part of the
release path.

## Failure and rollback

- PR validation failure: fix the release PR; nothing was released.
- Canary failure: publication jobs do not run; the current stable release stays
  unchanged.
- Distribution/npm failure: the workflow fails visibly; do not advance
  subscriber pins.
- Subscriber failure: Workflows restores the previous exact version and leaves
  the failed repository unmerged.
- Marketplace failure: npm/GitHub release remains inspectable; the failed host
  is not marked supported.

Never rewrite or reuse a release request version. Correct a released defect with
a new SemVer version.
