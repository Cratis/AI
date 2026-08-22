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

## Gates that remain closed

- Zero public targets or product-source contracts are approved.
- The planned public artifact remains materialization and runtime disabled.
- `@cratis/ai` ownership and npm trusted publishing are not configured.
- No production consumer canary or rollback has run.
- Publication, promotion, fleet activation, legacy retirement, and freeze
  lifting remain disabled.
