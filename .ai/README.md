# Repository-local AI corpus

`.ai/` is the **single source of truth inside this repository** for legacy and
repository-local rules, agents, prompts, skills, and hooks surfaced through
adapters. It is not a package root and is never propagated wholesale.
Canonical public and maintainer package sources live under `skills/` and
`engineering/`; see
[`Documentation/ai-distribution-and-subscriptions.md`](../Documentation/ai-distribution-and-subscriptions.md).

**Never edit files under `.github/`, `.claude/`, `.agents/`, or root `AGENTS.md`
directly** when they are adapters to `.ai/`; fix the local canonical source.

## Authority model

A layered hierarchy:

1. `rules/general.md` — project-wide non-negotiables and the implementation gates (the always-on root).
2. `rules/*.md` — scoped invariants (C#, slices, React, specs, docs, …).
3. `skills/*/SKILL.md` — task workflows, sequencing, examples, checklists.
4. `agents/`, `prompts/`, `hooks/` — **entrypoints that point back to canonical rules and skills, not redefine them.**

A skill may refine *how* to apply a rule, but must not contradict a non-negotiable rule. **If a skill and a rule conflict, treat it as drift: follow the stricter invariant and fix the stale artifact.**

## Three levels of authority (content)

Every rule is one of: **Framework contract** (enforced by Arc/Chronicle source/analyzers/runtime) · **Cratis convention** (house default for maintainability — the framework does not enforce it) · **Product policy** (belongs in a downstream app's own `.ai/`, not here). Rules state which they are; never claim "the framework requires" a convention.

## Local rule profiles

The local corpus distinguishes **application** and **framework** rules.
Versioned distribution uses narrower product and repository profiles from
[`distribution/profile-catalog.json`](../distribution/profile-catalog.json),
including Arc, Chronicle, Fundamentals, Components, Studio, Stagehand, clients,
documentation, and corpus work.

## Structure

- `rules/` — instruction files · `prompts/` — reusable prompts · `agents/` — agent definitions · `skills/` — multi-step workflows · `hooks/` — lifecycle hooks · `hooks/scripts/` — validation.

## Tool integration (adapters)

Each adapter resolves to its canonical `.ai/` file. It may be a **symlink** or a **path-reference file** (a small file whose body is the relative target path) — both forms are accepted; what matters is that it resolves to the right canonical file.

Each tool has its own conventions, so adapters differ by surface (see `rules/managing-ai-rules.md` for the full table):

- **GitHub Copilot** — `copilot-instructions.md` + `instructions/<n>.instructions.md` (rules); `agents/<n>.agent.md` (per-file, `.agent.md` suffix); `prompts/` + `skills/` (folder symlinks); hooks as `.github/hooks/*.json`.
- **Claude Code** — `CLAUDE.md` + `rules/<n>.md` (rules); `commands/<n>.md` (slash commands, from `.ai/prompts`); `agents/` + `skills/` (folder symlinks); hooks in `.claude/settings.json`.
- **Codex** — root `AGENTS.md` → `.ai/rules/general.md`; `.agents/skills` → `.ai/skills`.

`.ai/hooks/*.md` are **lifecycle guidance**, not wired hooks (markdown isn't a hook format for either tool); enforce them via each tool's real hook mechanism above.

## Scoped rule frontmatter

Scoped rules include both `applyTo` (Copilot matching) and `paths` (Claude matching). Use `applyTo: "**/*"` (and omit `paths`) for all-files rules. `general.md` is the frontmatter-less root.

## Validation

Run `.ai/hooks/scripts/validate-ai-setup.sh` after changing rules/skills/adapters — it validates frontmatter, adapter integrity (path-reference *or* symlink resolving to the right rule), resolving adapter targets, Codex adapters, and content-drift guards (warnings). Structural/adapter/Codex failures are fatal; drift guards are advisory warnings. Fix reported issues before committing.

## Distribution

Broad propagation and reverse synchronization are retired. Consuming
repositories select profiles and pin exact versions; improvements return through
issues or pull requests to `Cratis/AI`, then flow downstream in a new immutable
release and reviewed update pull requests.

See `rules/managing-ai-rules.md` for local adapter maintenance and the
[distribution guide](../Documentation/ai-distribution-and-subscriptions.md) for
shared package behavior.
