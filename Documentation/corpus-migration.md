# Migrating to the task-based corpus

The corpus under `.cratis/ai` was replaced in place. The installation path, the selection file `.cratis/ai.json`, the ownership manifest `.cratis/ai.manifest.json`, every profile ID, every harness name and every language value are unchanged. What a profile installs is different.

## Update an installed repository

```bash
cratis ai update --dry-run
cratis ai update
cratis ai status
```

The dry run lists the files that will be added, replaced and removed. Update stops when a managed file was edited locally; move the edit elsewhere or pass `--force` to replace it. Files the CLI does not own are left alone.

Afterwards, change the selection in `.cratis/ai.json` to a featured profile when you want its whole task set:

| You are | Select |
| --- | --- |
| Building an application on Cratis | `cratis/application` |
| Changing a Cratis platform repository | `cratis/engineering` |

## What changed

| Before | Now |
| --- | --- |
| Skills organized by product reference area | One skill per task, named `cratis-<area>-<task>`; the description names the nearest skill to use instead |
| About seventy rules, most loaded every session | `rules/general.md` (one page) plus `framework.md` and `specs.typescript.md`, both scoped to platform sources |
| Agents, prompts and slash commands | Removed. Harness adapters for them are no longer created; update removes the ones the CLI created |
| Per-language walkthroughs for Elixir, Go, Java, Kotlin, Python and TypeScript services | `cratis-arc-select-backend-sdk` and `cratis-chronicle-select-client` state what each SDK supports; the worked examples are .NET and React |
| Imported .NET skills (diagnostics, MSBuild, Orleans, performance, refactoring, testing, .NET 11 migration) | Removed. Install them from their own publishers |
| CodeScene, Playwright, Lens, Studio and content skills | Removed. The `codescene`, `playwright` and `screenplay` MCP servers are still added by their profiles |
| `product-sync.json` and the product drift workflow | Removed. [Compatibility](./compatibility.md) lists the releases the skills were checked against |
| Per-skill trigger and output evaluations | Removed. [Authoring skills](./authoring-skills.md) describes the review a skill gets instead |

A skill name from the previous corpus no longer resolves. Reference a task by its new name; `cratis ai status` lists the installed ones.

## Profiles

`cratis/application` and `cratis/engineering` are the two profiles to choose from. Every other ID resolves as before, composes the same children and adds the same MCP servers, and installs skills from the same set. A profile installs the skills that replace what it covered and every skill those link to, so most earlier profiles now install most of the application skills. A profile that installs no skills is kept so that an existing selection does not fail.

The second column counts the skills the profile installs by area, with all languages selected.

<!-- profiles:start -->
| Profile | Installs now | Featured successor |
| --- | --- | --- |
| `cratis` | arc 17, chronicle 13, components 10, fundamentals 1, modeling 2, platform 7, screenplay 11, specifications 3, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/application/arc-chronicle` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 5, screenplay 11, specifications 3, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/application/arc-only` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 5, screenplay 11, specifications 3, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/application/chronicle-dotnet` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 5, screenplay 11, specifications 3, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/application/csharp` | arc 17, chronicle 13, components 10, fundamentals 1, modeling 2, platform 5, screenplay 11, specifications 3, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/application/elixir` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/application/java` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/application/kotlin` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/application/react` | arc 17, chronicle 13, components 10, fundamentals 1, modeling 2, platform 5, screenplay 11, specifications 3, stage 1 | `cratis/application` |
| `cratis/application/typescript` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/arc` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 5, screenplay 11, specifications 3, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/arc/client-kotlin` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/arc/core` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/arc/csharp` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 5, screenplay 11, specifications 3, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/arc/ef-core` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/arc/elixir` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/arc/go` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/arc/identity` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/arc/java` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/arc/kotlin` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/arc/react` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/arc/server-typescript` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/arc/typescript` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/chronicle` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 5, screenplay 11, specifications 3, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/chronicle/client-dotnet` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/chronicle/client-elixir` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/chronicle/client-go` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/chronicle/client-java` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/chronicle/client-kotlin` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/chronicle/client-python` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/chronicle/client-typescript` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/chronicle/compliance` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 3, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/chronicle/core` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 3, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/chronicle/csharp` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 5, screenplay 11, specifications 3, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/chronicle/elixir` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/chronicle/java` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/chronicle/kotlin` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/chronicle/mcp` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/chronicle/multi-tenancy` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 3, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/chronicle/typescript` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/chronicle/web-workbench` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 3, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/cli` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 3, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/cli/terminal-workbench` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 3, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/codescene` | no skills; MCP: codescene | `cratis/application` |
| `cratis/components` | components 10 | `cratis/application` |
| `cratis/content` | no skills | `cratis/application` |
| `cratis/documentation` | platform 2 | `cratis/engineering` |
| `cratis/engineering/core` | platform 2 | `cratis/engineering` |
| `cratis/engineering/csharp` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 4, screenplay 11, specifications 3, stage 1 | `cratis/engineering` |
| `cratis/engineering/dotnet` | no skills | `cratis/engineering` |
| `cratis/engineering/dotnet/diagnostics` | no skills | `cratis/engineering` |
| `cratis/engineering/dotnet/migrate-dotnet11` | no skills | `cratis/engineering` |
| `cratis/engineering/dotnet/msbuild` | no skills | `cratis/engineering` |
| `cratis/engineering/dotnet/orleans` | no skills | `cratis/engineering` |
| `cratis/engineering/dotnet/performance` | no skills | `cratis/engineering` |
| `cratis/engineering/dotnet/refactoring` | no skills | `cratis/engineering` |
| `cratis/engineering/dotnet/testing` | no skills | `cratis/engineering` |
| `cratis/engineering/elixir` | platform 2 | `cratis/engineering` |
| `cratis/engineering/go` | platform 2 | `cratis/engineering` |
| `cratis/engineering/kotlin` | platform 2 | `cratis/engineering` |
| `cratis/engineering/react` | platform 2 | `cratis/engineering` |
| `cratis/engineering/typescript` | platform 2 | `cratis/engineering` |
| `cratis/full` | arc 17, chronicle 13, components 10, fundamentals 1, modeling 2, platform 5, screenplay 11, specifications 3, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/full/csharp` | arc 17, chronicle 13, components 10, fundamentals 1, modeling 2, platform 5, screenplay 11, specifications 3, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/full/elixir` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/full/java` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/full/kotlin` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/full/typescript` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/fundamentals` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/fundamentals/go` | no skills | `cratis/application` |
| `cratis/fundamentals/type-discovery` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/language/csharp` | no skills | `cratis/application` |
| `cratis/language/elixir` | no skills | `cratis/application` |
| `cratis/language/go` | no skills | `cratis/application` |
| `cratis/language/java` | no skills | `cratis/application` |
| `cratis/language/kotlin` | no skills | `cratis/application` |
| `cratis/language/typescript` | no skills | `cratis/application` |
| `cratis/lens` | no skills | `cratis/application` |
| `cratis/methodology/governed-releases` | platform 1 | `cratis/engineering` |
| `cratis/modeling/screenplay-stage` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/orchestration` | platform 2 | `cratis/engineering` |
| `cratis/playwright` | no skills; MCP: playwright | `cratis/application` |
| `cratis/review` | platform 1 | `cratis/engineering` |
| `cratis/screenplay` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1; MCP: screenplay | `cratis/application` |
| `cratis/specifications` | no skills | `cratis/application` |
| `cratis/specifications/dotnet` | specifications 2 | `cratis/application` |
| `cratis/specifications/typescript` | specifications 2 | `cratis/application` |
| `cratis/stage` | arc 17, chronicle 13, components 6, fundamentals 1, modeling 2, platform 2, screenplay 11, specifications 2, stage 1 | `cratis/application` |
| `cratis/studio` | no skills | `cratis/application` |
| `cratis/v2/application` | arc 17, chronicle 13, components 10, fundamentals 1, modeling 2, platform 5, screenplay 11, specifications 3, stage 1 | `cratis/application` |
<!-- profiles:end -->
