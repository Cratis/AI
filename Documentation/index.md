# Cratis AI Configuration — Documentation

This folder documents how the Cratis AI configuration is organized, the conventions it follows, and how its components work together.

## Contents

| Page | What it covers |
|---|---|
| [Architecture Overview](./architecture.md) | How the overall system fits together — instructions, skills, agents, prompts, and hooks |
| [Instructions](./instructions.md) | What instruction files are, when they load, and how to write focused ones |
| [Skills](./skills.md) | What skills are, how they differ from instructions, and how to create new ones |
| [Agents](./agents.md) | The team of agents, their roles, and the coordinator pattern for parallel work |
| [Instructions vs Skills](./instructions-vs-skills.md) | The clear distinction between "what/when" (instructions) and "how" (skills) |

## Quick orientation

The Cratis AI configuration is a **shared, reusable package** that provides GitHub Copilot with structured knowledge for developing Cratis-based projects. It consists of five types of artifacts:

- **Instructions** (`.instructions.md`) — rules and constraints loaded automatically based on file context
- **Skills** (`SKILL.md`) — detailed step-by-step implementation guides invoked on demand
- **Agents** (`.md` in `agents/`) — specialist personas with defined roles and tools
- **Prompts** (`.prompt.md`) — quick-invoke slash commands for single-turn tasks
- **Hooks** (`.md` in `hooks/`) — lifecycle callbacks (pre-commit, agent-stop)

See [Architecture Overview](./architecture.md) for the full picture.
