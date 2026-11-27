---
applyTo: "**/.cratis/**"
paths:
  - "**/.cratis/**"
profile: framework
---
<!-- cratis-ai: generated Copilot instructions. Do not edit; rules/ is the source. -->

# Profiles

A profile selects which skills, rules and MCP server declarations `cratis ai install` copies into a repository. The catalog is `profile-catalog.json` in the Cratis AI repository: each profile lists the skills it installs (`availableTargets`) and the profiles it includes (`composes`). Selecting a profile installs its own skills and those of every profile it composes, transitively.

## Choose a profile

| Profile | Select it when |
|---|---|
| `cratis/application` | The repository builds an application on Cratis. |
| `cratis/engineering` | The repository is a Cratis library or tool. |

`cratis ai profiles list` shows these two. `cratis ai profiles list --all` adds the narrower IDs: a single product (`cratis/arc`, `cratis/chronicle`, `cratis/screenplay`), a single language stack (`cratis/application/csharp`, `cratis/engineering/go`), and the opt-in profiles below. A repository records its selection in `.cratis/ai.json`:

```json
{
  "schemaVersion": "1.0.0",
  "profiles": ["cratis/application/csharp", "cratis/engineering/csharp"],
  "languages": ["csharp", "typescript"]
}
```

Select the narrowest set that covers the work. Several profiles may be selected together; the installed skills are the union.

## Opt-in profiles

These install skills that the platform task skills do not cover. A profile marked *explicit* is composed by no other profile, so nothing installs it unless it is named in `profiles`.

| Profile | Adds |
|---|---|
| `cratis/engineering/core` | Engineering process for Cratis repositories: CI gates and pipeline cost, cross-repository verification, issue and decision records, review rounds, release trains, post-mortems and session handoff. Composed by `cratis/engineering`. |
| `cratis/engineering/dotnet` | Vendored .NET skills in seven groups, each selectable alone: `performance`, `diagnostics`, `msbuild`, `orleans`, `testing`, `migrate-dotnet11`, `refactoring` (as `cratis/engineering/dotnet/<group>`). |
| `cratis/orchestration` | Running several agent lanes and gating their merges. |
| `cratis/documentation` | Product documentation: reader-centered writing, checked examples, discoverability, release notes and voice. |
| `cratis/content` | Release notes, social posts, developer marketing, length and voice. |
| `cratis/review` | Code, security and performance review. |
| `cratis/codescene` | *Explicit.* CodeScene Code Health skills and the `codescene` MCP server declaration. |
| `cratis/playwright` | *Explicit.* The `playwright` MCP server declaration for exploratory browser checks. |
| `cratis/cli`, `cratis/cli/terminal-workbench` | Operating Chronicle from the CLI, environments and secrets, and the terminal Workbench. |
| `cratis/chronicle/mcp`, `cratis/chronicle/web-workbench` | Inspecting an event store through the Chronicle MCP server or the web Workbench. |
| `cratis/studio`, `cratis/lens`, `cratis/stage` | Studio MCP safety guidance, the Lens browser extension and the onboarding runtime. |
| `cratis/methodology/governed-releases` | *Explicit.* The governed release methodology. |

### Code Health with CodeScene

`cratis/codescene` installs four upstream CodeScene skills: `safeguarding-ai-generated-code`, `guiding-refactoring-with-code-health`, `prioritizing-technical-debt` and `risk-based-testing-with-code-health`. The `codescene` rule, installed with the same profile, overrides those skills where they differ.

The profile declares the `codescene` stdio server (`cs-mcp`, no arguments) in `mcp-servers.json`. `cratis ai install` registers a selected profile's server in each managed harness's project configuration (Cratis CLI 3.90.0 or later; older CLIs register only Screenplay). Each user installs `cs-mcp`; the corpus does not. Pi's `cratis-mcp` extension enables the server through `cratis_enable_mcp`, or at session start with `mcpServers.codescene.eager: true`; `mcpServers.codescene.enabled: false` opts out in every harness. CodeScene needs an account and an OAuth login. Without an account or available CodeScene tools, skip its steps and say so rather than blocking the contributor.

### Browser automation with Playwright

`cratis/playwright` declares the `playwright` stdio server (`npx -y @playwright/mcp@0.0.83 --headless --isolated`) in `mcp-servers.json`. The flags keep the browser headless and isolated: no persistent profile, so no personal cookies or logins are reused.

`cratis ai install` registers it like any other selected server, and Pi's `cratis-mcp` extension can start it on demand. Use it for exploratory browser checks; repeatable checks stay in the repository's own Playwright tests. Without the server registered, skip browser steps and say so.

## Which rules a profile installs

A rule's frontmatter decides where it is installed and when it loads:

| Frontmatter | Installed when |
|---|---|
| no `profile` | The rule's `applyTo` globs name a language in the repository's `languages`, or name no language at all. A rule whose globs match only `.md` or `.mdx` files installs when `cratis/documentation` is selected or composed. |
| `profile: framework` | A selected or composed profile is `cratis/engineering` or one of its children, and the language condition above holds. |
| `profile: application` | A selected or composed profile is `cratis/application` or one of its children, and the language condition above holds. |
| `profile: cratis/<id>` | `profiles` in `.cratis/ai.json` names that ID or one of its children directly. A parent that only composes it does not install the rule. The language condition above also applies. |

`applyTo` and `paths` then limit an installed rule to matching files. A rule with neither loads in every session, so only `general.md` is written that way.

## Change the catalog

Edit the canonical skill and its catalog entry in the Cratis AI repository, never a consuming repository's managed copy or a generated harness adapter. A skill that links to another skill needs that skill in every profile that installs the first, or the link leaves the selection. Plugin installs expose the whole skill tree and apply no profile, so check reachability through the catalog as well.
