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
    "failureCleanup": true,
    "autoRollback": false,
    "subscriberUpdates": false,
    "marketplaces": "manual-handoff"
  }
}
```

The filename and `version` must match. Each profile has exactly one registered
canary. Until atomic multi-package npm publication exists, one request contains
exactly one profile. Requests are append-only and version-unique.

The request may claim only automation recorded in
[`release-automation-capabilities.json`](../distribution/release-automation-capabilities.json).
The first preview cleans up unpublished draft state automatically, but it does
not claim that an immutable npm version can be rolled back, and subscriber or
marketplace automation remains disabled until its own implementation and canary
exist.

## 3. Open the release PR

The release workflow runs during pull-request validation and:

- validates the request and all catalogs;
- resolves every profile through the approval-driven materializer;
- regenerates root-native harness artifacts;
- packages deterministic release archives and the Pi npm tarball;
- verifies checksums, provenance, SBOM, locked offline portable compliance,
  and focused release specs;
- uploads short-lived PR review artifacts.

If any profile is not approved or any release artifact differs from its source
revision/digest, the PR cannot pass.

## 4. Review and merge

Review:

- exact profile and target inventory;
- product/source revisions and digests;
- package versions;
- generated host roots;
- provenance, SBOM, checksums, and the deterministic `cratis-passive-v1`
  compliance receipts for Agent Plugin, Copilot, Cursor, and Kiro roots;
- generated lifecycle instructions and the generated/static/host-tested support matrix;
- confirmation that compliance receipts grant no approval, support, promotion,
  or publication state;
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
6. enables the generated distribution index PR for merge only after npm succeeds;
7. publishes the draft GitHub release; and
8. records that subscriber updates and marketplace submissions remain disabled
   handoffs until Workflows#73 and AI#147 complete their own gates.

No developer-machine token or manual `npm publish` command is part of the
release path.

## Failure and rollback

- PR validation failure: fix the release PR; nothing was released.
- Canary failure: publication jobs do not run; the current stable release stays
  unchanged.
- Distribution failure before npm: the draft release, generated index PR, and
  branch are removed automatically.
- npm failure: the unpublished draft release and generated index PR are removed.
- Promotion failure after npm succeeds: npm is immutable and is **not** described
  as rolled back. The draft release and index PR remain for explicit recovery,
  and the failure is recorded on AI#181.
- Subscriber and marketplace delivery are disabled for this preview and cannot
  advance automatically.

Never rewrite or reuse a release request version. Correct a released defect with
a new SemVer version.
