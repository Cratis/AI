# Generated distribution repository authority state

## Superseding decision — generated distribution is retired, tracked in Cratis/AI#264

> **Everything below this section describes the retired two-repository model.**
> It is kept as the record of what was built and published, not as a description
> of how anything is distributed today. Nothing below is read by a workflow any
> more.

`Cratis/AI` is installed directly from its default branch. The four marketplace
manifests — `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`,
`.github/plugin/marketplace.json`, and `.cursor-plugin/marketplace.json` — are
committed on `main` and resolve the real `skills/` and `engineering/`
directories with no ref. They are the entire distribution surface.

There is no second repository, no release branch, no `dist/vX.Y.Z` tag
namespace, no generated tree, no checksum or provenance file to maintain, and no
mirrored verification control plane. The workflows and generators that built and
verified them are removed:

- `.github/workflows/publish.yml`;
- `.github/workflows/verify-distribution-branch.yml`;
- `.github/workflows/distribution-generated-update.yml`;
- `.github/workflows/distribution-approved-profile-release.yml`;
- `.github/workflows/release-approved-ai-profiles.yml`;
- `distribution/repository-control-plane/`;
- `tooling/generate-public-marketplace-distribution.mjs`,
  `tooling/stage-public-marketplace-repository.mjs`,
  `tooling/package-public-marketplace-submissions.mjs`, and
  `tooling/generate-marketplace-pointer-manifests.mjs`.

The `distribution` branch and its `dist/*` tag ruleset were deleted from
`Cratis/AI` on 2026-09-06.

### Why

The content being distributed is markdown — skills, rules, and agent guidance.
The machinery that grew around it treated it like a versioned software package
with supply-chain guarantees: a second repository, then a protected branch, a
staged generated tree, `SHA256SUMS`, `provenance.json`, exact-SemVer release
tags, and an approval gate with canary rollback simulations. That ceremony was
disproportionate to the content, and it was the reason installing Cratis AI
needed a runbook at all.

A marketplace manifest can name a directory in this repository directly. Claude
Code, Codex, and GitHub Copilot all resolve a plugin `source` of
`{"source": "github", "repo": "Cratis/AI", "path": "skills"}` against the
default branch, so what a host installs is exactly what a reviewer reads on
`main`.

`Cratis/AI.Distribution`'s published `v0.1.0` through `v0.3.0` tags keep
resolving and are never deleted.

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

The workflow contract that would have made further generated updates — a
repository-scoped GitHub App creating bot-authored pull requests into
`Cratis/AI.Distribution`, and the mirrored verification control plane it
installed there — is removed along with the rest of the generated-distribution
model. `Cratis/AI` holds no distribution write credential and needs none: the
marketplace manifests on `main` are ordinary reviewed files.

## Gates that remain closed

- Zero public targets or product-source contracts are approved.
- The planned public artifact remains materialization and runtime disabled.
- `@cratis/ai` ownership and npm trusted publishing are not configured.
- No production consumer canary or rollback has run.
- Publication, promotion, fleet activation, legacy retirement, and freeze
  lifting remain disabled.
