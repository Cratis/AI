# Generated distribution repository authority state

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
