# Migrating to the task-based corpus

The v2 platform skills replace earlier application walkthroughs in place. Specialist engineering, language and operator guidance is still available through its profiles. The installation path, selection file `.cratis/ai.json`, ownership manifest `.cratis/ai.manifest.json`, profile IDs, harness names and language values are unchanged.

## Update an installed repository

```bash
cratis ai update --dry-run
cratis ai update
cratis ai status
```

For an existing application install, run these commands with its application profile still selected. Use the CLI release that filters Copilot instruction copies: the update installs copies only for selected rules and removes no-longer-selected copies it owns. The dry run lists the files that will be added, replaced and removed. Update stops when a managed file was edited locally; move the edit elsewhere or pass `--force` to replace it. Files the CLI does not own are left alone.

Afterwards, change the selection in `.cratis/ai.json` to a featured profile when you want its whole task set:

| You are | Select |
| --- | --- |
| Building an application on Cratis | `cratis/application` |
| Changing a Cratis platform repository | `cratis/engineering` |

## What changed

| Before | Now |
| --- | --- |
| Skills organized by product reference area | One v2 platform skill per application task; specialist skills remain available through their profiles |
| About seventy rules, most loaded every session | `rules/general.md` is the one-page core; other rules are scoped by profile or language and matching paths |
| Agents, prompts and slash commands | Removed. Harness adapters for them are no longer created; update removes the ones the CLI created |
| Per-language walkthroughs for Elixir, Go, Java, Kotlin, Python and TypeScript services | `cratis-arc-select-backend-sdk` and `cratis-chronicle-select-client` explain SDK choice. The v2 walkthroughs use .NET and React; language profiles still carry specialized guidance |
| Imported .NET skills (diagnostics, MSBuild, Orleans, performance, refactoring, testing, .NET 11 migration) | Available through the .NET engineering profiles; .NET 11 migration is a separate opt-in |
| CodeScene, Playwright, Lens, Studio and content guidance | CodeScene, Lens, Studio and content skills are profile-scoped. The `codescene`, `playwright` and `screenplay` MCP servers are still added by their profiles |
| `product-sync.json` and the product drift workflow | Removed. [Compatibility](./compatibility.md) lists the releases the skills were checked against |
| Per-skill trigger and output evaluations | Removed. [Authoring skills](./authoring-skills.md) describes the review a skill gets instead |

To replace the removed `security-reviewer` agent, add `cratis/review` to your selection. It installs `cratis-security-review`, `cratis-code-review` and `cratis-performance-review`. If your repository's own rules dispatch `security-reviewer`, point them to the `cratis-security-review` skill instead, or keep your own copy of the agent.

Some earlier platform skill names no longer resolve. Use the v2 name for a replaced task; `cratis ai status` lists the installed skills, including specialist skills that kept their names.

## Profiles

`cratis/application` and `cratis/engineering` are the featured starting points, not replacements for specialist profiles. A managed install selects the skills of the requested profiles and their language-compatible composed profiles. Some profiles only select rules or add an MCP server. Marketplace plugins expose the whole skill corpus without applying a profile.

The second column counts the skills each profile selects, including composed profiles and assuming all languages are selected. Vendored .NET and CodeScene skills are counted separately. Rule selection is not shown.

<!-- profiles:start -->
| Profile | Skills and MCP servers |
| --- | --- |
| `cratis` | .NET tooling 4, application 1, arc 26, chronicle 16, cli 1, code 1, components 11, content 1, developer 1, discoverability 1, documentation 1, engineering 1, environments 1, event 1, fundamentals 4, governed 1, lens 1, llm 1, modeling 4, multi 1, observability 1, onboarding 1, performance 1, platform 7, release 1, screenplay 14, security 1, shared 2, showrunner 1, social 1, specifications 3, stage 1, studio 1, technical 1, ux 1, writing 1; MCP: screenplay |
| `cratis/application` (featured) | .NET tooling 4, application 1, arc 21, chronicle 14, components 11, event 1, fundamentals 2, modeling 4, multi 1, observability 1, platform 5, screenplay 14, shared 2, showrunner 1, specifications 3, stage 1, ux 1; MCP: screenplay |
| `cratis/application/arc-chronicle` | .NET tooling 4, application 1, arc 17, chronicle 13, components 6, event 1, fundamentals 2, modeling 4, multi 1, observability 1, platform 5, screenplay 14, shared 2, showrunner 1, specifications 3, stage 1; MCP: screenplay |
| `cratis/application/arc-only` | .NET tooling 4, application 1, arc 17, chronicle 13, components 6, fundamentals 2, modeling 4, observability 1, platform 5, screenplay 14, shared 2, specifications 3, stage 1; MCP: screenplay |
| `cratis/application/chronicle-dotnet` | .NET tooling 4, application 1, arc 17, chronicle 13, components 6, event 1, fundamentals 2, modeling 4, multi 1, observability 1, platform 5, screenplay 14, shared 2, showrunner 1, specifications 3, stage 1; MCP: screenplay |
| `cratis/application/csharp` | .NET tooling 4, application 1, arc 21, chronicle 14, components 11, event 1, fundamentals 2, modeling 4, multi 1, observability 1, platform 5, screenplay 14, shared 2, showrunner 1, specifications 3, stage 1, ux 1; MCP: screenplay |
| `cratis/application/elixir` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 4, observability 1, platform 2, screenplay 14, shared 2, specifications 2, stage 1; MCP: screenplay |
| `cratis/application/java` | arc 21, chronicle 13, components 6, fundamentals 1, modeling 4, observability 1, platform 2, screenplay 14, shared 2, specifications 2, stage 1; MCP: screenplay |
| `cratis/application/kotlin` | arc 21, chronicle 13, components 6, fundamentals 1, modeling 4, observability 1, platform 2, screenplay 14, shared 2, specifications 2, stage 1; MCP: screenplay |
| `cratis/application/react` | .NET tooling 4, application 1, arc 17, chronicle 13, components 11, fundamentals 2, modeling 2, observability 1, platform 5, screenplay 11, shared 2, specifications 3, stage 1, ux 1 |
| `cratis/application/typescript` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 4, observability 1, platform 2, screenplay 14, shared 2, specifications 2, stage 1; MCP: screenplay |
| `cratis/arc` | .NET tooling 4, application 1, arc 21, chronicle 13, components 6, fundamentals 2, modeling 4, observability 1, platform 5, screenplay 14, shared 2, specifications 3, stage 1; MCP: screenplay |
| `cratis/arc/client-kotlin` | arc 21, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/arc/core` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/arc/csharp` | .NET tooling 4, application 1, arc 17, chronicle 13, components 6, fundamentals 2, modeling 4, observability 1, platform 5, screenplay 14, shared 2, specifications 3, stage 1; MCP: screenplay |
| `cratis/arc/ef-core` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/arc/elixir` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/arc/go` | arc 17, chronicle 13, components 6, fundamentals 2, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/arc/identity` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/arc/java` | arc 21, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/arc/kotlin` | arc 21, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/arc/react` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1, ux 1 |
| `cratis/arc/server-typescript` | arc 22, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/arc/typescript` | arc 22, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/chronicle` | .NET tooling 4, application 1, arc 17, chronicle 14, components 6, event 1, fundamentals 2, modeling 4, multi 1, observability 1, platform 5, screenplay 14, shared 2, showrunner 1, specifications 3, stage 1; MCP: screenplay |
| `cratis/chronicle/client-dotnet` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/chronicle/client-elixir` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/chronicle/client-go` | arc 17, chronicle 13, components 6, fundamentals 2, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/chronicle/client-java` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/chronicle/client-kotlin` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/chronicle/client-python` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/chronicle/client-typescript` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/chronicle/compliance` | arc 17, chronicle 13, components 6, event 1, fundamentals 1, modeling 3, multi 1, platform 3, screenplay 11, shared 2, showrunner 1, specifications 2, stage 1 |
| `cratis/chronicle/core` | arc 17, chronicle 13, components 6, event 1, fundamentals 1, modeling 3, multi 1, platform 3, screenplay 11, shared 2, showrunner 1, specifications 2, stage 1 |
| `cratis/chronicle/csharp` | .NET tooling 4, application 1, arc 17, chronicle 13, components 6, event 1, fundamentals 2, modeling 4, multi 1, observability 1, platform 5, screenplay 14, shared 2, showrunner 1, specifications 3, stage 1; MCP: screenplay |
| `cratis/chronicle/elixir` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/chronicle/java` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/chronicle/kotlin` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/chronicle/mcp` | arc 17, chronicle 14, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/chronicle/multi-tenancy` | arc 17, chronicle 13, components 6, event 1, fundamentals 1, modeling 3, multi 1, platform 3, screenplay 11, shared 2, showrunner 1, specifications 2, stage 1 |
| `cratis/chronicle/typescript` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/chronicle/web-workbench` | arc 17, chronicle 14, components 6, event 1, fundamentals 1, modeling 3, multi 1, platform 3, screenplay 11, shared 2, showrunner 1, specifications 2, stage 1 |
| `cratis/cli` | arc 17, chronicle 14, components 6, environments 1, fundamentals 1, modeling 2, platform 3, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/cli/terminal-workbench` | arc 17, chronicle 14, cli 1, components 6, environments 1, fundamentals 1, modeling 2, platform 3, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/codescene` | CodeScene 4, shared 2; MCP: codescene |
| `cratis/components` | components 11, shared 2, ux 1 |
| `cratis/content` | content 1, developer 1, discoverability 1, release 1, shared 2, social 1, technical 1, writing 1 |
| `cratis/documentation` | discoverability 1, documentation 1, engineering 1, llm 1, platform 2, release 1, shared 2, technical 1, writing 1 |
| `cratis/engineering` (featured) | .NET tooling 23, arc 17, chronicle 13, ci 1, components 6, documentation 1, engineering 14, fundamentals 1, modeling 2, orleans 1, platform 4, release 1, screenplay 11, session 1, shared 2, specifications 3, stage 1, technical 1 |
| `cratis/engineering/core` | ci 1, documentation 1, engineering 13, platform 2, release 1, session 1, shared 2, technical 1 |
| `cratis/engineering/csharp` | .NET tooling 23, arc 17, chronicle 13, ci 1, components 6, documentation 1, engineering 14, fundamentals 1, modeling 2, orleans 1, platform 4, release 1, screenplay 11, session 1, shared 2, specifications 3, stage 1, technical 1 |
| `cratis/engineering/dotnet` | .NET tooling 23, shared 2 |
| `cratis/engineering/dotnet/diagnostics` | .NET tooling 3, shared 2 |
| `cratis/engineering/dotnet/migrate-dotnet11` | .NET tooling 1, shared 2 |
| `cratis/engineering/dotnet/msbuild` | .NET tooling 8, shared 2 |
| `cratis/engineering/dotnet/orleans` | .NET tooling 1, shared 2 |
| `cratis/engineering/dotnet/performance` | .NET tooling 4, shared 2 |
| `cratis/engineering/dotnet/refactoring` | .NET tooling 2, shared 2 |
| `cratis/engineering/dotnet/testing` | .NET tooling 5, shared 2 |
| `cratis/engineering/elixir` | ci 1, documentation 1, engineering 13, platform 2, release 1, session 1, shared 2, technical 1 |
| `cratis/engineering/go` | ci 1, documentation 1, engineering 13, platform 2, release 1, session 1, shared 2, technical 1 |
| `cratis/engineering/kotlin` | ci 1, documentation 1, engineering 13, platform 2, release 1, session 1, shared 2, technical 1 |
| `cratis/engineering/react` | ci 1, documentation 1, engineering 13, platform 2, release 1, session 1, shared 2, technical 1 |
| `cratis/engineering/typescript` | ci 1, documentation 1, engineering 13, platform 2, release 1, session 1, shared 2, technical 1 |
| `cratis/full` | .NET tooling 4, application 1, arc 26, chronicle 14, components 11, event 1, fundamentals 2, modeling 4, multi 1, observability 1, onboarding 1, platform 5, screenplay 14, shared 2, showrunner 1, specifications 3, stage 1, ux 1; MCP: screenplay |
| `cratis/full/csharp` | .NET tooling 4, application 1, arc 21, chronicle 14, components 11, event 1, fundamentals 2, modeling 4, multi 1, observability 1, onboarding 1, platform 5, screenplay 14, shared 2, showrunner 1, specifications 3, stage 1, ux 1; MCP: screenplay |
| `cratis/full/elixir` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 4, observability 1, onboarding 1, platform 2, screenplay 14, shared 2, specifications 2, stage 1; MCP: screenplay |
| `cratis/full/java` | arc 21, chronicle 13, components 6, fundamentals 1, modeling 4, observability 1, onboarding 1, platform 2, screenplay 14, shared 2, specifications 2, stage 1; MCP: screenplay |
| `cratis/full/kotlin` | arc 21, chronicle 13, components 6, fundamentals 1, modeling 4, observability 1, onboarding 1, platform 2, screenplay 14, shared 2, specifications 2, stage 1; MCP: screenplay |
| `cratis/full/typescript` | arc 22, chronicle 13, components 6, fundamentals 1, modeling 4, observability 1, onboarding 1, platform 2, screenplay 14, shared 2, specifications 2, stage 1; MCP: screenplay |
| `cratis/fundamentals` | arc 17, chronicle 13, components 6, fundamentals 2, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/fundamentals/go` | fundamentals 1, shared 2 |
| `cratis/fundamentals/type-discovery` | arc 17, chronicle 13, components 6, fundamentals 3, modeling 2, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/language/csharp` | shared 2 |
| `cratis/language/elixir` | shared 2 |
| `cratis/language/go` | shared 2 |
| `cratis/language/java` | shared 2 |
| `cratis/language/kotlin` | shared 2 |
| `cratis/language/typescript` | shared 2 |
| `cratis/lens` | lens 1, shared 2 |
| `cratis/methodology/governed-releases` | governed 1, platform 1, shared 2 |
| `cratis/modeling/screenplay-stage` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 4, onboarding 1, platform 2, screenplay 14, shared 2, specifications 2, stage 1; MCP: screenplay |
| `cratis/orchestration` | ci 1, documentation 1, engineering 13, orchestration 2, platform 2, release 1, session 1, shared 2, technical 1 |
| `cratis/playwright` | shared 2; MCP: playwright |
| `cratis/review` | code 1, performance 1, platform 1, security 1, shared 2 |
| `cratis/screenplay` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 4, platform 2, screenplay 14, shared 2, specifications 2, stage 1; MCP: screenplay |
| `cratis/specifications` | shared 2 |
| `cratis/specifications/dotnet` | .NET tooling 4, shared 2, specifications 2 |
| `cratis/specifications/typescript` | shared 2, specifications 2 |
| `cratis/stage` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, onboarding 1, platform 2, screenplay 11, shared 2, specifications 2, stage 1 |
| `cratis/studio` | shared 2, studio 1 |
| `cratis/v2/application` | arc 17, chronicle 13, components 10, fundamentals 1, modeling 4, platform 5, screenplay 11, specifications 3, stage 1 |
<!-- profiles:end -->
