# Cratis AI repository redesign — delivery-first continuation prompt

Use this prompt from a fresh session with working directory:

`/Volumes/sourcecode/repos/cratis/AI-review-pilot`

---

Continue the Cratis/AI repository redesign autonomously using the delivery-first
course correction.

Start in:

`/Volumes/sourcecode/repos/cratis/AI-review-pilot`

Current branch:

`feat/review-pilot`

First read, in order:

1. `/Volumes/sourcecode/repos/cratis/AI/AGENTS.md`
2. `AI-REPOSITORY-REDESIGN-AUTONOMOUS-HANDOVER.md`
   - especially sections 29 and 30
3. `AI-REPOSITORY-REDESIGN-AUTONOMOUS-PLAN.md`
4. `AI-REPOSITORY-REDESIGN-AUTONOMOUS-PROMPT.md`
5. all current files under:
   - `pilots/evidence-bound-code-review/`
   - `evals/evidence-bound-code-review/`
   - `tooling/code-review-pilot-validation.mjs`
   - `tooling/specs/code-review-pilot.spec.mjs`

Inspect git status before edits. Preserve all current uncommitted work. Do not
reset, discard, rebase, or regenerate fixtures until their current bindings are
understood.

## Immediate goal

Finish and deliver the evidence-bound code-review pilot without resuming the
prior unbounded hardening loop.

Fix exactly the four included findings from Fusion validation
`validate-8c80734bbe8acea8eea98cc14417150f`:

1. Bind `envelopeId` and every receipt case identity to the external
   `evaluatedCaseId`. Reject malformed IDs and cross-case replay.
2. Tighten finding evidence:
   - require `startLine <= endLine`;
   - require exact scoped `afterArtifactRef` and `afterSha256`;
   - require evidence path equality and changed-range containment;
   - require finding dimension to be reviewed;
   - require an allowed `claimBasis` and exact bound authority where needed.
3. Add real integration fixtures and exact oracles for:
   - valid `EMPTY` scope -> `SKIPPED / EMPTY_REVIEWABLE_SCOPE`;
   - a nonempty verification receipt bound to case, repository, revision, diff,
     scope, and dimensions.
4. Make malformed nested envelopes and expected results fully crash-safe. Guard
   artifacts, files, ranges, limitations, findings, dimensions, review binding,
   receipts, and all post-error semantic processing.

Regenerate all affected envelope, case, manifest, and contract-lock digests.
Add focused mutations for each exact defect.

## Bounded review rule

After those four fixes:

- run the focused review-pilot specs;
- run all repository specs;
- run catalog, stable inventory, syntax, LSP, structural, Markdown, and diff
  gates;
- run exactly one final Fusion validation.

Fix only a concrete included finding that proves a critical/high violation of an
explicit review-pilot acceptance criterion. Record minor/speculative residual
risk and deliver. Do not enter another recursive parser-hardening cycle.

Then update the canonical handover/plan, commit logically, regenerate and commit
the post-commit inventory digest, push, open a `no-release` PR linked to AI#126,
wait for green CI, merge normally, update AI#126 and Workflows#68, and remove the
branch/worktree.

## Next delivery after review pilot

Implement one minimal repository-only domain-expert/event-modeling pilot PR:
closed contract, smallest useful clean-room corpus, validator, focused specs,
zero model runs, one bounded review, green CI. Do not over-harden it.

Immediately afterward move to user-visible distribution work:

1. Verify current authoritative packaging and marketplace requirements.
2. Define the canonical-to-marketplace artifact matrix.
3. Scaffold the bot-owned generated distribution repository when repository and
   credential authority exists; otherwise write the exact authority request and
   continue deterministic local staging.
4. Generate idiomatic marketplace-native adapters/wrappers from approved
   canonical sources.
5. Add pack, install, smoke, uninstall, provenance, and checksum checks.
6. Add canary and rollback workflows.
7. Keep publication and legacy retirement disabled until explicit gates pass.

Do not seek or synthesize product-source authority. That remains blocked on
first-party source contracts, immutable revisions, owners, and security/privacy/
originality approval.

Do not touch or stage the dirty main-worktree protected files:

- `.ai/hooks/agent-stop.md`
- `.ai/hooks/pre-commit.md`
- `.ai/hooks/scripts/validate-ai-setup.sh`
- `.gitignore`
- `Documentation/index.md`

Continue without routine questions. Persist progress frequently, but prioritize
release/distribution artifacts over additional general-purpose validators.
