# Cratis AI corpus

This directory is the canonical source for reusable Cratis AI content:

- `rules/` — persistent engineering guidance;
- `agents/` — specialized agent definitions;
- `prompts/` — reusable commands and prompt templates;
- `skills/` — Agent Skills packages with references and assets;
- `hooks/` — optional runtime quality hooks;
- `harnesses/` — source assets that are specific to a harness;
- `manifest.json` — harness, profile, and language values offered to installers;
- `profile-catalog.json` — profile composition and skill selection.

Harness folders at the repository root are adapters into this directory. Maintain
them with `Source/Harness.Setup`; do not edit them as independent sources.
