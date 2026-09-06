# Generated distribution repository authority state

## Superseding decision — Phase 2 landed in code, tracked in Cratis/AI#264

> **Everything below this section still describes the lanes that still target
> this repository.** The public marketplace lane no longer does; see
> [Phase 2 execution](#phase-2-execution--landed-in-code). The lanes described
> below — the S10-blocked governed release lane, the disabled approved-profile
> activation job, and the credential-gated fixture and candidate review lane —
> are unchanged, and none of them can execute today. No gate, policy mode, or
> validator behavior is altered.

[Cratis/AI#264](https://github.com/Cratis/AI/issues/264) amends
[Cratis/AI#173](https://github.com/Cratis/AI/issues/173) so that the generated,
protected `Cratis/AI.Distribution` repository is recorded as a **delivered
milestone that is now superseded**, not as a permanent architectural fixture.

The target end state is one repository:

- `Cratis/AI` `main` is the only authoring surface;
- generated distribution is separated inside `Cratis/AI` by ref and subtree,
  written only by CI, on a protected orphan branch with immutable `dist/vX.Y.Z`
  tags;
- `Cratis/AI.Distribution` becomes a CI-published mirror so the already
  published `v0.1.0` through `v0.3.0` install commands and the evidence records
  that cite its tags keep resolving, and is then archived. The repository and its
  tags are never deleted.

The anti-drift guarantee survives the move: branch protection on the generated
branch, immutable per-release tags, and the existing root-relative,
dependency-free `verify-generated-distribution.mjs` checks give the same
generated-only, never-hand-edited property inside one repository.

### Finding that motivates it

The credential lifecycle below states that *human or deploy-key direct pushes are
not an accepted update path*. In practice, `Cratis/AI.Distribution` commits
`5d5c366`, `53c607f`, and `8f31eb0` were authored directly by a maintainer
rather than by the release bot, because the
[Cratis/Workflows#72](https://github.com/Cratis/Workflows/issues/72) App is still
not installed. The contract that justifies the second repository is being
violated in order to keep it alive.

Consolidation also removes the cross-repository GitHub App, the
`AI_DISTRIBUTION_APP_ID` and `AI_DISTRIBUTION_APP_PRIVATE_KEY` secrets, the
duplicated control plane, and one of two branch-protection surfaces.

### Phase 2 execution — landed in code

[Cratis/AI#266](https://github.com/Cratis/AI/pull/266) implements the
re-pointing for the public marketplace lane. In code, today:

- `distribution-public-marketplace.yml` reads `Cratis/AI@distribution` as the
  current generated state, runs all seven required checks against the staged
  tree, pushes that tree to `refs/heads/distribution`, creates the immutable
  `dist/vX.Y.Z` tag, re-runs the seven checks against the published branch, and
  publishes the GitHub release that now carries the asset set. It mints no
  GitHub App token and reads no `AI_DISTRIBUTION_APP_*` secret.
- `verify-distribution-branch.yml` is a live control plane inside `Cratis/AI`
  running the same seven checks against the protected branch.
- `tooling/generate-marketplace-pointer-manifests.mjs` emits the four thin
  pointer marketplace manifests for the default branch. Each resolves its plugin
  from the immutable tag, and `gemini-extension.json`, a root `plugin.json`, and
  a root `package.json` are deliberately absent so no host discovers the
  authored root `skills/` tree.

The governed S10 release lane, the disabled approved-profile activation job, and
the credential-gated fixture and candidate review lane are deliberately left on
the two-repository shape. They do not merely name a repository — they clone it,
replace its root with `rsync --delete`, and open, merge, and release against its
default branch — so a name-only re-point would aim that shape at the `Cratis/AI`
authoring surface. They stay coherent and inert until they are migrated together
with the gate that blocks them.

### What is still outstanding

Two things, and neither can be done from a pull request.

**Branch and tag protection are applied out of band by the repository admin**,
through the GitHub API, exactly like the `distribution-canary` and `npm-stage`
protected environments recorded in
[`distribution/remote-repository-state.json`](./remote-repository-state.json) —
configured by a human, not by a workflow. No workflow creates or protects the
branch. Required: the orphan `distribution` branch created in `Cratis/AI`;
protection with force-push disabled, deletion disabled, administrators included,
and no human push path; and `dist/*` tag protection so a release tag is immutable
once created. Record the observed settings in `remote-repository-state.json`
under `supersedingDecision.phase2Execution.appliedOutOfBandByRepositoryAdmin`
once they exist.

**The first real run has not happened.** Running the re-pointed
`distribution-public-marketplace.yml` once produces the first `Cratis/AI`-hosted
release and the evidence that hosts install from it. Phase 5 — archiving the
mirror — still follows after that.
[Maintainer marketplace deployment runbook](../Documentation/maintainer-marketplace-deployment-runbook.md)
records exactly what a maintainer must configure by hand.

## Initialized repository

Public repository [`Cratis/AI.Distribution`](https://github.com/Cratis/AI.Distribution)
is initialized exclusively from deterministic generated fixture bytes. Hosted
run [`32573752111`](https://github.com/Cratis/AI/actions/runs/32573752111)
created generated commit `dd58ae38a1cad0e0c82141a98be929a5a7094a0d`
and tree `472f288d88c038ad1b72ab1eb42ea384dd1c93ea` on `main`.

Repository creation is registered with Strategy through
[`Cratis/Strategy#126`](https://github.com/Cratis/Strategy/issues/126), so
Strategy can apply its own rules and skills to repository metadata, ownership,
portfolio placement, and AI setup. The current repository description is
explicitly provisional and fixture-only pending that work.

## Active protections

- `main` enforces administrators, one approving review, stale-review dismissal,
  last-push approval, and conversation resolution.
- Force-pushes and branch deletion are disabled.
- Secret scanning and push protection are enabled.
- Issues, projects, and wiki are disabled; merge commits are the only enabled PR
  merge strategy.
- Reviewed `distribution-canary` and `npm-stage` environments remain restricted
  to `main` in `Cratis/AI`.

## Credential lifecycle

A repository-scoped write deploy key initialized the empty remote after explicit
`distribution-canary` approval. Immediately afterward, the deploy key was
removed from `Cratis/AI.Distribution` and `AI_DISTRIBUTION_DEPLOY_KEY` was
deleted from `Cratis/AI` Actions secrets. No standing distribution write
credential remains.

Future generated updates need a repository-scoped GitHub App or equivalent bot
that can create pull requests and, only after separate approval, tags and
releases. Human or deploy-key direct pushes are not an accepted update path.

`Cratis/AI` contains a reviewed `distribution-generated-update.yml` workflow
contract for this path. It generates and verifies fixture bytes without
credentials, and creates a protected generated PR only when the scoped App ID and
private key from Workflows#72 are configured. Its installation token is narrowed
to contents and pull-request write access for `AI.Distribution` and is revoked at
job completion. The workflow cannot push to `main`, tag, release, publish npm, or
submit a marketplace package.

The same workflow can prepare append-only passive candidate pull requests after
the repository-scoped App is configured and the Distribution verification
control plane is present at the exact canonical bytes. Candidate PRs write only
`candidates/<artifact>/<version>`, require the destination to be absent, run the
Distribution exact-inventory check before commit, never auto-merge, and do not
grant release, installation, runtime, publication, support, or promotion.

The generated repository's exact verification workflow and dependency-free
validator are separate stable control-plane files. Their canonical source
remains in `Cratis/AI`, they are installed only through a reviewed bot-authored
pull request, and root payload replacement preserves `.github/`. Control-plane
files stay outside artifact manifests and checksums and do not become package or
authoring content.

## Gates that remain closed

- Zero public targets or product-source contracts are approved.
- The planned public artifact remains materialization and runtime disabled.
- `@cratis/ai` ownership and npm trusted publishing are not configured.
- No production consumer canary or rollback has run.
- Publication, promotion, fleet activation, legacy retirement, and freeze
  lifting remain disabled.
