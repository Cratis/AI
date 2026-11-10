# Screenplay session bundle

The Screenplay session bundle teaches a coding agent to read a Screenplay model and build slices from a
build order, on any stack. A build loop such as `cratis build` or a Studio builder injects it into the
agent session, so the agent works correctly in a repository that has no Cratis AI guidance installed.
The bundle is never written into the repository being built.

The bundle is stack-neutral. It names no Cratis framework, language or database; the stack comes from
the build kit. A spec in `Source/ScreenplaySession` fails when a stack name appears in the guidance.

## Where it is published

Every release of this repository attaches two assets to its GitHub release:

| Asset | Contents |
| --- | --- |
| `screenplay-session.zip` | The bundle, with its files at the archive root |
| `screenplay-session.zip.sha256` | `<sha256>  screenplay-session.zip` |

The asset names never change, so both of these URLs work:

```text
https://github.com/Cratis/AI/releases/download/v<version>/screenplay-session.zip
https://github.com/Cratis/AI/releases/latest/download/screenplay-session.zip
```

Pin a version in a product and move it deliberately; use `latest` only for tools that should follow
the newest guidance. `gh release download v<version> --repo Cratis/AI --pattern 'screenplay-session.zip*'`
fetches both assets.

## Versions

| Field | Meaning |
| --- | --- |
| Release version (`version` in `bundle.json`) | The corpus release the bundle came from. It changes whenever the guidance changes. |
| `schemaVersion` | The layout and `bundle.json` contract, currently `1`. It changes only on an incompatible change. Refuse a bundle whose `schemaVersion` you do not know. |
| `screenplay.verifiedWith` | The standalone Screenplay version whose compiler and reference evaluator verified the example model in the bundle. |
| `source.commit` | The commit of `Cratis/AI` the bundle was built from. |

## Layout (schema version 1)

```text
bundle.json                  the manifest
README.md                    a short description of the forms
LICENSE                      MIT
system-prompt.md             Claude Code: text to append to the system prompt
.claude-plugin/plugin.json   Claude Code: the bundle root is a plugin named screenplay-session
skills/<skill>/SKILL.md      the skills, with their references/ files
AGENTS.md                    agents that read an instruction file and can open files next to it
context.md                   one self-contained document: the guide, every skill and every reference
```

The skills are `screenplay-language` (reading a model) and `screenplay-slice-building` (from an order to a
verified slice and an outcome report). `bundle.json` lists them with their paths.

`bundle.json`:

```json
{
  "schemaVersion": 1,
  "name": "screenplay-session",
  "version": "1.4.0",
  "source": { "repository": "https://github.com/Cratis/AI", "commit": "<sha>" },
  "screenplay": { "verifiedWith": "6.11.0" },
  "forms": {
    "claude-code": { "plugin": ".", "systemPrompt": "system-prompt.md" },
    "agents-md": { "instructions": "AGENTS.md" },
    "context": { "document": "context.md" }
  },
  "skills": [{ "name": "screenplay-language", "description": "...", "path": "skills/screenplay-language/SKILL.md" }],
  "files": [{ "path": "AGENTS.md", "sha256": "<hex>", "size": 3513 }]
}
```

`files` lists every file except `bundle.json` itself. Paths are relative to the bundle root and use `/`.
Read form paths from `forms` rather than hard-coding them.

## Fetch and verify

1. Download `screenplay-session.zip` and `screenplay-session.zip.sha256` for the pinned version.
2. Compare the archive's SHA-256 with the `.sha256` asset; refuse the bundle when they differ.
3. Extract into a cache outside every repository, for example
   `<user cache>/cratis/screenplay-session/<version>/`, and reuse it for later sessions.
4. Read `bundle.json`; refuse an unknown `schemaVersion`; optionally check each file against `files`.

## Inject it into a session

The build loop adds the order and the kit's instructions to the same session. It also hands over the
Screenplay tools (for example `cratis screenplay mcp <model-root>` as an MCP server) when it can; the
guidance uses them when present and reads the `.play` files when not.

### Claude Code

Claude Code loads a plugin from a directory or a `.zip` for one session only, so the archive itself can
be passed:

```bash
claude --plugin-dir <cache>/screenplay-session.zip \
  --append-system-prompt-file <cache>/<version>/system-prompt.md \
  -p "<kit instructions and build order>"
```

The skills appear as `screenplay-session:screenplay-language` and
`screenplay-session:screenplay-slice-building`. `--plugin-url <release asset URL>` also works, but it
skips the checksum verification above. With the Claude Agent SDK, pass the extracted folder as a local
plugin and append `system-prompt.md` to the preset system prompt.

### Agents over the Agent Client Protocol

The protocol has no system prompt, so the loop sends the guidance at the start of the first
`session/prompt`, before the order:

- For an agent that can read files through the client: a `resource_link` to `<cache>/<version>/AGENTS.md`,
  with reads allowed under `<cache>/<version>/` (AGENTS.md links to its skills by relative path).
- Otherwise: the text of `context.md` as a text block, or as an embedded `resource` when the agent
  advertises `embeddedContext`.

Pass Screenplay and Studio tools in `session/new` as `mcpServers`, never in the prompt.

### Any other agent or generator

Use `context.md` as the system prompt or as the first message. It needs no file access.

## Change the guidance

The guidance is authored in `Source/ScreenplaySession/content/`: `guide.md`, `README.md` and one folder
per skill. It is deliberately separate from `.cratis/ai/`, whose skills assume the Cratis stack and are
installed into Cratis repositories.

```bash
yarn workspace @cratis/ai-screenplay-session run test     # content and bundle specs
yarn workspace @cratis/ai-screenplay-session run bundle   # writes Source/ScreenplaySession/dist/
```

The specs check that:

- the guidance names no stack;
- every `screenplay` excerpt comes from `skills/screenplay-language/references/example.play`;
- that model compiles with `--warnaserror` and its specifications pass with the pinned Screenplay tool;
- relative links resolve;
- the bundle's manifest, forms and checksums are complete;
- the archive is reproducible.

The Publish workflow runs these specs on every pull request. On release, it builds the bundle with the
release version and attaches it to the GitHub release.
