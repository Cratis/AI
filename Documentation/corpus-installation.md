# Installing and using the corpus

## Choose a profile

| Profile | Select it when |
| --- | --- |
| `cratis/application` | The repository builds an application on Cratis. Installs the skills for modeling a business flow, implementing backend and UI slices, and running and diagnosing them. |
| `cratis/engineering` | The repository is a Cratis library or tool. Installs the skills for changing a platform contract, verifying it and preparing the PR and release note, plus every skill those link to, which is most of the application skills. |

`cratis ai profiles list` shows these two with the same descriptions; `--all` adds the older profile IDs, which still resolve. See [migration](./corpus-migration.md).

## Install with the Cratis CLI

```bash
cratis ai install \
  --harnesses claude,codex,copilot,cursor,opencode,pi \
  --profiles cratis/application \
  --languages csharp,typescript
```

The CLI copies the selected skills and the rules into `.cratis/ai`, creates the adapter links each selected harness reads, and records the selection in `.cratis/ai.json` and file ownership in `.cratis/ai.manifest.json`.

| Command | Effect |
| --- | --- |
| `cratis ai status` | Shows the selection, the installed skills and any managed file that was edited. |
| `cratis ai update --dry-run` | Lists what an update would add, replace and remove. |
| `cratis ai update` | Applies it. Stops on an edited managed file unless `--force` is given. |
| `cratis ai uninstall` | Removes managed files and links. Leaves files it does not own. |

Add `--source <checkout>` to install from a local checkout of this repository instead of its default branch.

## Install for one harness

Claude Code, Codex, GitHub Copilot and Cursor can install the corpus as a plugin from the marketplace manifests in this repository. A plugin exposes every skill; it does not apply a profile.

Pi uses the published package:

```bash
pi install -l npm:@cratis/pi
```

`@cratis/pi` reads `.cratis/ai.json` when present and exposes the skills its profiles select. It stands down when the CLI already manages the repository.

## What a session sees

- `rules/general.md` is read in every session. It is one page.
- `rules/framework.md` and `rules/specs.typescript.md` apply only to matching paths in a platform repository.
- A skill is loaded when its description matches the task. Each description ends with the nearest skill to use instead, and a skill links to the next one at the point of handoff. Linked skills are part of the same profile.

Two ways in:

- "Members must be able to borrow a book" in an application: `cratis-modeling-discover-timeline` identifies who acts and which event records the outcome, `cratis-modeling-design-event-model` cuts it into slices, and `cratis-platform-deliver-slice` implements one from command to screen.
- "Callers cannot tell a denied command from an invalid one" in Arc: `cratis-platform-contribute-change` locates the published contract and its focused check, and `cratis-platform-prepare-release-pr` writes the release note and picks the label.

## MCP servers

`.cratis/ai/mcp-servers.json` lists the servers a profile can add. `cratis/application` adds the Screenplay server through `cratis/screenplay`; `cratis/codescene` and `cratis/playwright` add theirs only when selected. No skill requires a server to be present.
