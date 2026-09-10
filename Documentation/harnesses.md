# Agent harness guide — getting started with each one

Every agent harness type gets the same passive Cratis skills; only the install
mechanics differ. This page walks each harness with the exact commands. Running
several harnesses against the *same repository* is a separate topic:
[multiple harnesses](./scenarios/multiple-harnesses.md).

What every harness receives is identical in content: roughly fifty skills —
`SKILL.md` plus references and assets, no hooks, no executable code, no MCP
server. Skills are passive markdown; your assistant loads the matching one
from the task, or you invoke it by name.

| Harness | Install status |
| --- | --- |
| [Claude Code](#claude-code) | Installable today |
| [OpenAI Codex](#openai-codex) | Installable today |
| [GitHub Copilot](#github-copilot--vs-code) | Installable today |
| [Cursor](#cursor) | Installable today |
| [Pi via npm](#pi-via-npm) | Published package today |
| [Kiro, Junie, Gemini CLI](#pending-kiro-junie-gemini-cli) | Pending per-host review |

All marketplace installs resolve the real `skills/` directory on the
`Cratis/AI` default branch — what you install is exactly what a reviewer reads
([Cratis/AI#264](https://github.com/Cratis/AI/issues/264)).

## Claude Code

Claude Code consumes marketplace manifests natively.

1. Add the Cratis marketplace:

   ```text
   /plugin marketplace add Cratis/AI
   ```

2. Install the public plugin:

   ```text
   /plugin install cratis@cratis
   ```

3. Verify. List installed plugins and confirm `cratis` appears; then ask your
   assistant something Cratis-shaped ("add a projection for order events")
   and watch it load the matching skill.

4. Uninstall with `/plugin uninstall cratis@cratis`. Nothing is left in your
   project — skills never write into your repository.

Cratis maintainers install the maintainer bundle the same way:
`/plugin install cratis-engineering@cratis`. Grok and Junie read the same
Claude-compatible manifests.

## OpenAI Codex

Codex consumes the committed Codex marketplace manifest.

```bash
codex plugin marketplace add Cratis/AI
codex plugin install cratis@cratis
```

The plugin carries the whole public bundle. Uninstall reverses it; skills are
passive and leave no residue.

## GitHub Copilot / VS Code

GitHub Copilot consumes the committed Copilot marketplace manifest around the
portable plugin.

```bash
copilot plugin marketplace add Cratis/AI
copilot plugin install cratis@cratis
```

List and remove work the same way (`copilot plugin list`,
`copilot plugin uninstall cratis@cratis`).

## Cursor

Cursor resolves the same skills through its committed marketplace manifest
(`.cursor-plugin/marketplace.json` at the repository root) — no extra install
step beyond adding the marketplace source in Cursor's plugin settings. The
manifest carries the identical canonical skill bytes; there is no
Cursor-specific fork of the content.

## Pi via npm

Pi installs ordinary npm packages. The published package is the stable
`@cratis/ai-fundamentals` release — the whole public skills directory, the
same content the marketplace installs deliver:

```bash
# Project-scoped, installed version recorded in .pi/settings.json
pi install -l npm:@cratis/ai-fundamentals

# User-wide
pi install npm:@cratis/ai-fundamentals
```

Commit `.pi/settings.json` after review; uninstalling removes the package and
touches nothing else.

## Pending: Kiro, Junie, Gemini CLI

- **Kiro** — skills-only Agent Plugins 1.0 packaging is prepared and
  byte-identical; the manifest delivery and host review are pending.
- **Junie** — the skills-only Junie extension is prepared; host review is
  pending.
- **Gemini CLI** — an isolated install/list/remove smoke has passed, but the
  host wants a manifest at the repository root and this repository's root
  carries none, so there is no working install today.

These open per
[Cratis/AI#147](https://github.com/Cratis/AI/issues/147) and the gates listed
in [ecosystem support](./ecosystem-support-architecture-review.md).

## Status

- Installs ship as supported stable releases.
- The versioned per-profile package flow (exact pins arriving as reviewed pull
  requests) is designed but not published; today the marketplace follows the
  `Cratis/AI` default branch, and npm carries the whole-bundle
  `@cratis/ai-fundamentals`.
- Being listed in a vendor's own marketplace UI — findable by search — is a
  separate, still-pending manual submission per host
  ([Cratis/AI#147](https://github.com/Cratis/AI/issues/147)). Adding
  `Cratis/AI` as a marketplace source works now.
