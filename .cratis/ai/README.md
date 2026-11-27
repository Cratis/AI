# Cratis AI corpus

Skills and rules for building applications on Cratis and for changing the Cratis platform itself.

| Path | Contents |
| --- | --- |
| `skills/` | One skill per task. The description says when to use it and names the nearest skill to use instead. |
| `rules/general.md` | The one-page core every session reads. |
| `rules/framework.md`, `rules/specs.typescript.md` | Rules scoped to platform sources and platform TypeScript specs. |
| `profile-catalog.json` | Which skills each profile selects. |
| `manifest.json` | The harnesses, profiles and languages an installer offers. |
| `mcp-servers.json` | MCP servers a profile can add; a profile's skills never require one. |
| `hooks/`, `harnesses/` | Optional write guards and the harness-specific files generated from the content above. |

## Profiles

| Profile | For |
| --- | --- |
| `cratis/application` | Build an application on Cratis: model a business flow, implement its backend and UI slices, run and diagnose them. |
| `cratis/engineering` | Change a Cratis platform repository: follow its library contracts, verify the change and prepare the PR and release note. |

Every other profile ID is kept so existing selections keep resolving; each maps to a subset of the same skills. See [migration](../../Documentation/corpus-migration.md).

## Where to start

- A business journey: [discover the timeline](skills/cratis-modeling-discover-timeline/SKILL.md), then [design the event model](skills/cratis-modeling-design-event-model/SKILL.md).
- A slice to implement: [deliver a slice](skills/cratis-platform-deliver-slice/SKILL.md).
- A change that did not reach the screen: [diagnose a slice](skills/cratis-platform-diagnose-slice/SKILL.md).
- A change to a Cratis library or tool: [contribute a change](skills/cratis-platform-contribute-change/SKILL.md).

An installed copy of this directory is managed content. Change it through `cratis ai update`, not by editing the copy.
