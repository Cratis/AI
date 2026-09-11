---
applyTo: ".cratis/ai/**,.github/**,.claude/**,.agents/**,.pi/**,AGENTS.md,README.md"
paths:
  - ".cratis/ai/**"
  - ".github/**"
  - ".claude/**"
  - ".agents/**"
  - ".pi/**"
  - "AGENTS.md"
  - "README.md"
---

# Managing repository-local AI rules and instructions

> **Scope:** `.cratis/ai/` is the source for the legacy and repository-local adapters in
> this repository. It is not a package root and is never propagated wholesale.
> Canonical public skills live under `skills/`, canonical maintainer skills live
> under `engineering/`, and profile releases follow
> [`Documentation/ai-distribution-and-subscriptions.md`](../../Documentation/ai-distribution-and-subscriptions.md).

Within this repository, `.cratis/ai/` remains the **single source of truth** for rules,
agents, prompts, legacy skills, and hooks surfaced through local adapters:
folder symlinks, per-file symlinks, or small **path-reference files** whose body
is the relative path to the canonical source.

> **Edit canonical local sources, not adapter targets.** When root `AGENTS.md` or a tool file is a symlink/path-reference adapter, change its canonical source. A regular repository-owned bootstrap or private overlay may be maintained deliberately; do not replace it with the shared corpus. Never hand-edit generated `.pi/agents/` or immutable distribution output. Hand-authored `.pi/extensions/` remain source code, not adapters; see [Pi](#pi--pi) below.

## Folder structure

```
.cratis/ai/                             ← canonical source of truth (edit here)
├── rules/                       ← instruction/rule markdown files
├── agents/                      ← agent definition files
├── prompts/                     ← reusable prompt templates
├── skills/                      ← multi-step skill workflows
├── hooks/                       ← agent lifecycle hooks
└── workflows/                   ← shared CI workflow files

.github/                         ← GitHub Copilot adapters (do NOT edit)
├── copilot-instructions.md      ← path-reference → ../.cratis/ai/rules/general.md
├── instructions/               ← folder symlink → ../.cratis/ai/rules   (rules maintained in one place; see Copilot suffix caveat below)
├── agents/
│   └── <name>.agent.md          ← per-file symlink → ../../.cratis/ai/agents/<name>.md   (Copilot needs the .agent.md suffix)
├── prompts/                     ← folder symlink → ../.cratis/ai/prompts                (Copilot reads *.prompt.md)
└── skills/                      ← folder symlink → ../.cratis/ai/skills

.claude/                         ← Claude Code adapters (do NOT edit)
├── CLAUDE.md                    ← symlink → ../.cratis/ai/rules/general.md
├── rules/
│   └── <name>.md                ← per-file symlink → ../../.cratis/ai/rules/<name>.md
├── agents/                      ← folder symlink → ../.cratis/ai/agents                 (Claude reads <name>.md)
├── commands/
│   └── <name>.md                ← per-file symlink → ../../.cratis/ai/prompts/<name>.prompt.md   (Claude slash commands)
└── skills/                      ← folder symlink → ../.cratis/ai/skills
                                    (hooks: Claude wires them in .claude/settings.json — no folder adapter)

.agents/                         ← Codex adapters (do NOT edit)
└── skills/                      ← folder symlink → ../.cratis/ai/skills

.pi/                             ← Pi surface (adapters + repository-owned extensions)
├── agents/
│   └── <name>.md                ← per-file symlink → ../../.cratis/ai/agents/<name>.md   (do NOT edit)
├── prompts/
│   └── <name>.md                ← per-file symlink → ../../.cratis/ai/prompts/<name>.prompt.md   (do NOT edit)
└── extensions/                  ← canonical source, NOT an adapter — edit here
    ├── cratis-hooks/
    └── subagent/

AGENTS.md                        ← Codex root instructions → .cratis/ai/rules/general.md
```

**Each tool has its own conventions, so adapters differ by surface** (verified against each tool's docs):

| Surface | Copilot | Claude Code | Codex | Pi |
| --- | --- | --- | --- | --- |
| Root instructions | `copilot-instructions.md` → `general.md` | `CLAUDE.md` → `general.md` | `AGENTS.md` → `general.md` | — |
| Scoped rules | `instructions/` (folder symlink → `.cratis/ai/rules`) | `rules/<n>.md` (per-file) | — | — |
| Agents | `agents/<n>.agent.md` (per-file, `.agent.md` suffix) | `agents/` (folder symlink, `<n>.md`) | — | `.pi/agents/<n>.md` (per-file) |
| Prompts / commands | `prompts/` (folder symlink, `*.prompt.md`) | `commands/<n>.md` (per-file) | — | `.pi/prompts/<n>.md` (per-file, no `.prompt` infix) |
| Skills | `skills/` (folder symlink) | `skills/` (folder symlink) | `.agents/skills/` (folder symlink) | — |
| Hooks | `.github/hooks/*.json` | `.claude/settings.json` | — | `.pi/extensions/cratis-hooks/` |

Folder symlinks (skills both sides, Copilot prompts and instructions, Claude agents) pick up additions/renames automatically. The remaining per-file adapters (Claude rules, Copilot agents, Claude commands) are needed because the tool requires a different filename suffix/location than the canonical source — so a new agent/prompt needs its matching per-file adapter created (see below). The validator (`hooks/scripts/validate-ai-setup.sh`) checks each adapter resolves to the right canonical file (symlink or path-reference file are both accepted).

**Copilot suffix caveat for `.github/instructions`.** `.github/instructions` is a folder symlink into `.cratis/ai/rules` so rules are maintained in exactly one place. The trade-off: GitHub Copilot's `applyTo` discovery expects scoped instruction files to carry the `.instructions.md` suffix, and through a folder symlink the rules are exposed as `<name>.md`. Claude Code (`.claude/rules`) and Codex still consume the rules, and the content is fully available, but Copilot will not auto-attach scoped rules by glob through the folder symlink.

> **Hooks are not folder adapters.** Markdown is not a hook format for either tool — `.cratis/ai/hooks/*.md` are *lifecycle guidance*. Enforce them per tool: Claude via `.claude/settings.json` (`Stop`, `PreToolUse`, …); Copilot via `.github/hooks/*.json` (`sessionStart`/`sessionEnd`/`userPromptSubmitted`).

## Pi generated local agent adapters

`.pi/agents/*.md` are generated **real files**, not symlinks or independent
instructions. Each adapter is rendered from this checkout's own
`.cratis/ai/agents/<name>.md`; never use another repository's canonical agent bodies.
Edit the local canonical source, then explicitly regenerate with the reviewed
`Cratis/AI` tool `tooling/pi-agent-adapters.mjs`. Do not edit generated adapters
or their `.generated.json` manifest by hand.

The generator lives in a separately available, reviewed `Cratis/AI` checkout;
it is not assumed to exist at `tooling/` in this consuming repository. Substitute
actual absolute paths in these examples:

```bash
node /absolute/path/to/Cratis-AI/tooling/pi-agent-adapters.mjs --repo /absolute/path/to/this-checkout --check
node /absolute/path/to/Cratis-AI/tooling/pi-agent-adapters.mjs --repo /absolute/path/to/this-checkout --write
```

`--check` is read-only. Use `--write` only for an explicitly authorized local
regeneration, then re-run `--check`. Missing tooling or adapter/source drift is a
blocker: do not auto-download tooling, adopt unknown outputs, discover sibling
repositories, broadcast updates, or reverse-sync local/private content.

Generated adapters set `extensions: false` and `skills: false`; explicit reads
of a required local skill remain possible, but inherited discovery is disabled.
Pi planners and coordinators return complete plans to the parent for execution;
they do not delegate, run the plan, or claim its gates passed. Existing stricter
local authority and private-effect boundaries still apply.

## Rule file format

Every rule file in `.cratis/ai/rules/` must start with a YAML frontmatter block containing at minimum an `applyTo` field (for GitHub Copilot). Add a `paths` field when the rule should also be scoped for Claude Code.

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

### Writing a recipe

A skill that walks someone through a procedure follows the section skeleton in
[`engineering-recipe-skeleton.md`](./engineering-recipe-skeleton.md) — *when you need
this*, *when you do not*, *steps*, *what breaks*, *how it is proven* — so every recipe
answers the same questions in the same order. Read it before authoring or restructuring
one.

### Profiles (application vs framework)

A Cratis repo is one of two **profiles** and the corpus serves both from this one source:

- **application** — building an app *on* Cratis (event-sourced CQRS, vertical slices, MVVM frontend). The bulk of the rules.
- **framework** — contributing to a Cratis framework repo *itself* (Arc, Chronicle, Fundamentals, Components — libraries). See `framework.md`.

A profile-specific rule declares **`profile: application`** or **`profile: framework`** in its frontmatter; a rule with **no `profile:` is universal** and applies in both. `general.md` routes by profile (its application sections are clearly bannered; `framework.md` is the framework counterpart). `applyTo`/`paths` globs scope by *file type*; `profile:` scopes by *repo type* — both are needed because every repo has `.cs`/`.tsx` files. (Reviewed distribution profiles select applicable shared capabilities; legacy local `general.md` routing and per-rule banners remain in place during canary. Do not restart propagation.)

## Adding a new rule

1. **Create the canonical file** in `.cratis/ai/rules/<name>.md` with the appropriate frontmatter and content.

2. **Copilot needs no per-rule step** — `.github/instructions` is a folder symlink into `.cratis/ai/rules`, so the new rule appears automatically (subject to the Copilot suffix caveat above).

3. **Create the Claude symlink** in `.claude/rules/`:

   ```bash
   cd .claude/rules
   ln -s ../../.cratis/ai/rules/<name>.md <name>.md
   ```

4. If the rule applies to all files globally (like `general.md`), update the top-level adapters:
   - `.github/copilot-instructions.md` → `../.cratis/ai/rules/general.md`
   - `.claude/CLAUDE.md` → `../.cratis/ai/rules/general.md`

5. **Codex needs no per-rule step** — it consumes only `AGENTS.md` (→ `general.md`) and `.agents/skills` (→ `.cratis/ai/skills`), both already wired. New skills are picked up automatically through the `.agents/skills` folder symlink.

## Updating an existing rule

Edit the canonical file in `.cratis/ai/rules/<name>.md`. **Do not touch anything in `.github/` or `.claude/`** — the symlinks automatically reflect the change.

## Updating agents, prompts, skills, or hooks

Always edit the canonical file in the relevant `.cratis/ai/` subfolder — never adapter bodies. For Pi, explicitly regenerate the local real-file adapters using the procedure above; symlink updates alone do not refresh them. Whether you need another adapter depends on the surface:

- **Skills** (`.cratis/ai/skills/<n>/SKILL.md`) — folder symlinks on all three sides pick up new/renamed skills automatically. No adapter step.
- **Agents** (`.cratis/ai/agents/<n>.md`) — Claude's `.claude/agents` folder symlink is automatic, but **Copilot needs a per-file `.agent.md` adapter**:

  ```bash
  ln -s ../../.cratis/ai/agents/<n>.md .github/agents/<n>.agent.md
  ```

  ```bash
  ln -s ../../.cratis/ai/agents/<n>.md .pi/agents/<n>.md
  ```

- **Prompts** (`.cratis/ai/prompts/<n>.prompt.md`) — Copilot's `.github/prompts` folder symlink is automatic, but **Claude and Pi each need a per-file adapter** (Pi drops the `.prompt` infix):

  ```bash
  ln -s ../../.cratis/ai/prompts/<n>.prompt.md .claude/commands/<n>.md
  ln -s ../../.cratis/ai/prompts/<n>.prompt.md .pi/prompts/<n>.md
  ```

- **Hooks** (`.cratis/ai/hooks/*.md`) — these are *guidance*, not wired hooks. To enforce, add the real artifact per tool (Claude `.claude/settings.json`; Copilot `.github/hooks/*.json`; Pi `.pi/extensions/cratis-hooks/`).

Run `hooks/scripts/validate-ai-setup.sh` after adding an agent or prompt to confirm its adapter resolves.

## Renaming a rule

1. Rename the file in `.cratis/ai/rules/`.
2. Copilot's `.github/instructions` folder symlink picks up the rename automatically. Update only the Claude per-file symlink:

   ```bash
   # In .claude/rules/ (symlink)
   rm <old-name>.md
   ln -s ../../.cratis/ai/rules/<new-name>.md <new-name>.md
   ```

3. Update any cross-references within other rule files that link to the renamed file by path.

## Adapter path conventions

An adapter's target (the symlink target, or the path-reference file's body) uses a **relative path** from the adapter's location to the canonical file:

| Adapter location | Target |
| --- | --- |
| `.github/instructions` (folder symlink) | `../.cratis/ai/rules` |
| `.claude/rules/<name>.md` | `../../.cratis/ai/rules/<name>.md` |
| `.github/agents/<name>.agent.md` | `../../.cratis/ai/agents/<name>.md` |
| `.claude/commands/<name>.md` | `../../.cratis/ai/prompts/<name>.prompt.md` |
| `.pi/agents/<name>.md` | `../../.cratis/ai/agents/<name>.md` |
| `.pi/prompts/<name>.md` | `../../.cratis/ai/prompts/<name>.prompt.md` |
| `.github/copilot-instructions.md` | `../.cratis/ai/rules/general.md` |
| `.claude/CLAUDE.md` | `../.cratis/ai/rules/general.md` |
| `AGENTS.md` (repo root, Codex) | `.cratis/ai/rules/general.md` |
| `.agents/skills`, `.github/prompts`, `.github/skills`, `.claude/agents`, `.claude/skills` (folder symlinks) | the matching `.cratis/ai/<sub>` folder |

## Distribution and adapters

Cross-repository broadcast propagation and reverse synchronization are retired.
`Cratis/AI` is the canonical merge point for shared behavior. Consuming
repositories select profiles and exact versions in project-owned subscriptions;
generated packages flow downstream through reviewed update pull requests.

An improvement discovered elsewhere is proposed upstream with its originating
repository, immutable revision, product authority, affected profiles, and
compatibility impact. After review, `Cratis/AI` releases a new immutable version.
No consuming repository publishes packages, pushes generated bytes, or writes
changes directly back into this source tree.

Local adapter symlinks and path-reference files remain an implementation detail
inside this repository. Do not materialize their targets into copied `.cratis/ai`
content.

### Pi — `.pi/`

**Decided 2026-09-07 (Cratis/AI#126): `.pi/**` is a repository-local surface and
is not propagated.** It was the one adapter surface the corpus model had never
ruled on, which left it ambiguous whether a released package should carry it.

- **`.pi/agents/` and `.pi/prompts/` are ordinary local adapters**, the same
  class as `.github/` and `.claude/`: per-file symlinks into `.cratis/ai/agents` and
  `.cratis/ai/prompts`. Pi reads a prompt as `<name>.md`, without the `.prompt` infix
  the canonical file carries, which is why these are per-file rather than folder
  symlinks. Edit the canonical file; never these.
- **`.pi/extensions/` is not an adapter.** `cratis-hooks` and `subagent` are
  repository-owned TypeScript source with no canonical file behind them, and
  `tooling/component-catalog-validation.mjs` watches the root so an unmodeled
  file there is an error. Edit them in place.
- **Nothing under `.pi/` is ever packaged.** `.pi/**` is a forbidden artifact
  path for both audiences in `tooling/harness-registry.mjs`, so no generated
  public or engineering artifact can contain one — a released Pi package is an
  ordinary versioned npm package of passive skills, and it is the *host* that
  writes `.pi/settings.json` on install. Pi being a first-class distribution
  target and this repository's `.pi/` tree being propagated are two different
  claims; only the first is true.
- **Runtime state is not corpus.** `.pi/delegate/`, `.pi/fusion/`, `.pi/tasks/`
  and `.pi/*-session-*/` are Pi's own session state: gitignored, and excluded
  from the repository inventory by `excludedRuntimePrefixes` in
  `tooling/generate-repository-inventory.mjs`.

## Shared workflows

Reusable workflow behavior is versioned and reviewed like other shared behavior;
it is not synchronized from `.cratis/ai/workflows/` into consuming repositories.
Product repositories own their workflow invocation and exact immutable workflow
reference.
