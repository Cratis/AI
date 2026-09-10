# Scenario: multiple harnesses

Several AI coding tools working on the same repository. This page is the
separate multi-harness topic — per-harness getting started lives in the
[harness guide](../harnesses.md).

## What you do

1. Each person installs the plugin in their own harness exactly as the
   [harness guide](../harnesses.md) describes. Claude Code, Codex, Copilot,
   and Cursor each resolve the same canonical skill bytes, so two tools never
   see different guidance.
2. Pi (and any npm-consuming host) installs the published package, with the
   installed version recorded in `.pi/settings.json`:

   ```bash
   pi install -l npm:@cratis/pi
   ```

3. The repository commits `.cratis/ai.json` as the one neutral record of
   intended scope and version — harness-neutral by construction, because it
   names profiles (`cratis/chronicle/kotlin`), not host-specific things. The
   `harnesses` array inside it simply lists which hosts this repository
   expects the skills to reach.
4. Per-host locks stay in their own settings files (`.pi/settings.json`, your
   host's plugin list). No host reads another host's lock.

## What you get

- **One guidance corpus across every tool.** All marketplaces resolve the
  same `skills/` directory on the `Cratis/AI` default branch; adapters change
  packaging and discovery, never skill content.
- **One reviewed scope.** A pull request changes `.cratis/ai.json` once, and
  every harness's humans see the same diff.
- **No cross-contamination.** Skills are passive; no harness writes into
  another harness's configuration.

## When you don't need this

If everyone on the repository uses the same single harness, this page adds
nothing — the [team repository](./team-repository.md) contract alone is
enough.

## Status

- Per-host package availability differs today: marketplace hosts follow
  `Cratis/AI` `main`; npm/Pi carries `@cratis/pi` `1.0.0`;
  Kiro, Junie, and Gemini CLI are
  pending (see the harness guide).
- The versioned flow that would pin every harness to one reviewed release is
  designed but not published yet.
