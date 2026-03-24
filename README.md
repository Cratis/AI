# Cratis AI — Copilot Configuration

Shared GitHub Copilot configuration used across all Cratis repositories and projects that build on the Cratis stack. Drop the `.github/` folder into any repo to get agents, skills, prompts, and coding instructions pre-configured for the Cratis way of building software.

## What is in `.github/`

```
.github/
├── copilot-instructions.md          ← Master instruction file (always loaded)
├── instructions/                    ← Topic-specific instruction files (auto-attached by glob)
│   ├── csharp.instructions.md       ← C# conventions           (*.cs)
│   ├── typescript.instructions.md   ← TypeScript conventions    (*.ts, *.tsx)
│   ├── components.instructions.md   ← React component rules     (*.tsx)
│   ├── dialogs.instructions.md      ← Dialog patterns            (*.tsx)
│   ├── concepts.instructions.md     ← ConceptAs<T> rules         (*.cs)
│   ├── vertical-slices.instructions.md ← Slice architecture     (Features/**/*)
│   ├── reactors.instructions.md     ← Chronicle reactor rules    (*.cs)
│   ├── efcore.instructions.md       ← Entity Framework Core      (*Context*.cs, Database/**, Migrations/**)
│   ├── efcore.specs.instructions.md ← EF Core specs              (for_*/when_*)
│   ├── orleans.instructions.md      ← Orleans grain rules        (*.cs)
│   ├── specs.instructions.md        ← General spec conventions   (for_*/when_*)
│   ├── specs.csharp.instructions.md ← C# spec conventions        (for_*/when_*)
│   ├── specs.typescript.instructions.md ← TS spec conventions    (for_*/when_*)
│   ├── documentation.instructions.md  ← Diátaxis docs           (Documentation/**/*.md)
│   └── pull-requests.instructions.md   ← PR conventions
├── agents/                          ← Custom chat agents
│   ├── orchestrator.md              ← Top-level team orchestrator
│   ├── coordinator.md               ← Decomposes cross-cutting work
│   ├── planner.md                   ← Decomposes work into tasks
│   ├── backend-developer.md         ← C# vertical slice specialist
│   ├── frontend-developer.md        ← React/TypeScript specialist
│   ├── spec-writer.md               ← BDD spec specialist
│   ├── code-reviewer.md             ← Quality gate
│   ├── security-reviewer.md         ← Security gate
│   └── performance-reviewer.md      ← Performance gate
├── hooks/                           ← Agent lifecycle hooks
│   ├── agent-stop.md                ← Release build on session end  (agentStop)
│   └── pre-commit.md                ← Run specs before git commit   (preToolUse)
├── skills/                          ← Reusable multi-step workflows
│   ├── new-vertical-slice/          ← End-to-end slice creation
│   ├── scaffold-feature/            ← New feature scaffolding
│   ├── add-concept/                 ← ConceptAs<T> creation
│   ├── add-projection/              ← Chronicle projection
│   ├── add-reactor/                 ← Chronicle reactor
│   ├── add-business-rule/           ← Command validation rules
│   ├── add-ef-migration/            ← Hand-written EF migration
│   ├── review-code/                 ← Structured code review
│   ├── review-performance/          ← Performance audit
│   ├── review-security/             ← Security audit
│   ├── write-documentation/         ← Diátaxis documentation
│   └── write-specs/                 ← BDD spec generation
└── prompts/                         ← Quick-invoke prompts (slash commands)
    ├── new-vertical-slice.prompt.md
    ├── scaffold-feature.prompt.md
    ├── add-concept.prompt.md
    ├── add-projection.prompt.md
    ├── add-reactor.prompt.md
    ├── add-business-rule.prompt.md
    ├── add-ef-migration.prompt.md
    ├── review-pr.prompt.md
    ├── write-documentation.prompt.md
    └── write-specs.prompt.md
```

## How it works

- **Instructions** are attached automatically based on file-glob patterns in their YAML front matter. When you open a `.cs` file, `csharp.instructions.md` is loaded; when you edit inside `Features/`, `vertical-slices.instructions.md` is loaded; and so on.
- **Agents** are invokable from the chat agent picker or via `@agent-name`. The planner orchestrates multi-step work by delegating to specialist agents.
- **Skills** are multi-step workflows the agent can invoke when it recognizes a matching request (e.g. "add a projection for Authors").
- **Prompts** are slash commands (e.g. `/add-concept`) for quick, single-turn tasks.
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
