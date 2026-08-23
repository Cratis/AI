# Instructions

Instructions are the **rules and constraints** that Copilot automatically applies when working with code. They answer *what* to do and *when* it applies — not *how* to do it step-by-step.

See also: [Architecture Overview](./architecture.md) · [Instructions vs Skills](./instructions-vs-skills.md)

---

## How instructions load

Instruction files use a front-matter `applyTo` field to declare which files they apply to:

```markdown
---
applyTo: "**/*.cs"
---

# C# Conventions
...
```

When Copilot works on a file, it automatically loads every instruction file whose `applyTo` glob matches the current file path. The global `copilot-instructions.md` always loads.

### Glob scope examples

| `applyTo` value | Loads when working on |
| --- | --- |
| `"**/*"` | Every file |
| `"**/*.cs"` | Any C# file |
| `"**/*.ts,**/*.tsx"` | Any TypeScript file |
| `"**/Features/**/*.*"` | Files inside any `Features/` folder |
| `"**/for_*/**/*.cs"` | C# spec files in BDD spec folders |

---

## What belongs in an instruction file

Instructions should be **concise rules** — not tutorials or step-by-step guides.

✅ Good instruction content:

- Naming conventions and patterns to follow
- Hard constraints ("never do X", "always do Y")
- Structural rules (file layout, namespace conventions)
- Framework-specific rules that the compiler won't catch
- References to the relevant skill for detailed implementation

❌ Does NOT belong in instructions:

- Step-by-step implementation walkthroughs
- Code templates with detailed scaffolding
- Long lists of "how to" examples
- Full API documentation

If a rule needs more than a few lines of explanation or a short code example, it belongs in a **skill** instead. The instruction should state the rule and point to the skill:

```markdown
## Commands
- Commands define `Handle()` directly on the record — never separate handler classes.
- For detailed step-by-step guidance on creating a command, invoke the `cratis-command` skill.
```

---

## Tech-specific instructions

Some instructions only apply to projects that use a specific technology:

> ⚠️ **Tech-specific instructions have an explicit guard at the top of the file.**

For example, `efcore.instructions.md` starts with:

```markdown
> **⚠️ APPLIES ONLY TO PROJECTS USING ENTITY FRAMEWORK CORE**
> If your project does not reference `Microsoft.EntityFrameworkCore`, ignore this file.
```

This guard exists because instruction files are loaded based on file type (e.g. `**/*.cs`) — not based on which packages the project uses. Without the guard, EF Core rules would appear in every C# project, even those that don't use EF Core.

**Rule:** Any instruction file that applies to a specific framework, library, or technology that is not universally present in all Cratis projects MUST include this guard at the top.

Currently guarded files:

- `efcore.instructions.md` — Entity Framework Core
- `efcore.specs.instructions.md` — Entity Framework Core specs
- `orleans.instructions.md` — Microsoft Orleans

---

## Instruction file inventory

| File | `applyTo` | Topic |
| --- | --- | --- |
| `copilot-instructions.md` | `"**/*"` (global) | Project philosophy, general rules, development workflow |
| `csharp.instructions.md` | `"**/*.cs"` | C# formatting, naming, code style, XML docs |
| `typescript.instructions.md` | `"**/*.ts,**/*.tsx"` | TypeScript type safety, enums, naming, localization |
| `components.instructions.md` | `"**/*.tsx"` | React component structure, styling, icons |
| `dialogs.instructions.md` | `"**/*.tsx"` | Cratis dialog wrappers (`CommandDialog`, `Dialog`) |
| `concepts.instructions.md` | `"**/*.cs"` | `ConceptAs<T>` strongly-typed domain values |
| `vertical-slices.instructions.md` | `"**/Features/**/*.*"` | Slice folder structure, file layout, proxy generation |
| `reactors.instructions.md` | `"**/*.cs"` | Chronicle reactor conventions |
| `specs.instructions.md` | `"**/for_*/**/*.*,**/when_*/**/*.*"` | BDD spec philosophy and folder structure |
| `specs.csharp.instructions.md` | `"**/for_*/**/*.cs,**/when_*/**/*.cs"` | C# BDD spec patterns (xUnit, NSubstitute) |
| `specs.typescript.instructions.md` | `"**/for_*/**/*.ts,**/when_*/**/*.ts"` | TypeScript BDD spec patterns (Vitest, Chai) |
| `documentation.instructions.md` | `"Documentation/**/*.md"` | Diátaxis documentation conventions |
| `efcore.instructions.md` | `"**/*.cs"` ⚠️ EF Core only | EF Core project structure, DbContext, migrations |
| `efcore.specs.instructions.md` | `"**/for_*/**/*.cs,**/when_*/**/*.cs"` ⚠️ EF Core only | EF Core spec patterns |
| `orleans.instructions.md` | `"**/*.cs"` ⚠️ Orleans only | Orleans grain, storage provider, clustering conventions |
| `pull-requests.instructions.md` | `"**/*"` | PR description and label conventions |
| `git-commits.instructions.md` | `"**/*"` | Commit message format and staging discipline |
| `rtk.instructions.md` | `"**/*"` | Using rtk for token-optimized commands |
| `web-fetching.instructions.md` | `"**/*"` | Prefer `curl` for raw remote content |

---

## Adding a new instruction file

1. Create `<topic>.instructions.md` in `.github/instructions/`.
2. Add the front-matter `applyTo` glob — be as specific as possible.
3. If the instruction is tech-specific, add the ⚠️ guard at the top.
4. Keep it focused on **what** and **when** — move detailed how-to into a skill.
5. Reference the relevant skill at the bottom of each major section if one exists.
6. Add an entry to the inventory table above.
7. Add it to the "Detailed Guides" list in `copilot-instructions.md` if it's a core guide.
