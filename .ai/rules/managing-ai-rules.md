---
applyTo: "**/*"
---

# Managing AI Rules and Instructions

`.ai/` is the **single source of truth** for all AI assistant configuration in this repository — rules, agents, prompts, skills, and hooks. Everything is written once in `.ai/` and surfaced to each AI tool through adapters: folder symlinks, per-file symlinks, or small **path-reference files** whose body is the relative path to the canonical source.

> **Never edit files under `.github/`, `.claude/`, `.agents/`, or the root `AGENTS.md` directly.** They are all adapters. Any direct edit would be lost the next time the canonical source changes, and would diverge from it.

## Folder structure

```
.ai/                             ← canonical source of truth (edit here)
├── rules/                       ← instruction/rule markdown files
├── agents/                      ← agent definition files
├── prompts/                     ← reusable prompt templates
├── skills/                      ← multi-step skill workflows
├── hooks/                       ← agent lifecycle hooks
└── workflows/                   ← shared CI workflow files

.github/                         ← GitHub Copilot integration (adapters only — do NOT edit)
├── copilot-instructions.md      ← path-reference → ../.ai/rules/general.md
├── instructions/
│   └── <name>.instructions.md   ← path-reference file (or symlink) → ../../.ai/rules/<name>.md
├── agents/                      ← symlink → ../.ai/agents
├── prompts/                     ← symlink → ../.ai/prompts
├── skills/                      ← symlink → ../.ai/skills
└── hooks/                       ← symlink → ../.ai/hooks

.claude/                         ← Claude Code integration (symlinks only — do NOT edit)
├── CLAUDE.md                    ← symlink → ../.ai/rules/general.md
├── rules/
│   └── <name>.md                ← symlinks → ../../.ai/rules/<name>.md
├── agents/                      ← symlink → ../.ai/agents
├── prompts/                     ← symlink → ../.ai/prompts
├── skills/                      ← symlink → ../.ai/skills
└── hooks/                       ← symlink → ../.ai/hooks

.agents/                         ← Codex integration (adapters only — do NOT edit)
└── skills/                      ← symlink → ../.ai/skills

AGENTS.md                        ← Codex root instructions → .ai/rules/general.md
```

Note: `agents/`, `prompts/`, `skills/`, and `hooks/` are **folder-level** symlinks — adding, renaming, or removing files inside `.ai/` is immediately visible to every tool (Codex's `.agents/skills` included). Only `rules/` uses individual per-file adapters (because GitHub Copilot requires the `.instructions.md` suffix — a rename at the adapter level). In this repo those Copilot adapters are **path-reference files** (a small file whose body is the relative target path); a symlink works too. The validator (`hooks/scripts/validate-ai-setup.sh`) accepts either form as long as it resolves to the right rule.

## Rule file format

Every rule file in `.ai/rules/` must start with a YAML frontmatter block containing at minimum an `applyTo` field (for GitHub Copilot). Add a `paths` field when the rule should also be scoped for Claude Code.

```markdown
---
applyTo: "**/*.cs"
paths:
  - "**/*.cs"
---

# Rule Title

Rule content here.
```

Use `applyTo: "**/*"` (and omit `paths`) for rules that apply to all files.

## Adding a new rule

1. **Create the canonical file** in `.ai/rules/<name>.md` with the appropriate frontmatter and content.

2. **Create the Copilot adapter** in `.github/instructions/` — a path-reference file whose body is the relative target:

   ```bash
   printf '%s' "../../.ai/rules/<name>.md" > .github/instructions/<name>.instructions.md
   ```

   (A symlink — `ln -s ../../.ai/rules/<name>.md <name>.instructions.md` — also resolves; the repo standardizes on path-reference files.)

3. **Create the Claude symlink** in `.claude/rules/`:

   ```bash
   cd .claude/rules
   ln -s ../../.ai/rules/<name>.md <name>.md
   ```

4. If the rule applies to all files globally (like `general.md`), update the top-level adapters:
   - `.github/copilot-instructions.md` → `../.ai/rules/general.md`
   - `.claude/CLAUDE.md` → `../.ai/rules/general.md`

5. **Codex needs no per-rule step** — it consumes only `AGENTS.md` (→ `general.md`) and `.agents/skills` (→ `.ai/skills`), both already wired. New skills are picked up automatically through the `.agents/skills` folder symlink.

## Updating an existing rule

Edit the canonical file in `.ai/rules/<name>.md`. **Do not touch anything in `.github/` or `.claude/`** — the symlinks automatically reflect the change.

## Updating agents, prompts, skills, or hooks

Add, edit, or remove files directly inside the relevant `.ai/` subfolder (`agents/`, `prompts/`, `skills/`, `hooks/`). The folder-level symlinks in `.github/` and `.claude/` pick up the changes automatically — no further steps needed. **Never create or edit these files inside `.github/` or `.claude/` directly.**

## Renaming a rule

1. Rename the file in `.ai/rules/`.
2. Remove the old symlinks and recreate them pointing to the new filename:

   ```bash
   # In .github/instructions/ (path-reference file)
   rm <old-name>.instructions.md
   printf '%s' "../../.ai/rules/<new-name>.md" > <new-name>.instructions.md

   # In .claude/rules/ (symlink)
   rm <old-name>.md
   ln -s ../../.ai/rules/<new-name>.md <new-name>.md
   ```

3. Update any cross-references within other rule files that link to the renamed file by path.

## Adapter path conventions

An adapter's target (the symlink target, or the path-reference file's body) uses a **relative path** from the adapter's location to the canonical file:

| Adapter location | Target |
|---|---|
| `.github/instructions/<name>.instructions.md` | `../../.ai/rules/<name>.md` |
| `.claude/rules/<name>.md` | `../../.ai/rules/<name>.md` |
| `.github/copilot-instructions.md` | `../.ai/rules/general.md` |
| `.claude/CLAUDE.md` | `../.ai/rules/general.md` |
| `AGENTS.md` (repo root, Codex) | `.ai/rules/general.md` |
| `.agents/skills` (Codex) | `../.ai/skills` |

## Propagation and adapters

The cross-repository propagation workflow reads `.github/instructions/` and `.github/copilot-instructions.md` via the GitHub API. A symlink's blob (Git mode `120000`) and a path-reference file's body both contain the raw relative target path, so a naïve copy would push that path string rather than the real rule content to target repositories. The propagation script resolves Git symlinks (mode `120000`) to the target file's content before propagating.

**Note:** the `.github/instructions/` adapters in this repo are path-reference files (mode `100644`), not symlinks. Ensuring the propagation script resolves *that* form to real content too — not just symlinks — is part of the separately-managed propagation mechanism; confirm it before relying on org-wide propagation. (The corpus content itself is independent of how propagation is wired.)

## Shared workflows

Workflow files intended to be synced to other repositories live in `.ai/workflows/`. They follow the same symlink pattern — the propagate workflow copies `.ai/workflows/` content to target repositories.
