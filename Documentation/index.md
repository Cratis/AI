# Cratis AI Configuration — Documentation

This folder documents how the Cratis AI configuration is organized, the conventions it follows, and how its components work together.

## Contents

| Page | What it covers |
|---|---|
| [Architecture Overview](./architecture.md) | How the overall system fits together — instructions, skills, agents, prompts, and hooks |
| [Instructions](./instructions.md) | What instruction files are, how they scope by file type and repository profile, and the full inventory |
| [Skills](./skills.md) | What skills are, how they differ from instructions, the full inventory, and how to create new ones |
| [Agents](./agents.md) | The roster of agents, their roles, and the coordinator pattern for parallel work |
| [Using the Orchestrator](./orchestrator.md) | How to use the orchestrator to coordinate multiple agents as a team |
| [Instructions vs Skills](./instructions-vs-skills.md) | The distinction between "what/when" (instructions) and "how" (skills) |
| [Cratis Software Factory](./Factory/index.md) | Product decision, architecture, CLI boundary, security model, and staged investment gates |
| [Cratis Planner](./Planner/index.md) | The event-sourced application that manages issues and schedules agents — how it works, how to run it, and how to configure it |

## Quick orientation

The Cratis AI configuration is a **shared, reusable corpus of structured knowledge** for developing Cratis-based projects. It is written once and served to every assistant a Cratis repository uses — **GitHub Copilot**, **Claude Code**, and **Codex** — so all three follow the same rules from the same source.

`.ai/` is that source of truth. Each assistant reaches it through adapters — folder symlinks or per-file references under `.github/`, `.claude/`, and `.agents/`. Adapters are generated plumbing: authoring happens only in `.ai/`.

The corpus consists of five kinds of artifact:

- **Instructions** (`.ai/rules/*.md`) — rules and constraints applied automatically, scoped by file type (`applyTo`/`paths`) and by repository type (`profile`)
- **Skills** (`.ai/skills/<name>/SKILL.md`) — detailed step-by-step implementation guides invoked on demand
- **Agents** (`.ai/agents/*.md`) — specialist personas with defined roles and tools
- **Prompts** (`.ai/prompts/*.prompt.md`) — quick-invoke commands for single-turn tasks
- **Hooks** (`.ai/hooks/*.md`, `.ai/hooks/scripts/`) — lifecycle guidance and the setup validator

### Two repository profiles

The same corpus serves two kinds of repository, and identifying which one you are in decides which rules apply:

- **Application profile** — building an application *on* Cratis: event-sourced CQRS with Chronicle and Arc, vertical slices, a React frontend.
- **Framework profile** — contributing to a Cratis framework repository *itself* (Arc, Chronicle, Fundamentals, Components). These are libraries; the application architecture rules do not apply.

Rules without a `profile` are universal and apply in both.

### Validating a setup

Run `.ai/hooks/scripts/validate-ai-setup.sh` after changing rules, skills, agents, prompts, or adapters. It checks front matter, adapter integrity, and content-drift guards. Structural failures block; drift guards warn.

See [Architecture Overview](./architecture.md) for the full picture.
