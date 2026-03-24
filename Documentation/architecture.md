# Architecture Overview

This page describes how all the components of the Cratis AI configuration fit together.

See also: [Instructions](./instructions.md) · [Skills](./skills.md) · [Agents](./agents.md) · [Instructions vs Skills](./instructions-vs-skills.md)

---

## Component Map

```
.github/
├── copilot-instructions.md        ← Global rules (apply to every file)
├── instructions/                  ← Scoped rules (apply by file glob)
│   ├── csharp.instructions.md
│   ├── typescript.instructions.md
│   ├── efcore.instructions.md     ← Tech-specific (EF Core projects only)
│   ├── orleans.instructions.md    ← Tech-specific (Orleans projects only)
│   └── ...
├── skills/                        ← How-to guides (invoked on demand)
│   ├── cratis-command/SKILL.md
│   ├── cratis-readmodel/SKILL.md
│   ├── add-ef-migration/SKILL.md
│   └── ...
├── agents/                        ← Specialist personas
│   ├── orchestrator.md            ← Top-level team orchestrator
│   ├── coordinator.md             ← General-purpose coordinator
│   ├── planner.md                 ← Vertical slice planner
│   ├── backend-developer.md
│   ├── frontend-developer.md
│   ├── spec-writer.md
│   ├── code-reviewer.md
│   ├── security-reviewer.md
│   └── performance-reviewer.md
├── prompts/                       ← Slash commands
│   ├── new-vertical-slice.prompt.md
│   └── ...
└── hooks/                         ← Lifecycle callbacks
    ├── pre-commit.md
    └── agent-stop.md
```

---

## How components relate

### Instructions load automatically

When Copilot opens a file, it loads:
1. `copilot-instructions.md` — always (global rules)
2. Any `.instructions.md` whose `applyTo` glob matches the current file path

This means instructions must be focused and small — they are loaded as background context for every interaction on matching files. See [Instructions](./instructions.md).

### Skills are invoked on demand

Skills are NOT loaded automatically. They are invoked when a user explicitly asks for a specific workflow ("add a command", "write specs", "add an EF migration"). Each skill provides detailed, step-by-step guidance for one specific task. See [Skills](./skills.md).

### Agents are specialist personas

Agents are invoked by name (`@backend-developer`, `@coordinator`, etc.). Each agent has a defined responsibility, a set of tools, and a completion checklist. The **Coordinator** agent decomposes cross-cutting work and delegates to specialists. See [Agents](./agents.md).

### Prompts are quick-invoke commands

Prompts surface as slash commands in the Copilot interface (e.g. `/new-vertical-slice`). They typically invoke a skill or agent with pre-filled context.

### Hooks run automatically at lifecycle events

- `pre-commit.md` — runs before a git commit
- `agent-stop.md` — runs when an agent session ends

---

## Design principles

### Instructions = what and when, Skills = how

This is the most important architectural distinction. Instructions tell Copilot *what* rules apply and *when* they matter. Skills tell it *how* to execute a specific task step-by-step.

- An instruction says: "Commands define `Handle()` directly on the record."
- A skill says: "Here is the exact sequence to follow when creating a new command from scratch."

See [Instructions vs Skills](./instructions-vs-skills.md) for a full comparison.

### Technology-specific files apply only to their technology

Instruction files for specific frameworks (EF Core, Orleans) carry an explicit guard at the top:

> ⚠️ APPLIES ONLY TO PROJECTS USING [TECHNOLOGY]

This prevents rules for EF Core from polluting pure event-sourced projects that don't use it.

### Context budget awareness

Instructions are loaded into every AI context window on matching files. This has a real cost: too many large instruction files slow responses and consume tokens that could be used for actual code. Instruction files should be focused and concise — **what** to do, not **how** to do it in detail. Move detailed implementation guidance into skills.

---

## File naming conventions

| Artifact | Naming pattern | Example |
|---|---|---|
| Global instructions | `copilot-instructions.md` | `.github/copilot-instructions.md` |
| Scoped instructions | `<topic>.instructions.md` | `csharp.instructions.md` |
| Skills | `SKILL.md` inside a named folder | `skills/cratis-command/SKILL.md` |
| Agents | `<role>.md` inside `agents/` | `agents/coordinator.md` |
| Prompts | `<task>.prompt.md` | `prompts/new-vertical-slice.prompt.md` |
| Hooks | `<lifecycle>.md` inside `hooks/` | `hooks/pre-commit.md` |
