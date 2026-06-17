# Cratis AI — Shared AI Assistant Configuration

Shared AI-assistant configuration for building on the Cratis stack (Chronicle + Arc, .NET/C#, React + Cratis Components). It configures **GitHub Copilot**, **Claude Code**, and **Codex** with the same rules, agents, skills, prompts, and hooks — the "Cratis way" of building software, applied consistently across tools and repositories.

## Single source of truth

Everything is authored once under **`.ai/`** and surfaced to each tool through adapters — never edit the adapters directly.

```
.ai/                  ← canonical source of truth (edit here)
├── rules/            ← instruction/rule files (one per topic)
├── agents/           ← agent definitions
├── prompts/          ← reusable prompt templates (*.prompt.md)
├── skills/           ← multi-step skill workflows
├── hooks/            ← agent lifecycle hooks (+ hooks/scripts/ validator)
└── workflows/        ← shared CI workflow files

.github/              ← GitHub Copilot adapters  (copilot-instructions.md, instructions/*.instructions.md, agents/*.agent.md, prompts/, skills/)
.claude/              ← Claude Code adapters     (CLAUDE.md, rules/*.md, agents/, commands/*.md, skills/)
.agents/ + AGENTS.md  ← Codex adapters           (AGENTS.md → general.md; .agents/skills → .ai/skills)
```

Each tool has its own conventions, so the adapters differ by surface (rules, agents, prompts/commands, skills, hooks) — see [`.ai/rules/managing-ai-rules.md`](.ai/rules/managing-ai-rules.md) for the per-tool table. Each adapter resolves to its canonical `.ai/` file (a **symlink** or a **path-reference file** — both accepted). `.ai/rules/general.md` is the always-on root (no frontmatter); scoped rules carry `applyTo` (Copilot) and `paths` (Claude) frontmatter.

> **Do not edit anything under `.github/`, `.claude/`, `.agents/`, or root `AGENTS.md`.** They are adapters; edits are lost when the canonical source changes.

## Where to look

- **[`.ai/README.md`](.ai/README.md)** — the authority model, adapter conventions, profiles, and validation (the maintained overview).
- **[`.ai/rules/managing-ai-rules.md`](.ai/rules/managing-ai-rules.md)** — how to add, update, rename, or remove rules/skills/agents/prompts/hooks.
- **[`.ai/rules/general.md`](.ai/rules/general.md)** — the project operating manual; its "Where to Look" table indexes every rule.
- Browse `.ai/rules/`, `.ai/skills/`, `.ai/agents/`, and `.ai/prompts/` directly for the current set — these folders are the inventory (no table here to drift out of date).

## Validation

After changing rules/skills/adapters, run the content-aware validator:

```bash
.ai/hooks/scripts/validate-ai-setup.sh
```

It checks frontmatter, adapter integrity (symlink *or* path-reference resolving to the right rule), resolving adapter targets, the Codex adapters, and content-drift guards. Structural/adapter/Codex failures are fatal; drift guards are advisory warnings.

## Recommended VS Code settings

Add to `.vscode/settings.json` or user settings:

```jsonc
{
    // Load instruction files during code generation
    "github.copilot.chat.codeGeneration.useInstructionFiles": true,
    // Record AI contributions in git commits
    "git.addAICoAuthor": "chatAndAgent",
    // Safer agent-driven terminal operations
    "chat.tools.terminal.sandbox.enabled": true,
    // Let agents verify frontend changes in-browser (enable when working on React)
    "workbench.browser.enableChatTools": true,
    // Reduce chat clutter during multi-step builds
    "chat.tools.terminal.simpleCollapsible": true,
    // Notify when the agent needs confirmation
    "chat.notifyWindowOnConfirmation": "always"
}
```

## Propagation

This repo is the hub that can propagate `.ai/` content to other Cratis repositories. The propagation workflow is managed separately from the corpus content — see `.ai/rules/managing-ai-rules.md` for how it interacts with adapters.
