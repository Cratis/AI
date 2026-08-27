# S10 release and marketplace gates

**Status:** Contract implemented; release and marketplace activation blocked

## Current readiness

`catalog/v2/release-readiness.json` is generated from the S10 policy, computed
support, approvals, external-control attestations, release requests, release
records, and marketplace publications. It currently reports `BLOCKED`; every
eligibility, grant, support, and marketplace claim is false.

S10 contracts do not authorize a release. No release request or release record
exists, approval and control-attestation collections are empty, no binding has
production lifecycle or release-tested evidence, and no marketplace listing is
recorded.

## Non-circular release sequence

A future release uses separate immutable records:

1. prerequisite evidence and exact approvals already exist on protected main;
2. a deterministic preflight snapshot binds those prerequisites and candidate
   artifact without including the future request;
3. one add-only release request references the preflight digest;
4. named review and a two-parent merge commit produce an authorized-candidate
   attestation;
5. publication adds a separate receipt with package/release identity,
   provenance, SBOM, checksums, and artifact digest;
6. promotion adds a receipt only after released-artifact canaries and recovery
   checks;
7. support requires a final named approval for that exact released artifact.

No earlier record is rewritten to claim a later stage. Publication receipts are
never prepublication prerequisites. Push activation also binds `PUSH_BEFORE` to
the merge commit's first parent, preventing unrelated authority changes from
being batched before an otherwise valid request merge.

## External controls

Future attestations must bind exact repository, branch, workflow, environment,
package, or marketplace-account scope, issuer identity, evidence digest,
validity, revocation source, and revocation check. Implemented automation is not
proof that those controls are configured or authorized.

Required owner work includes protected merge-only branches, release-specific
required statuses, Distribution protection, repository-scoped App credentials,
protected environments, exact npm package ownership, exact OIDC trusted
publisher registration, and marketplace publisher/vendor accounts.

## Marketplace separation

Generated marketplace manifests and `manual-handoff` metadata are not listings.
A listing record requires exact vendor/channel, accountable publisher, artifact
digest, credential identity, legal and support metadata, submission receipt,
live listing identity, update/removal policy, and post-listing evidence.
Submission is not listing, and listing is not support.

## Workflow reachability

The release workflow may generate and upload read-only review candidates, but a
fixed `s10_preflight` job emits `release_allowed=false`. Canary, Distribution
credentials, npm OIDC publication, cleanup, promotion, and recovery jobs all
require that exact output to become true in a later reviewed activation change.
The candidate generator itself cannot accept a release-mode argument or emit a
true publication grant.

## Safe stopping point

- No request or release record exists.
- No credentialed release job is reachable.
- S9 synthetic reports remain inventory-only and non-supporting.
- `asOf` remains unchanged.
- No tag, package, GitHub release, Distribution pull request, marketplace
  submission, or publication was created.
