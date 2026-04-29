# Cratis AI — Shared AI Assistant Configuration

Shared AI assistant configuration used across all Cratis repositories and projects that build on the Cratis stack. Supports both **GitHub Copilot** and **Claude Code**. Drop the `.github/` and `.claude/` folders into any repo to get agents, skills, prompts, hooks, and coding instructions pre-configured for the Cratis way of building software.

## Repository layout

The canonical source of truth for all AI artifacts lives in `.ai/`. Both `.github/` and `.claude/` are thin shells of symlinks that point back into `.ai/` — edit files in `.ai/`, and both tools see the change automatically.

```
.ai/                             ← canonical source of truth
├── rules/                       ← instruction/rule files (one per topic)
├── agents/                      ← agent definitions
├── prompts/                     ← reusable prompt templates
├── skills/                      ← multi-step skill workflows
├── hooks/                       ← agent lifecycle hooks
└── workflows/                   ← shared CI workflow files

.github/                         ← GitHub Copilot integration (symlinks into .ai/)
├── copilot-instructions.md      ← symlink → ../.ai/rules/general.md
├── instructions/                ← symlinks → ../../.ai/rules/<name>.md
│   └── *.instructions.md        ← NOTE: Copilot requires the .instructions.md suffix
├── agents/                      ← symlink → ../.ai/agents
├── prompts/                     ← symlink → ../.ai/prompts
├── skills/                      ← symlink → ../.ai/skills
└── hooks/                       ← symlink → ../.ai/hooks

.claude/                         ← Claude Code integration (symlinks into .ai/)
├── CLAUDE.md                    ← symlink → ../.ai/rules/general.md
├── rules/                       ← symlinks → ../../.ai/rules/<name>.md
├── agents/                      ← symlink → ../.ai/agents
├── prompts/                     ← symlink → ../.ai/prompts
├── skills/                      ← symlink → ../.ai/skills
└── hooks/                       ← symlink → ../.ai/hooks
```

### A note on `.github/instructions/`

GitHub Copilot requires instruction files to carry the `.instructions.md` suffix (e.g. `csharp.instructions.md`). The files in `.github/instructions/` are individual symlinks that rename each rule file to meet this requirement — they all resolve to the corresponding `*.md` file under `.ai/rules/`. Claude Code reads rules directly from `.claude/rules/` without any suffix requirement.

## What is in `.ai/`

### `rules/`

Topic-specific instruction files, each with YAML front matter that controls when it is applied:

- `applyTo` — glob pattern for GitHub Copilot auto-attachment
- `paths` — glob pattern for Claude Code scoped rules

| File | Topic | Applied to |
|---|---|---|
| `general.md` | Project philosophy & global defaults | always |
| `csharp.md` | C# conventions | `**/*.cs` |
| `typescript.md` | TypeScript conventions | `**/*.ts`, `**/*.tsx` |
| `components.md` | React component rules | `**/*.tsx` |
| `dialogs.md` | Dialog patterns | `**/*.tsx` |
| `concepts.md` | `ConceptAs<T>` rules | `**/*.cs` |
| `vertical-slices.md` | Slice architecture | `**/Features/**/*` |
| `reactors.md` | Chronicle reactor rules | `**/*.cs` |
| `efcore.md` | Entity Framework Core | `**/*.cs` |
| `efcore.specs.md` | EF Core specs | `**/for_*/**`, `**/when_*/**` |
| `orleans.md` | Orleans grain rules | `**/*.cs` |
| `specs.md` | General spec conventions | `**/for_*/**`, `**/when_*/**` |
| `specs.csharp.md` | C# spec conventions | `**/for_*/**/*.cs` |
| `specs.typescript.md` | TypeScript spec conventions | `**/for_*/**/*.ts` |
| `documentation.md` | Diátaxis docs | `Documentation/**/*.md` |
| `pull-requests.md` | PR conventions | always |
| `git-commits.md` | Commit conventions | always |
| `code-quality.md` | General code quality | always |
| `code-quality.csharp.md` | C# code quality | `**/*.cs` |
| `code-quality.typescript.md` | TypeScript code quality | `**/*.ts`, `**/*.tsx` |

### `agents/`

Custom chat agents invokable from the agent picker:

| File | Agent | Purpose |
|---|---|---|
| `orchestrator.md` | Orchestrator | Top-level team orchestrator |
| `coordinator.md` | Coordinator | Decomposes cross-cutting work |
| `planner.md` | Vertical Slice Planner | Decomposes work into ordered tasks |
| `backend-developer.md` | Backend Developer | C# vertical slice specialist |
| `frontend-developer.md` | Frontend Developer | React/TypeScript specialist |
| `spec-writer.md` | Spec Writer | BDD spec specialist |
| `code-reviewer.md` | Code Reviewer | Quality gate |
| `security-reviewer.md` | Security Reviewer | Security gate |
| `performance-reviewer.md` | Performance Reviewer | Performance gate |

### `hooks/`

Lifecycle callbacks that fire automatically at specific points in the agent session:

| File | Event | Purpose |
|---|---|---|
| `agent-stop.md` | `agentStop` | Release build on session end |
| `pre-commit.md` | `preToolUse` | Run specs before git commit |

### `skills/`

Reusable multi-step workflows the agent invokes when it recognizes a matching request:

| Skill | Purpose |
|---|---|
| `new-vertical-slice/` | End-to-end slice creation |
| `scaffold-feature/` | New feature scaffolding |
| `add-concept/` | `ConceptAs<T>` creation |
| `add-projection/` | Chronicle projection |
| `add-reactor/` | Chronicle reactor |
| `add-business-rule/` | Command validation rules |
| `add-ef-migration/` | Hand-written EF migration |
| `review-code/` | Structured code review |
| `review-performance/` | Performance audit |
| `review-security/` | Security audit |
| `write-documentation/` | Diátaxis documentation |
| `write-specs/` | BDD spec generation |

### `prompts/`

Quick-invoke prompt templates (slash commands in Copilot, prompt files in Claude):

`new-vertical-slice`, `scaffold-feature`, `add-concept`, `add-projection`, `add-reactor`, `add-business-rule`, `add-ef-migration`, `review-pr`, `write-documentation`, `write-specs`

## How it works

- **Rules/Instructions** are attached automatically based on the file-glob patterns in their YAML front matter. When you open a `.cs` file, `csharp.md` is loaded; when you edit inside `Features/`, `vertical-slices.md` is loaded; and so on. GitHub Copilot reads these from `.github/instructions/` (where each file carries the required `.instructions.md` suffix); Claude Code reads them from `.claude/rules/`.
- **Agents** are invokable from the chat agent picker. The orchestrator and coordinator agents manage multi-step work by delegating to specialist agents.
- **Skills** are multi-step workflows the agent can invoke when it recognizes a matching request (e.g. "add a projection for Authors").
- **Prompts** are quick-invoke templates (e.g. `/add-concept`) for single-turn tasks.
- **Hooks** are lifecycle callbacks that fire automatically at specific points in the agent session (e.g. `agentStop` fires when the agent finishes, `preToolUse` fires before a tool call).

## Recommended VS Code settings

These settings enhance the AI-assisted development experience for Cratis projects. Add them to your `.vscode/settings.json` or user settings:

```jsonc
{
    // Ensure instruction files are loaded during code generation
    "github.copilot.chat.codeGeneration.useInstructionFiles": true,

    // AI co-author attribution — records AI contributions in git commits
    "git.addAICoAuthor": "chatAndAgent",

    // Terminal sandboxing — safer agent-driven terminal operations
    "chat.tools.terminal.sandbox.enabled": true,

    // Agentic browser tools — let agents verify frontend changes in-browser
    // Enable when working on React components to let agents test UI
    "workbench.browser.enableChatTools": true,

    // Collapsible terminal output — reduces chat clutter during multi-step builds
    "chat.tools.terminal.simpleCollapsible": true,

    // OS notifications — get notified when agent needs confirmation
    "chat.notifyWindowOnConfirmation": "always"
}
```

## Session management tips

When working on complex multi-slice features:

- **`/compact`** — Manually compress conversation history when context gets long. Add focus instructions: `/compact focus on the Projects feature implementation decisions`.
- **`/fork`** — Branch a conversation to explore an alternative approach without losing the original context.
- **Explore subagent** — The Plan agent automatically delegates codebase research to a fast read-only subagent. Configure the model with `chat.exploreAgent.defaultModel` if needed.
- **Steering** — Send a follow-up message mid-response to redirect the agent without waiting for it to finish.

## Troubleshooting

### Agent Debug Panel

Open with `Developer: Open Agent Debug Panel` or via the gear icon in the Chat view → "View Agent Logs". Shows:
- Which instruction files are loaded for the current session
- Which skills and hooks are active
- Tool call sequences and timings
- System prompt composition

### Creating new customizations from chat

VS Code 1.110+ supports generating customization files from conversation context:
- `/create-skill` — Extract a multi-step workflow from the current conversation
- `/create-instruction` — Turn corrections into project conventions
- `/create-prompt` — Generate a reusable prompt
- `/create-agent` — Create a specialized agent persona

## Updating this repo

When adding new instruction files, skills, agents, or hooks:
1. Add the file in the appropriate folder.
2. If it is an instruction file, set the `applyTo` glob in the YAML front matter.
3. If it is a hook, set the `on:` lifecycle event in the YAML front matter (`agentStop`, `preToolUse`, etc.).
4. Update `copilot-instructions.md` "Detailed Guides" section to reference it.
5. Update relevant agents if they should read the new file.
6. Update this README to reflect the new artifact.
