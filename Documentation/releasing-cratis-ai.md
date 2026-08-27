# Release Cratis AI

> **Passive preview owner setup is recorded; bootstrap deprecation and governed S10 remain blocked.**
Candidate review is available now. Passive previews use the basic lane; stable
support uses the sidelined governed lane and its complete S9/S10 assurance.

A merged release pull request is the recurring human release approval. Do not
run a second manual publication, promotion, or rollout approval after merge.
A passive preview can never claim `supported`; that claim requires graduation to
governed assurance.

One-time external App, registry, canary-scope, and marketplace account setup is
tracked in [AI#181](https://github.com/Cratis/AI/issues/181).

## Passive preview lane

`public-fundamentals` is the selected first preview. The public
`@cratis/ai-fundamentals` package exists, and its exact GitHub Actions trusted
publisher, OIDC permission, and protected `npm-stage` environment are configured.
Generated [`preview-readiness.json`](../distribution/preview-readiness.json) is
independent of S10. npm assigns `latest` to a package's first publication even
when another tag was requested and currently rejects removing it. Preview
requests therefore stay blocked until the inert bootstrap version carries the
required deprecation warning.

The existing Fundamentals asset workflow remains packaging-only. The separate
**Release Passive Previews** workflow validates an append-only exact request,
runs every anchored basic check, stages a public scriptless/dependency-free npm
archive, and binds publication to `npm-stage` with OIDC. It permits npm
`latest` only when it selects a stable version or the exact deprecated inert
bootstrap; every preview or other prerelease value is rejected. Merging one
reviewed request can publish that exact preview under the explicit npm `preview`
dist-tag; it cannot become `latest`, claim support, or promote itself to stable
support.

## Static candidate review before release authority

Before any profile is approved, the manual **Package Passive Candidate Assets**
workflow can build two short-lived review bundles from immutable source: one for
34 currently materializable public targets and one for 7 engineering targets.
It projects each bundle to all 34 passive harness shapes and records the four
excluded targets rather than silently dropping them.

This candidate lane accepts only `0.0.N-candidate.N`, keeps npm packages private,
marks Codex installation unavailable, and emits provenance, SBOM, compliance,
assurance, support-matrix, and checksum records. Every approval, installation,
publication, runtime, support, and promotion flag is false. It is a static
packaging and review facility; it does not satisfy any step below and cannot be
referenced as a release request or production lifecycle receipt.

## Governed support lane

The numbered flow below applies when graduating a preview to stable support or
shipping executable/MCP behavior. S10 remains blocked until its full
prerequisites are deliberately activated.

## 1. Prepare approved profile state

Every required profile, target, source-contract, security, evaluation,
artifact, runtime, lifecycle, and external-control approval must already exist
on the release PR's base. The request PR cannot introduce or weaken its own
prerequisites. The approval-driven materializer must resolve every requested
profile without blockers.

## 2. Add one immutable release request

Create `distribution/releases/v<version>.json`:

```json
{
  "schemaVersion": "1.0.0",
  "state": "release-on-merge",
  "version": "0.1.0-preview.1",
  "sourceRevision": "<reviewed-40-character-commit>",
  "preflightDigest": "<64-character-preflight-digest>",
  "artifactDigest": "<64-character-artifact-digest>",
  "prerequisiteEvidenceIds": ["<existing-prerequisite-evidence>"],
  "mergeStrategy": "merge-commit",
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

All host packages are projections of one immutable logical skill tree. Harness
registry descriptors declare every root and every projected skill location;
one harness may declare one or more roots, but every declared copy must remain
byte-identical to the canonical source. Generation writes only to a new empty
candidate, validates the complete final inventory, and removes the entire
candidate on any root failure. Deterministic generation and assurance receipts
are static-validation inputs only: they do not grant support, publication,
runtime, or promotion state. S4 adds no new host output, executable extension,
or MCP server.

## 4. Review and merge

Review:

- exact profile and target inventory;
- product/source revisions and digests;
- package versions;
- generated host roots;
- provenance, SBOM, checksums, the complete deterministic release-tree
  manifest, the artifact-assurance receipt, and the deterministic
  `cratis-passive-v1` compliance receipts for Agent Plugin, Copilot, Cursor,
  and Kiro roots;
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
