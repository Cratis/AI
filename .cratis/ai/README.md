# Cratis AI corpus

Skills and rules for building applications on Cratis and for changing the Cratis platform itself.

| Path | Contents |
| --- | --- |
| `skills/` | One skill per task. Cratis-authored descriptions say when to use the skill and what falls outside its task. |
| `rules/general.md` | The one-page core every session reads. |
| Other `rules/` files | Scoped rules, including platform engineering, language and specialist conventions. |
| `profile-catalog.json` | Which skills each profile selects. |
| `manifest.json` | The harnesses, profiles and languages an installer offers. |
| `mcp-servers.json` | MCP servers a profile can add; a profile's skills never require one. |
| `hooks/`, `harnesses/` | Optional write guards and the harness-specific files generated from the content above. |

## Profiles

| Profile | For |
| --- | --- |
| `cratis/application` | Build an application on Cratis: model a business flow, implement its backend and UI slices, run and diagnose them. |
| `cratis/engineering` | Change a Cratis platform repository: follow its library contracts, verify the change and prepare the PR and release note. |

The worked application examples use .NET and React. Paths such as `Features/Books` are examples: follow the repository's layout and edit existing slices in place. Profiles select overlapping skills, not separate implementations per language.

The v2 platform skills cover application tasks. Existing profile IDs still resolve, and profiles also select specialist skills for internal .NET engineering, CodeScene, documentation, content, review, language-specific work, CLI and Workbench, and orchestration. Managed installs filter scoped rules by profile and language; the CLI release that filters Copilot instruction copies installs copies only for selected rules. See [migration](../../Documentation/corpus-migration.md) for the profile inventory.

## Where to start

- An empty directory: [start an application](skills/cratis-platform-start-application/SKILL.md).
- A business journey: [discover the timeline](skills/cratis-modeling-discover-timeline/SKILL.md), then [design the event model](skills/cratis-modeling-design-event-model/SKILL.md).
- A slice to implement: [deliver a slice](skills/cratis-platform-deliver-slice/SKILL.md).
- A stale screen or missing result, with the failing boundary unknown: [diagnose a slice](skills/cratis-platform-diagnose-slice/SKILL.md).
- A change to a Cratis library or tool: [contribute a change](skills/cratis-platform-contribute-change/SKILL.md).

An installed copy of this directory is managed content. Change it through `cratis ai update`, not by editing the copy.
