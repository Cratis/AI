# Screenplay session bundle {{version}}

Guidance that teaches a coding agent to read a Screenplay model and build slices from a build order, on
any stack. Inject it into the agent's session; do not copy it into the repository being built.

| Form | Start here | For |
| --- | --- | --- |
| Claude Code plugin | This folder (`.claude-plugin/plugin.json`) and `system-prompt.md` | `claude --plugin-dir <folder-or-zip> --append-system-prompt-file <folder>/system-prompt.md` |
| AGENTS.md | `AGENTS.md`, which links to `skills/` | Agents that read an instruction file and can open the files next to it |
| Session context | `context.md` | Any agent: one self-contained document for the system prompt or the first turn |

`bundle.json` describes the bundle: its schema version, version, the source commit, the forms, the
skills and a SHA-256 checksum for every file. The format and how to consume it are documented at
<https://github.com/Cratis/AI/blob/main/Documentation/screenplay-session-bundle.md>.

Stack guidance is not included: it comes from the build kit.
