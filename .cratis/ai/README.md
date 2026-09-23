# Cratis AI corpus

This directory is the canonical source for reusable Cratis AI content:

- `rules/` — persistent engineering guidance;
- `agents/` — specialized agent definitions; they omit `model:` so Claude, Pi, and
  OpenCode subagents inherit the session's model instead of pinning a provider;
- `prompts/` — reusable commands and prompt templates;
- `skills/` — Agent Skills packages with references and assets;
- `hooks/` — optional runtime quality hooks;
- `harnesses/` — assets that are specific to a harness. `harnesses/opencode/agents/` is
  **generated** from `agents/` in the corpus repository (OpenCode restricts through a
  `permission:` map and has no tools allowlist, so a symlink cannot serve it); each file
  carries a generated marker — edit the canonical agent, never the generated copy;
- `manifest.json` — harness, profile, and language values offered to installers;
- `profile-catalog.json` — profile composition and skill selection.

Installed harness adapters consume this directory as managed content. Do not edit
an installed copy independently; update it through the configured Cratis AI update path.
