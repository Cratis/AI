# Generated distribution repository authority request

## Requested repository

Create public repository `Cratis/AI.Distribution` as the bot-owned generated
projection of approved `Cratis/AI` source. Humans review generated pull requests
and releases but do not author files in that repository.

## Required authority

- Install or designate a Cratis automation identity with repository-content,
  pull-request, tag, release, and Actions permissions scoped only to the generated
  repository.
- Protect `main`; require generated-manifest, checksum, package, install, smoke,
  uninstall, and provenance checks; reject direct human and bot pushes.
- Create protected `distribution-canary` and `npm-stage` environments with named
  reviewers and no production publication permission.
- Reserve `@cratis/ai` and configure npm trusted publishing only after the public
  repository and exact workflow filename exist. Start with stage-only authority.
- Record the immutable source commit, generator revision, distribution commit,
  package digests, checksums, and review decision for every projection.

## Current blocker

Option A+ and autonomous implementation are accepted in Workflows#68, but this
worktree has no designated bot identity, generated repository, protected
environments, npm package ownership, or trusted-publisher configuration. Creating
or publishing through the maintainer's personal credentials would violate the
accepted bot-owned boundary.

Local fixture staging therefore continues deterministically. It uses only the
already authorized sanitized materializer fixture and is not an installation or
publication target.

## Gates that remain closed

Real public skills still require target approval and exact product-source
contracts. Publication, promotion, canary rollout, fleet activation, legacy
retirement, and freeze lifting remain disabled until their separate authority
and evidence gates pass.
