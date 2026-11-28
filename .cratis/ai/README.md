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

## Profile selection

| Profile | For |
| --- | --- |
| `cratis/application` | Build an application on Cratis: model a business flow, implement its backend and UI slices, run and diagnose them. |
| `cratis/engineering` | Change a Cratis platform repository: follow its library contracts, verify the change and prepare the PR and release note. |

`cratis ai profiles list` lists all profiles because this catalog does not feature any. JSON (`--output json`) always lists all profiles. On CLI versions that support `--all`, it requests the full list explicitly; it is not needed with this catalog.

Select `cratis/v2/application` explicitly with `--profiles` for the mixed .NET and React walkthrough. Neither umbrella above composes it. For other applications, select `cratis/application` and the repository's languages; specialist profiles can be added by ID.

A profile named directly is selected even if its language filter does not match. Composed profiles are admitted only if they match a configured language, have no language filter, or are language-agnostic. Leaving languages unspecified does not filter composition. The installer copies the chosen skill directories, including their references, but does not install other skills just because they are linked. Rules are filtered separately by profile and language. See the [catalog](profile-catalog.json) for direct membership and composition.

## Where to start

- An empty directory: [start an application](skills/cratis-platform-start-application/SKILL.md).
- A business journey: [discover the timeline](skills/cratis-modeling-discover-timeline/SKILL.md), then [design the event model](skills/cratis-modeling-design-event-model/SKILL.md).
- A slice to implement: [deliver a slice](skills/cratis-platform-deliver-slice/SKILL.md).
- A stale screen or missing result, with the failing boundary unknown: [diagnose a slice](skills/cratis-platform-diagnose-slice/SKILL.md).
- A change to a Cratis library or tool: [contribute a change](skills/cratis-platform-contribute-change/SKILL.md).

An installed copy of this directory is managed content. Change it through `cratis ai update`, not by editing the copy.
