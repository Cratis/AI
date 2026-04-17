---
applyTo: "**/*"
---

# Managing AI Rules and Instructions

`.ai/rules/` is the **single source of truth** for all AI assistant rules in this repository. Rules are written once in `.ai/rules/` and then surfaced to each AI tool. When asked to add, rename, or update a rule, always work in `.ai/rules/` first.

> **Important**: `.github/instructions/` and `.github/copilot-instructions.md` must contain **real file copies**, not symlinks. The cross-repository propagation workflow reads these files via the GitHub API, which returns the raw symlink path string rather than the resolved content. Symlinks would result in target repositories receiving path strings as their AI instructions.
>
> `.claude/` files use symlinks because the Claude code agent reads them from disk where the OS resolves symlinks automatically.

## Folder structure

```
.ai/
├── rules/          ← canonical rule files (real files, not symlinks)
├── workflows/      ← shared GitHub Actions workflow files
├── prompts/        ← reusable prompt templates
└── agents/         ← agent definitions

.github/
├── copilot-instructions.md   ← real file copy of .ai/rules/general.md
└── instructions/
    └── <name>.instructions.md  ← real file copies of .ai/rules/<name>.md

.claude/
├── CLAUDE.md                 ← symlink → ../.ai/rules/general.md
└── rules/
    └── <name>.md             ← symlinks → ../../.ai/rules/<name>.md
```

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

2. **Copy to `.github/instructions/`** — do not use a symlink, copy the actual file content:

   ```bash
   cp .ai/rules/<name>.md .github/instructions/<name>.instructions.md
   ```

3. **Create the Claude symlink** in `.claude/rules/`:

   ```bash
   cd .claude/rules
   ln -s ../../.ai/rules/<name>.md <name>.md
   ```

4. If the rule applies to all files globally (like `general.md`), update the top-level files:
   - Copy `.ai/rules/general.md` content to `.github/copilot-instructions.md` (real file)
   - Update the `.claude/CLAUDE.md` symlink: `ln -sf ../.ai/rules/general.md .claude/CLAUDE.md`

## Updating an existing rule

1. Edit the canonical file in `.ai/rules/<name>.md`.
2. Copy the updated content to `.github/instructions/<name>.instructions.md`:

   ```bash
   cp .ai/rules/<name>.md .github/instructions/<name>.instructions.md
   ```

The `.claude/rules/` symlinks automatically reflect the change in step 1 — no further action needed there.

## Renaming a rule

1. Rename the file in `.ai/rules/`.
2. Update the `.github/instructions/` copy:

   ```bash
   rm .github/instructions/<old-name>.instructions.md
   cp .ai/rules/<new-name>.md .github/instructions/<new-name>.instructions.md
   ```

3. Update the `.claude/rules/` symlink:

   ```bash
   # In .claude/rules/
   rm <old-name>.md
   ln -s ../../.ai/rules/<new-name>.md <new-name>.md
   ```

4. Update any cross-references within other rule files that link to the renamed file by path.

## Path conventions

| Location | Type | Source |
|---|---|---|
| `.github/instructions/<name>.instructions.md` | Real file copy | `.ai/rules/<name>.md` |
| `.github/copilot-instructions.md` | Real file copy | `.ai/rules/general.md` |
| `.claude/rules/<name>.md` | Symlink | `../../.ai/rules/<name>.md` |
| `.claude/CLAUDE.md` | Symlink | `../.ai/rules/general.md` |

## Shared workflows

Workflow files intended to be synced to other repositories live in `.ai/workflows/`. They follow the same symlink pattern — the propagate workflow copies `.ai/workflows/` content to target repositories.
