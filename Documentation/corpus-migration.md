# Migrating to the task-based corpus

The v2 platform skills replace earlier application walkthroughs in place. Specialist engineering, language and operator guidance is still available through its profiles. The installation path, selection file `.cratis/ai.json`, ownership manifest `.cratis/ai.manifest.json`, profile IDs, harness names and language values are unchanged.

## Update an installed repository

```bash
cratis ai update --dry-run
cratis ai update
cratis ai status
```

For an existing application install, run these commands with its application profile still selected. Use the CLI release that filters Copilot instruction copies: the update installs copies only for selected rules and removes no-longer-selected copies it owns. The dry run lists the files that will be added, replaced and removed. Update stops when a managed file was edited locally; move the edit elsewhere or pass `--force` to replace it. Files the CLI does not own are left alone.

Afterwards, change the selection in `.cratis/ai.json` to the profile that matches the repository:

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

To replace the removed `security-reviewer` agent, add `cratis/review` to your selection. It installs `cratis-security-review`, `cratis-code-review` and `cratis-performance-review`. If your repository's own rules dispatch `security-reviewer`, change them to load and apply the `cratis-security-review` skill, or keep your own copy of the agent if you need separate dispatch.

Some earlier platform skill names no longer resolve. Use the v2 name for a replaced task; `cratis ai status` lists the installed skills, including specialist skills that kept their names.

## Profiles

`cratis/application` and `cratis/engineering` are starting points, not replacements for specialist profiles. `cratis ai profiles list` lists all profiles in this catalog in both its default and JSON output. Select `cratis/v2/application` by ID for the mixed .NET and React walkthrough; other profiles do not compose it.

A managed install includes the direct skills of each requested profile and follows its composition edges through language-compatible profiles. An explicit selection is not filtered by language. A profile can select rules or an MCP server independently of its skill list. See the [catalog](../.cratis/ai/profile-catalog.json) for direct membership and [installation](./corpus-installation.md) for update and selection details.
