# Scenario: Cratis maintainer

You contribute to Cratis' own repositories (Chronicle, Arc, Fundamentals,
Components, …) rather than building an application on them.

## What you do

1. Install the maintainer plugin from the same marketplace — for Claude Code:

   ```text
   /plugin marketplace add Cratis/AI
   /plugin install cratis-engineering@cratis
   ```

   Other hosts follow the same pattern (see the
   [harness guide](../harnesses.md)). The `cratis-engineering` plugin carries
   the general engineering skills: C# house conventions, the decision-record
   procedure, the effect-boundary failure contract, and shared documentation
   authoring guidance.

2. Start your agent from the repository root so it reads that repository's
   `AGENTS.md` and its own local rules first. Cratis repositories carry their
   own repository-local skills for product-specific contributor guidance —
   for example the Chronicle repository carries its kernel-tracing procedure
   locally, because that guidance only makes sense inside Chronicle.

3. Keep private overlays local. Confidential or repository-specific behavior
   lives in the product repository (`.agents/skills/`, `.cratis/PROJECT.md`),
   never in the shared profile.

## What you get

- The general Cratis engineering conventions in every harness you use.
- A clean upstream path: generalize and remove private facts before proposing
  a change to `Cratis/AI`; improvements flow one way through issues or pull
  requests, and generated folders are never synchronized bidirectionally.

## When you don't need this

If you only build applications *on* Cratis, you want the public `cratis`
plugin, not this one. The single `cratis/engineering` profile replaced the
former per-product `engineering-*` profiles: product-specific contributor
guidance now belongs to the owning product repository.

## Status

- The single `cratis/engineering` profile is the one maintainer-audience
  subscription. Its package (`@cratis/ai-engineering`) is not published yet;
  today the maintainer skills arrive via the marketplace plugin that follows
  the `Cratis/AI` default branch.
- See [adopting Cratis AI for maintainers](../adopting-cratis-ai-for-maintainers.md)
  for the full maintainer workflow, and
  [maintaining shared AI behavior](../maintaining-shared-ai-behavior.md) for
  the governance model.
