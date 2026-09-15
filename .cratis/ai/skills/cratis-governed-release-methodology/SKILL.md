---
name: cratis-governed-release-methodology
description: Choose the assurance tier a release needs, gather the evidence that tier requires, label release intent by semantic-version impact, and structure a canary-before-promotion path with an explicit recovery disposition. Use when planning a release or judging whether checksums, provenance, an SBOM, or a claim of support are warranted. Do not use for product code, publish-command syntax, or release credentials.
license: MIT
---

# Governed release methodology

Release engineering is the discipline of matching **ceremony to consequence**.
Too little, and a consumer upgrades into a broken build with no way back. Too
much, and every documentation fix drags a supply-chain ritual behind it until
the ritual is performed without belief and stops meaning anything.

This skill is product-, language-, and registry-independent. It applies to a
Cratis repository publishing NuGet packages, one publishing npm packages, one
pushing container images, and one whose whole delivery is a merge to `main`. It
grants no release authority of its own: it tells you what a claim costs, not
that you may make it.

## Start with the artifact, not the process

The single most expensive mistake is applying package-release ceremony to
something that is not a package. Classify the artifact first.

| Artifact | What the consumer receives | Ceremony it earns |
| --- | --- | --- |
| Compiled package (NuGet, npm, Maven, Hex), container image, installer | Opaque bytes built on infrastructure the consumer cannot inspect | Full supply-chain receipts |
| Generated or bundled tree assembled by a pipeline | Bytes that do not exist in any reviewed source tree | Full supply-chain receipts |
| Source files a host reads directly from a git ref (rules, skills, templates) | Exactly the reviewed content at a commit | Review and versioning only |

The dividing question is **"can the consumer verify what they got against what
was reviewed, without trusting our build?"** If the host clones a git ref and
reads the files, git's own content addressing already answers that: the tree
hash *is* the checksum, the commit *is* the provenance, and the reviewed diff
*is* the artifact. Generating a checksum file for that content, publishing an
SBOM of markdown, and demanding a signed attestation before a folder may be read
adds process without adding a guarantee. Say so plainly rather than performing
it.

If the artifact is compiled or assembled, the opposite holds, and the
supply-chain receipts below are not optional decoration.

## Pick the assurance tier before you pick the checks

Three tiers, each earning strictly more claim than the one below it. Default to
the lowest tier that supports the claim you intend to make, and never let a
lower tier's evidence be reinterpreted as a higher tier's.

**Candidate review** — an internal, non-published build for review. Claim:
"this builds deterministically from an immutable source and contains nothing it
should not." Requires deterministic regeneration from an exact revision, static
contract and schema validation, secret and path scanning, and an inventory
digest. It may never be installed by a consumer or described as available.

**Preview** — a real, published, low-commitment version (a `0.x.y`, a
prerelease channel). Claim: "a consumer can install this, use it, and get back
out." Requires everything above, plus an independent human review and a real
**exact-artifact** lifecycle smoke: pack, install, discover, use, uninstall, and
roll back to a prior exact version. A preview may be withdrawn, may break, and
must never be described as supported.

**Governed support** — the claim that a consumer may depend on this. Requires
everything above, plus the full lifecycle phase set on a real host, external
control attestations, a canary against a real consumer, a recorded recovery
disposition, and a named human approval for that exact released artifact.

Graduation between tiers does not change the artifact's format. It changes
what has been observed about it. A preview that later graduates re-runs the
evidence for the exact released version; earlier observations of an earlier
build do not transfer.

## Evidence is an observation, not an intention

"Evidence" degrades into paperwork the moment it is allowed to mean "we
implemented the thing that would produce it." Hold the line with a technical
ladder where each rung names an observation someone actually made:

1. **documented** — the behavior is written down.
2. **generated** — an artifact is produced deterministically.
3. **statically validated** — schemas, contracts, and scans pass on it.
4. **install-tested** — it installs into a real host.
5. **behavior-tested** — it is discovered, does the right thing on a positive
   case, and correctly refuses a negative case.
6. **lifecycle-tested** — install, update, rollback, uninstall, and preservation
   of consumer-owned state all pass on that exact artifact.
7. **release-tested** — the *released* artifact (not a local build of the same
   commit) passed a canary.
8. **supported** — a named human approved that exact released artifact.

Two rules keep the ladder honest:

- **Synthetic evidence caps out at statically validated.** A fixture, simulator,
  or mocked host proves the pipeline, never the host. Classify every observation
  as synthetic, local, hosted, or real-consumer, and never let a synthetic
  observation satisfy an execution requirement.
- **A missing or version-mismatched host is a blocked outcome, not a skip.** If
  the canary needed host 2.1.245 and the runner had 2.1.235, the phase did not
  pass; it did not run. A skipped phase that reports green is worse than a red
  one, because it retires the question.

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

## Supply-chain receipts and what each one proves

For compiled or assembled artifacts only, and each for a distinct reason:

- **Checksums** prove the bytes a consumer downloaded are the bytes that were
  built. They defend against a corrupted or substituted download.
- **Provenance** proves *which* build, from which source revision, on which
  workflow, produced those bytes. It defends against a package that matches its
  own checksum but was built from something nobody reviewed.
- **SBOM** proves what is *inside* the artifact. It is what makes a downstream
  vulnerability answerable at all: without it, "are we affected?" requires
  re-deriving the dependency closure of a shipped binary.
- **Canary receipt** proves the released artifact worked for a real consumer.
- **Promotion receipt** proves the decision to widen the audience came after the
  canary, and records what it was based on.
- **Recovery disposition** records, before publication, exactly what can be
  undone and what cannot.
- **Support approval** is a named human accepting responsibility for that exact
  released artifact.

Each receipt is written **at the stage it describes and never backdated**. A
publication receipt cannot be a prepublication prerequisite; a promotion receipt
cannot be written before the canary it cites. If an earlier record has to be
rewritten to make a later claim true, the later claim is false.

Prefer registry-native provenance (trusted publishing / OIDC) over
hand-assembled attestations. It removes the long-lived credential, and the
consumer can verify it without trusting a file you wrote.

## Automation is not a control

The most common false claim in release engineering is that implemented
automation proves a control is configured. It does not. A workflow that *would*
publish through a protected environment says nothing about whether the
environment exists, who can approve it, or who owns the package name.

Before claiming a control, record an attestation binding: the exact subject
(repository, branch, workflow, environment, package, or publisher account), who
observed it and with what authority, when, how long the observation is good
for, where revocation would be visible, and when revocation was last checked.
An attestation without an expiry and a revocation check is a screenshot.

Controls worth attesting for a real publishing pipeline: protected default
branch with required status checks, a release-specific required status, a
protected publication environment, repository-scoped credentials, exact package
name ownership in the registry, and exact trusted-publisher registration.

## Label release intent by outward-facing effect

The version label on a pull request is not paperwork describing the change; in
a label-driven pipeline it **is the decision to ship**. Exactly one of four
labels belongs on every pull request:

- **major** — a breaking change to public API or observable behavior.
- **minor** — new capability, backward compatible.
- **patch** — a fix, or a refactor with identical observable behavior.
- **no-release** — nothing a consumer could observe by upgrading.

The test is **outward-facing effect, not file location**. A change under a
source directory that only touches tests is not shippable; a one-line change to
a shipped package's behavior is, however small. Documentation, CI workflows,
test-only changes, and local tooling carry `no-release`.

`no-release` is a decision, not an omission — leaving the label off is
indistinguishable from forgetting it, so an unlabeled pull request stays an
error. Never default to `patch` when unsure: an unnecessary release burns a
version number, ships release notes describing nothing, and buries the releases
that matter.

Two consequences worth internalizing:

- **Group related small work into one pull request.** Several small merges
  become several releases, and a stream of near-empty patch releases makes the
  release history useless to the people it is written for. The pull request is
  the release boundary; make it a coherent, describable change.
- **Folding one pull request into another means relabeling it.** When branch X
  is merged as part of Y, X auto-closes *as merged* and fires its own publish
  run under its own label. Relabel X to `no-release`; do not close it by hand,
  or its author loses the attribution.

## Structure the release path so no step can vouch for itself

The ordering below is what makes the evidence non-circular. Each step consumes
only records that already existed when it started.

1. **Prerequisites first.** Every approval, evidence record, and control
   attestation the release will cite already exists on the protected base
   branch. A release request may not introduce, weaken, or grant its own
   prerequisites.
2. **Freeze a preflight snapshot.** Bind the exact source revision, the exact
   candidate artifact digest, and the exact prerequisite set — without including
   the request that will cite it.
3. **One append-only request.** One version, one artifact, referencing the
   preflight digest. Requests are never rewritten or reused; a defect in a
   released version is corrected by a new version, never by editing the record
   of the old one.
4. **Named review, then merge.** Merging is the human approval. Keep the merge
   a true merge commit so the branch's real history survives, and bind the
   approval to the parent commit so unrelated authority changes cannot be
   batched in ahead of it.
5. **Publish, then write the publication receipt** with package identity,
   artifact digest, provenance, SBOM, and checksums.
6. **Canary the released artifact against a real consumer** — a real downstream
   repository or sample that actually depends on it, running its own build and
   tests against the published version. A canary against a fixture proves the
   pipeline; a canary against a real consumer proves the release. Publication
   jobs must stop before promotion if it fails.
7. **Promote only on canary evidence**, and record the promotion separately.
8. **Support requires its own final named approval** for that exact released
   artifact. Publication is not promotion, promotion is not support, and a
   marketplace or registry listing is none of the three.

## Write the recovery disposition before you publish

Decide and record, per stage, what failure means — while you still have the
choice.

- **Before publication**, everything is reversible: delete the draft release,
  close the index or subscriber pull request, remove the branch and tag.
- **After publication, most registries are immutable.** A published npm, NuGet,
  or Maven version cannot be un-published in any way a consumer can rely on.
  The honest recovery is roll-*forward*: publish a corrected version and move
  the moving pointer (`latest`, a floating tag) back to a known-good exact
  version. Never describe an immutable version as rolled back.
- **Automatic rollback is a capability, not an assumption.** Claim it only where
  it is implemented and canaried; otherwise record it as disabled and name the
  manual procedure.
- **Keep failed intermediate state for inspection** rather than deleting the
  evidence of the failure.

State the disposition in terms a consumer can act on: which exact version to
pin to, and what the pinned version does not have.

## Never claim a tier you have not paid for

The final discipline is linguistic. "Available", "published", "preview",
"listed", and "supported" are different claims with different costs, and the
gap between them is where trust is lost.

- Publishing a package makes it **available**, not supported.
- A marketplace submission is not a listing; a listing is not support.
- Passing static validation makes an artifact **statically validated**, not
  install-tested.
- Automation that could produce a receipt has not produced one.

When the evidence for a claim is missing, say which evidence is missing and what
the artifact *is* — not a hedged version of the claim you wanted to make.

## Verify

- The artifact is classified as compiled/assembled or as source read from a git
  ref, and the ceremony matches that classification.
- The chosen tier is the lowest one that supports the intended claim.
- Every phase result is pass, fail, or explicitly blocked — never a silent skip.
- No synthetic or fixture observation is counted as install, behavior,
  lifecycle, or canary evidence.
- Rollback to a prior exact version and preservation of consumer-owned files
  were both actually exercised.
- Checksums, provenance, and SBOM exist for compiled or assembled artifacts and
  are absent, deliberately and explainably, for git-ref source delivery.
- Every claimed external control has an attestation with subject, issuer,
  validity, and a revocation check.
- The pull request carries exactly one of `major`, `minor`, `patch`, or
  `no-release`, chosen by outward-facing effect.
- No record was rewritten or backdated to satisfy a later stage.
- A canary ran against a real consumer before promotion.
- The recovery disposition is written down and does not claim an immutable
  version can be rolled back.
- Nothing is described as supported without a named approval of that exact
  released artifact.
