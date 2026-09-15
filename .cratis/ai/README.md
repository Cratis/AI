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

Installed harness adapters consume this directory as managed content. Do not edit
an installed copy independently; update it through the configured Cratis AI update path.
