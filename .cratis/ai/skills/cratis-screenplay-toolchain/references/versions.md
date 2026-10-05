# Versions and capabilities by tool (the only version table)

Every other Screenplay skill and reference points here instead of repeating a version
or a tool capability. When a tool changes, update this file first, then re-run the
example compile gate with both tools (see `verdicts.md`, "Example gate").

Pinned and re-verified against product source on 2026-10-05. Facts marked *source* were
read with `git show <tag>:<path>`; facts marked *probed* were run against the installed
tool.

## Pin set

| Source | Pin | Notes |
| --- | --- | --- |
| Screenplay (language, compiler, standalone tool, MCP server) | **v4.64.0** (`7e16162`), published as `Cratis.Screenplay.Tool` 4.64.0 | Most behaviour below was probed on 4.63.1 (`7769dc4`). The 4.63.1 to 4.64.0 diff adds only the `numbers exact` syntax (binding refuses it), the MCP roots fix from 4.63.2 and fence-registry plumbing; `Semantics/Execution` is unchanged. Example compile and the toolchain commands in this skill were run on 4.64.0 |
| cratis CLI | **v3.27.1** (`a327e89`) | Bundles **Screenplay 4.60.1** (ESM v1 to v5, MCP roots bug, false PLAY0285), **Stage 4.24.0**, `Cratis.Arc.Screenplay` 22.50.2, Generation 0.18.0 |
| Stage | **v4.24.0** (`fa48546`) | Pins Screenplay 4.60.0; admits ESM schema v1 to v3. Rendered apps use .NET 10, **Arc 22.25.0**, **Chronicle 19.8.1** and a React/Vite frontend scaffold (Components 4.14.0, Scene 4.2.0) |
| Arc | **v22.50.5** (`eefd098`) | `[ExecuteCommandsAsSystem]` since v20.56.0; `[ProtectedDecision]` and `DecisionRead<T>` since v22.39.0. A Stage-rendered application is on 22.25.0, so `[ProtectedDecision]` is **not** available there |
| Chronicle | **v19.32.0** (`f17a2ff`) | CHR0012 (`EventTypeShouldAvoidNullableProperties`) and CHR0034 (`PiiOnEventSourceId`) exist. Open runtime defects at v19.32.0: #3744 (unique claims not settled by the store on SQL and InMemory), #4123 (constraint index updates run after commit and fail silently), #4131 (composite unique constraints collide when a component contains the separator) |

Install or update the standalone tool: `dotnet tool update -g Cratis.Screenplay.Tool`
(first install: `dotnet tool install -g Cratis.Screenplay.Tool`). Check what is on the
machine before relying on any row: `screenplay --version`, `cratis --version`, and MCP
`initialize` -> `serverInfo.version`. A stale `cratis` earlier on `PATH` (for example a
global `dotnet` tool) shadows a newer one; confirm with `which -a cratis`.

## Two compilers, one rule

| | Standalone `screenplay` | `cratis screenplay ...` |
| --- | --- | --- |
| Version | 4.64.0 (this pin) | 3.27.1, bundling Screenplay 4.60.1 |
| ESM admitted by the binder | v1 to v6 (v6: clocks, application triggers, captures, reactions, Automation and Translate slices) | v1 to v5 only |
| `numbers exact` | syntax parses; binding refuses (PLAY0268). Absent from the grammar page; documented only in `diagnostics.md` (PLAY0508 to PLAY0513) | PLAY0001 "Unexpected 'numbers'" |
| Cascade specs (a command spec listing events a reaction appends) | compiles | **false PLAY0285** (cli#242, open) |
| Imports in file mode | follows imports | ignores imports, reports false unknown-name warnings (PLAY0165, cli#244, open): validate the folder |
| Used for | V1, V2, V3 on the current language; MCP | `render`, `screenplay generate`, `prologue`, `run`; V1 fallback when the standalone tool is absent |

**Routing rule.** Verdicts V1 to V3 on the current language come from the standalone tool
when it is installed. `cratis` is the route for rendering (V5) and the fallback for V1.
Projects set up by `cratis ai install` register `cratis screenplay mcp`, which runs the
bundled 4.60.1 compiler: expect lagging diagnostics there. **Name the tool and its version
with every verdict**; a verdict from one tool does not carry to the other.

### Exact messages that tell the tools apart

Only binding (MCP or `render`) prints these; neither `screenplay <folder>` nor
`cratis screenplay validate` binds. *source*: `Semantics/Versions.cs`,
`SemanticModelBinder.Structure.cs`, `SemanticModelBinder.SliceMembers.cs`,
`SemanticModelBinder.Specifications.cs`.

| Construct | cratis 3.27.1 (Screenplay 4.60.1) reports (PLAY0268) | Standalone 4.64.0 |
| --- | --- | --- |
| Automation or Translate slice | `Slice '<name>' of type '<type>' is not admitted by ESM v1.` | binds as ESM v6 |
| Reaction | `Reaction '<n>' requires portable occurrence and effect semantics.` | binds |
| Capture | `Capture '<n>' requires a portable compiled CDL plan.` | binds |
| Clock, trigger or capture specification | `... which the executable model does not admit yet - clocks, application triggers and capture records are proposed for ESM v6 in decision 0022.` | binds |

The substring "is not admitted by ESM v1" still appears on 4.64.0 for constraints,
expressions and projection blocks that the binder cannot represent, so that text alone does
not prove the older compiler: read the construct it names.

## Standalone `screenplay` 4.64.0

| Fact | Value | Evidence |
| --- | --- | --- |
| V1 command | `screenplay <file.play or folder> --warnaserror --no-color`. No `validate` verb, no JSON output. Text lines `file(line,col): severity PLAYnnnn: message` and a summary `N file(s) compiled - E error(s), W warning(s)` | `--help`, probed |
| Exit codes | 0 pass; 1 on errors, on warnings with `--warnaserror`, or on a missing path. Warnings without `--warnaserror` exit 0; information never fails. **An empty folder prints "No .play files found beneath ..." and exits 0**: check the summary's file count | probed |
| File versus folder | file mode follows imports (`app.play` importing `Shared/*.play` compiled 2 files). A folder is one application | probed |
| MCP | `screenplay mcp <model-folder>` (fixed root) or `screenplay mcp` (dynamic root). Protocol `2025-06-18`; 29 tools (30 on hosts that advertise the MCP-Apps UI extension: adds `visualize-model`). Needs `notifications/initialized` before tool calls (otherwise -32600 "Initialize and send notifications/initialized before using tools."). Refuses symlinked paths ("Symbolic links and reparse points are not admitted"): pass a physical path (on macOS `/tmp` is a symlink) | source `McpToolCatalog.cs`, `McpConnection.cs`; probed on 4.63.1 |
| `read-workspace` views | `documents`, `semantics`, `eventContracts`, `diagnostics`, `executable-diagnostics`, `implementation-requirements`, `handler-intents`, `source-map`, `typed-contexts`, `executable-model`, `repairs`, and the event-source, event-stream and command-route views. `executable-model` returns `available:false` unless the model binds; when it binds it carries `modelRevision` (`rev1:<sha256>`), `languageVersion`, `semanticVersion` and `attachmentManifestRevision` | source `McpToolSchemas.cs`, `McpWorkspaces.Reading.cs` |
| Empty root | `state: "empty"`, `authoringAccepted: true`, PLAY0289 | probed |
| Pin of the roots bug | fixed (from 4.63.2); see "MCP roots bug" below | source `McpConnection.cs` |

## cratis 3.27.1 (Screenplay 4.60.1)

| Fact | Value | Evidence |
| --- | --- | --- |
| V1 command | `cratis screenplay validate <folder> --warnings-as-errors -o json-compact` | `--help`, probed |
| Exit codes | 0 pass; 5 errors (or warnings with `--warnings-as-errors`); 1 path missing **or no `.play` files**. Information never fails | probed |
| Output | JSON lines: a `diagnostics` array with `severity`, `code`, `message`, `location`, then either `{"path","files","diagnostics":0}` or an error object. A passing folder run prints the file count | probed on 3.27.1 |
| File versus folder | file mode compiles one document and **ignores imports** (cli#244). Validate the folder | probed |
| MCP | `cratis screenplay mcp <root>`, or no argument inside a project whose `.cratis/ai.json` resolves the fixed `defaultRoot` `.cratis/screenplay`; 29 tools, no event-source, stream or route views. Fails fast when `.cratis/screenplay/` does not exist | source `ScreenplayMcpRoot.cs:20-37` |
| Render | `cratis render` binds with the bundled compiler first, then Stage 4.24.0 admits. See `renderable-subset.md` | source |
| `prologue interpret` | no `--no-llm` flag; LLM resolution and `screenplay generate` flags were checked on 3.27.0 | source |

## MCP roots bug (4.63.1 and earlier; fixed in 4.63.2)

A dynamic-root server (`screenplay mcp` with no folder) asks a roots-capable client for
`roots`, reads the wrong field and replies with an error whose `id` is `null`; real hosts
treat that as fatal. It happens right after `notifications/initialized`, before any tool
call, and only when the root is dynamic. **Passing `open-workspace.path` does not avoid
it.** Avoid it with a fixed root: `screenplay mcp <model-folder>`, `cratis screenplay mcp
<path>`, or `cratis screenplay mcp` inside a project with `.cratis/ai.json`; or use 4.63.2
or later. The bundled 4.60.1 has the bug, so only the fixed-root forms are safe there.
MCP loop procedure and proposals: `cratis-screenplay-model-authoring`.

## Revisions and descriptions

- `modelRevision` exists only when the model binds; design-only models have none. It is stable
  across reopens, but it **changes when the root folder is renamed** and no
  `.screenplay/identities.json` exists, because the application identity is bootstrapped
  from the root. A file move changes it only if it changes logical placement or application
  identity. It is computed from canonical semantic JSON (descriptions and source locations live
  in the separate source map), so line positions and description edits do not change it. A
  workspace or source revision can change without a `modelRevision` change. Re-read after every edit.
- `cratis render` records its own `semanticRevision` in `.cratis-render.json`, computed with
  the `--name` identity and the 4.60.1 compiler. **Never compare the MCP `modelRevision`
  with a render manifest.** Drift is detected by comparing successive `semanticRevision`
  values from renders made with the same name and inputs. Unverified: whether 4.60.1 and
  4.64.0 produce byte-identical `rev1` values for the same v1 to v3 model.
- Source identity for a verdict is the commit plus a hash of the relevant dirty and
  untracked files and attachments. Keep it apart from the MCP `modelRevision`.
- `description` and `documentation` never reach rendered code (Stage#178, open).

## Roadmap items that would change a verdict (all open at the pin)

Screenplay#377 (run specifications from MCP or the tool), #388 (completeness and lineage
report), #383 (identity for an `invokes` caller), #384 (`@pii` on identifiers, `@sensitive`
meaning), #379 (`visualize-model` counts reactions); Stage#79 (render Automation and
Translate slices), Stage#165 (admit ESM v4), Stage#197 (`@pii` identifier renders as
`[PII]` event source id); cli#242 (false PLAY0285), cli#243 (`validate --executable`),
cli#244 (file mode ignores imports), cli#245 (`render --check`). The standalone tool at
4.64.0 has only the compile command and `mcp` (no `test`); the reference runner is library
only. Until these land, "specifications written" or "bound" is never "specifications
pass".

## Upgrade checklist

1. `screenplay --version`, `cratis --version`; note whether `cratis` bundles a newer
   Screenplay (then the routing rule collapses).
2. Update the pin table, the two-compiler table and the message table above.
3. Re-run the example compile gate with both tools; re-probe one binding example through
   MCP.
4. Check whether a `screenplay test` or `cratis screenplay test` exists (a V4 route).
