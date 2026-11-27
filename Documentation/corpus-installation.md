# Installing and using the corpus

## Choose a profile

| Profile | Select it when |
| --- | --- |
| `cratis/application` | The repository builds an application on Cratis. Installs the v2 platform skills for modeling a business flow, implementing backend and UI slices, and running and diagnosing them. |
| `cratis/engineering` | The repository is a Cratis library or tool. Installs platform skills and internal engineering guidance. With C# it includes .NET build, diagnostics, performance, Orleans, testing and refactoring skills. |

`cratis ai profiles list` shows the featured starting points; `--all` also lists the specialist profiles. Select the profiles you need for language-specific work, documentation, content, review, CodeScene, CLI or Workbench, and orchestration. For example, .NET 11 migration is a separate opt-in (`cratis/engineering/dotnet/migrate-dotnet11`). See the [profile inventory](./corpus-migration.md#profiles).

## Install with the Cratis CLI

```bash
cratis ai install \
  --harnesses claude,codex,copilot,cursor,opencode,pi \
  --profiles cratis/application \
  --languages csharp,typescript
```

The CLI copies the selected skills and rules into `.cratis/ai`, creates the adapter links each selected harness reads, and records the selection in `.cratis/ai.json` and file ownership in `.cratis/ai.manifest.json`. With the CLI release that filters Copilot instruction copies, only copies for selected rules are installed. Earlier CLI releases can install Copilot copies of rules that the profile did not select.

| Command | Effect |
| --- | --- |
| `cratis ai status` | Shows the selection, the installed skills and any managed file that was edited. |
| `cratis ai update --dry-run` | Lists what an update would add, replace and remove. |
| `cratis ai update` | Applies it. Stops on an edited managed file unless `--force` is given. |
| `cratis ai uninstall` | Removes managed files and links. Leaves files it does not own. |

Add `--source <checkout>` to install from a local checkout of this repository instead of its default branch.

For a Cratis platform checkout, select `cratis/engineering` instead. For example:

```bash
cratis ai install --profiles cratis/engineering --languages csharp,typescript --harnesses copilot,pi
```

## Install for one harness

Claude Code, Codex, GitHub Copilot and Cursor can install the corpus as a plugin from the marketplace manifests in this repository. A plugin exposes every skill; it does not apply a profile.

Pi uses the published package:

```bash
pi install -l npm:@cratis/pi
```

`@cratis/pi` reads `.cratis/ai.json` when present and exposes the skills its profiles select. It stands down when the CLI already manages the repository.

## What a session sees

- `rules/general.md` is read in every session. It is one page.
- Other installed rules apply to matching paths. In a managed install, the selected profiles and languages determine which rules are installed. A rule with a `profile: cratis/<id>` selector needs a direct selection of that profile or a child; composing it is not enough.
- A skill is loaded when its description matches the task. Links between skills work within the same installation; a skill from another profile can be named as an optional handoff.

Two ways in:

- "Members must be able to borrow a book" in an application: `cratis-modeling-discover-timeline` identifies who acts and which event records the outcome, `cratis-modeling-design-event-model` cuts it into slices, and `cratis-platform-deliver-slice` implements one from command to screen.
- "Callers cannot tell a denied command from an invalid one" in Arc: `cratis-platform-contribute-change` locates the published contract and its focused check, and `cratis-platform-prepare-release-pr` writes the release note and picks the label.

## MCP servers

`.cratis/ai/mcp-servers.json` lists the servers a profile can add. `cratis/application` adds the Screenplay server through `cratis/screenplay`; `cratis/codescene` and `cratis/playwright` add theirs only when selected. No skill requires a server to be present.
