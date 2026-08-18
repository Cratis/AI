# Instructions

Instructions are the **rules and constraints** an assistant applies automatically when working with code. They answer *what* to do and *when* it applies — not *how* to do it step-by-step.

See also: [Architecture Overview](./architecture.md) · [Instructions vs Skills](./instructions-vs-skills.md)

---

## Where instructions live

Instruction files — called **rules** in the source tree — are authored in **`.ai/rules/<topic>.md`**. `.ai/` is the single source of truth; each assistant reads the same files through an adapter:

| Assistant | Adapter |
|---|---|
| GitHub Copilot | `.github/copilot-instructions.md` (the always-on root) and the `.github/instructions` folder symlink to `.ai/rules` |
| Claude Code | `.claude/CLAUDE.md` (the always-on root) and per-file adapters at `.claude/rules/<topic>.md` |
| Codex | root `AGENTS.md`, resolving to `.ai/rules/general.md` |

Never edit an adapter directly — the edit is lost the next time the source changes.

---

## How instructions load

A rule declares its scope in YAML front matter, along two independent axes.

**By file type** — `applyTo` is the glob Copilot matches; `paths` is the same scope expressed as a list for Claude. Scoped rules carry both:

```markdown
---
applyTo: "**/*.cs"
paths:
  - "**/*.cs"
---

# C# Conventions
...
```

**By repository type** — `profile` declares whether a rule belongs to an application repository, a framework repository, or both:

| `profile` value | Applies in |
|---|---|
| `application` | Repositories building an app **on** Cratis — event-sourced vertical slices, MVVM frontend |
| `framework` | Repositories building Cratis itself — Arc, Chronicle, Fundamentals, Components |
| *absent* | Universal — both profiles |

`general.md` is the always-on root and is intentionally front-matter-less; it routes by profile and everything else hangs off it.

### Glob scope examples

| `applyTo` value | Loads when working on |
|---|---|
| `"**/*"` | Every file |
| `"**/*.cs"` | Any C# file |
| `"**/*.ts,**/*.tsx"` | Any TypeScript file |
| `"**/*.tsx"` | Any React component file |
| `"**/for_*/**/*.cs, **/when_*/**/*.cs"` | C# spec files in BDD spec folders |
| `"**/Documentation/**/*.{md,mdx}"` | Documentation sources |

---

## What belongs in an instruction file

Instructions should be **concise rules** — not tutorials or step-by-step guides.

Good instruction content:

- Naming conventions and patterns to follow
- Hard constraints ("never do X", "always do Y")
- Structural rules (file layout, namespace conventions)
- Framework-specific rules that the compiler won't catch
- References to the relevant skill for detailed implementation

Does NOT belong in instructions:

- Step-by-step implementation walkthroughs
- Code templates with detailed scaffolding
- Long lists of "how to" examples
- Full API documentation

If a rule needs more than a few lines of explanation or a short code example, it belongs in a **skill** instead. The instruction states the rule and points to the skill:

```markdown
## Commands
- Commands define `Handle()` directly on the record — never separate handler classes.
- For detailed step-by-step guidance on creating a command, invoke the `cratis-command` skill.
```

Each rule should also declare its **level of authority** — a framework contract enforced by Arc, Chronicle, or an analyzer; a Cratis convention that is the house default; or product policy belonging to a downstream repository. Never claim the framework requires a convention.

---

## Tech-specific instructions

Some instructions only apply to projects that use a specific technology.

> ⚠️ **Tech-specific instructions have an explicit guard at the top of the file.**

For example, `efcore.md` starts with:

```markdown
> **⚠️ APPLIES ONLY TO PROJECTS USING ENTITY FRAMEWORK CORE**
> If your project does not reference `Microsoft.EntityFrameworkCore` or any EF Core packages, **ignore this entire file**.
```

This guard exists because instruction files load by file type (e.g. `**/*.cs`) — not by which packages the project uses. Without it, EF Core rules would appear in every C# project.

**Rule:** any instruction file that applies to a framework, library, or technology that is not universally present in all Cratis projects MUST include this guard.

Currently guarded files: `efcore.md`, `efcore.specs.md`, `orleans.md`.

---

## Instruction file inventory

Generated from `.ai/rules/` on disk. Every file there appears exactly once below.

### Always on

| File | `applyTo` | Profile | Topic |
|---|---|---|---|
| `general.md` | *(front-matter-less root)* | routes by profile | Project philosophy, layout, slice types, the rules, implementation workflow, quality gates |
| `glossary.md` | `"**/*"` | universal | One-line definitions of every load-bearing term |
| `framework.md` | `"**/*"` | framework | Contributing to a Cratis framework repository — what applies, what does not, repo shapes |
| `code-quality.md` | `"**/*"` | universal | Composition over inheritance, SRP, coupling, cohesion, the 200-line file guideline |
| `git-commits.md` | `"**/*"` | universal | Logical grouping, commit message format, staging discipline |
| `pull-requests.md` | `"**/*"` | universal | PR description sections, labels, quality gates, documentation-only PRs |
| `rtk.md` | `"**/*"` | universal | Using rtk for token-optimized commands |
| `terminal-commands.md` | `"**/*"` | universal | Prefixing commands with rtk, including inside command chains |
| `web-fetching.md` | `"**/*"` | universal | Prefer `curl` for raw remote content |
| `managing-ai-rules.md` | `".ai/**,.github/**,.claude/**,.agents/**,AGENTS.md,README.md"` | universal | Adding, updating, and renaming rules, skills, agents, prompts, and hooks |

<!-- markdownlint-disable-next-line MD020 -- "C#" ends in a hash, which MD020 misreads as a closed-ATX heading -->
### C#

| File | `applyTo` | Profile | Topic |
|---|---|---|---|
| `csharp.md` | `"**/*.cs"` | universal | Formatting, naming, records, nullable handling, exceptions, logging, DI |
| `code-quality.csharp.md` | `"**/*.cs"` | universal | C# expression of the code-quality principles |
| `concepts.md` | `"**/*.cs"` | universal | `ConceptAs<T>` and `EventSourceId<T>` strongly-typed domain values |
| `vertical-slices.md` | `"**/*.cs, **/*.tsx"` | application | Slice anatomy — commands, `Provide()`, validators, events, projections, read models, reactors, constraints |
| `reactors.md` | `"**/*.cs"` | application | Chronicle reactor conventions — side effects, idempotency, targets |
| `efcore.md` | `"**/*.cs"` ⚠️ EF Core only | application | EF Core project structure, `DbContext`, migrations |
| `orleans.md` | `"**/*.cs"` ⚠️ Orleans only | framework | Orleans grain, storage provider, and clustering conventions |

### TypeScript and React

| File | `applyTo` | Profile | Topic |
|---|---|---|---|
| `typescript.md` | `"**/*.ts,**/*.tsx"` | universal | Type safety, enums, naming, localization |
| `code-quality.typescript.md` | `"**/*.ts,**/*.tsx"` | universal | TypeScript expression of the code-quality principles |
| `react.md` | `"**/*.tsx, **/Components/**/*.ts"` | application | React with Arc, Cratis Components, and MVVM |
| `components.md` | `"**/*.tsx"` | application | Component structure, styling, icons |
| `dialogs.md` | `"**/*.tsx"` | application | The Cratis dialog wrappers — `CommandDialog` and `Dialog` |
| `frontend-quality.md` | `"**/*.{ts,tsx}"` | application | Frontend engineering quality bar |
| `storybook.md` | `"**/*.stories.tsx"` | application | Storybook story conventions |

### Specs

| File | `applyTo` | Profile | Topic |
|---|---|---|---|
| `specs.md` | `"**/for_*/**/*.*, **/when_*/**/*.*"` | universal | Spec philosophy and the `for_`/`when_` folder structure |
| `specs.csharp.md` | `"**/for_*/**/*.cs, **/when_*/**/*.cs"` | universal | The `Specification` base, `Establish`/`Because`/`should_`, NSubstitute |
| `specs.scenarios.csharp.md` | `"**/for_*/**/*.cs, **/when_*/**/*.cs"` | application | The in-process scenario family — `CommandScenario`, `EventScenario`, `ReadModelScenario`, `ReactorScenario` |
| `specs.typescript.md` | `"**/for_*/**/*.ts, **/when_*/**/*.ts"` | universal | TypeScript spec patterns — `given()`, Sinon, Chai |
| `frontend-testing.md` | `"**/for_*/**/*.{ts,tsx}"` | application | Testing the React surface of a slice |
| `efcore.specs.md` | `"**/for_*/**/*.cs, **/when_*/**/*.cs"` ⚠️ EF Core only | application | EF Core spec patterns |

### Documentation

| File | `applyTo` | Profile | Topic |
|---|---|---|---|
| `documentation.md` | `"**/Documentation/**/*.{md,mdx}"` | universal | Diátaxis classification and authoring |
| `documentation-structure-and-formatting.md` | `"**/Documentation/**/*.{md,mdx}"` | universal | How a page fits the rendered site — structure and formatting |
| `writing-cratis-docs.md` | `"**/Documentation/**/*.{md,mdx}"` | universal | Tour voice and Starlight authoring |
| `writing-correct-examples.md` | `"**/Documentation/**/*.{md,mdx}"` | universal | Verifying every framework API in an example against real source |
| `editing-cratis-docs.md` | `"**/Documentation/**/*.{md,mdx}"` | universal | Finding the real source file across the split documentation repositories |

---

## Adding a new instruction file

1. Create `<topic>.md` in **`.ai/rules/`** — never under `.github/`, `.claude/`, or `.agents/`.
2. Add front matter: `applyTo` (be as specific as possible) plus the matching `paths` list, and `profile` when the rule is not universal.
3. If the instruction is tech-specific, add the ⚠️ guard at the top.
4. Keep it focused on **what** and **when** — move detailed how-to into a skill.
5. Reference the relevant skill at the bottom of each major section if one exists.
6. Create the Claude adapter `.claude/rules/<topic>.md` pointing at `../../.ai/rules/<topic>.md`. Copilot needs nothing — `.github/instructions` is a folder symlink.
7. Add an entry to the inventory table above.
8. Add it to the "Where to Look" table in `general.md` if it is a core guide.
9. Run `.ai/hooks/scripts/validate-ai-setup.sh` — missing front matter or a missing adapter is a fatal error there.
