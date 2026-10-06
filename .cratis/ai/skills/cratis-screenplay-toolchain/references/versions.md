# Versions and capabilities by tool (the only version table)

Every other Screenplay skill and reference points here instead of repeating a version
or a tool capability. When a tool changes, update this file first, then re-run the
example compile gate with both tools (see `verdicts.md`, "Example gate").

Pinned and re-verified against product source on 2026-10-07 (standalone Screenplay 4.68.0); the cratis CLI rows were
re-probed on cratis 3.28.2 and 3.28.3 (Screenplay 4.66.0 bundled in both). Facts marked
*source* were read with `git show <tag>:<path>`; facts marked *probed* were run against the
installed tool.

## Pin set

| Source | Pin | Notes |
| --- | --- | --- |
| Screenplay (language, compiler, standalone tool, MCP server) | **v4.68.0** (`79801bf`), published as `Cratis.Screenplay.Tool` 4.68.0 | 4.67.0 changed only the MCP model-root defaults (no project: `Documents/Screenplay`; with a project root: the folder holding the `.play` files, else `Source` or `src`, else `Screenplay`). 4.68.0 admits **ESM v7**: generated command values and responses bind and execute (decision 0026, `Semantics/Versions.cs`; `generated-responses-example.md`); the same compiler examples were recompiled on 4.68.0 with the same results as on 4.66.0. Most other behaviour below was probed on 4.63.1 (`7769dc4`) and re-checked on 4.66.0. 4.63.1 to 4.64.0 added only the `numbers exact` syntax (binding refuses it), the MCP roots fix from 4.63.2 and fence-registry plumbing. 4.65.0 adds the command named-rule `implementation` block and rejects `implementation` on concept rules, built-in property rules and whole-command `require`/`validate` bodies (a hints-only block binds as PLAY0268). 4.66.0 adds only an experimental VS Code repair bridge. `Semantics/Execution` is unchanged since 4.63.1. Example compile and the toolchain commands in this skill were run on 4.66.0 |
| cratis CLI | **v3.28.3** (`8b43fef`, Cratis/cli#260) | Bundles **Screenplay 4.66.0** (ESM v1 to v6; it does not bind ESM v7, so `generated` and `returns` report `PLAY0268` there), **Stage 4.24.2**, `Cratis.Arc.Screenplay` 22.50.5, Chronicle 19.32.0, Fundamentals 7.22.8, Generation 0.18.0 (`Directory.Packages.props` at the tag): otherwise as v3.28.2, so Screenplay behaviour is identical. `cratis render` no longer emits `CLI-RENDER-003`; an evolved event is reported with Stage's `STAGE-ESM-026` (`ScreenplayPlanning.cs` at the tag; probed). v3.28.2 (`141c499`, Cratis/cli#257, closes #253) bundled Stage 4.24.1 and the same Screenplay. Same compiler as the standalone tool, so the two agree on binding and diagnostics; they still differ on file-mode imports. v3.28.1 and earlier (including v3.28.0 and the probed v3.27.1) bundled Screenplay 4.60.1 and Stage 4.24.0 (ESM v1 to v5, MCP roots bug, false PLAY0285, Automation/Translate refused at binding) |
| Stage | **v4.24.2** (`32dcac4`, Cratis/Stage#205, closes #165) | Admits ESM v4: initial-revision events render as before, any evolved event and its dependent scope is refused with `STAGE-ESM-026`, historical typed-context references with `STAGE-ESM-025`; migration rendering is Stage#204 (needs Screenplay#71); v5 and later, including v7 (generated values and responses; tracked in Stage#201), stay `STAGE-ESM-016`; the Host runtime still refuses evolved events. The cratis CLI bundles it since 3.28.3; 3.28.2 bundled 4.24.1 (v4.24.1, `2cadf59`: below). Pins Screenplay 4.66.0, Arc 22.50.5 and Chronicle 19.32.0 for its own build and the sandbox host image (`cratis/chronicle:19.32.0-development`); admits ESM schema v1 to v3 at 4.24.1 (v4.24.0, `fa48546`, pinned Screenplay 4.60.0); bundled by cratis 3.28.2. 4.24.1 adds `STAGE-ESM-024` to the surface ledger only; no admission change. The scaffold profile is unchanged at 4.24.1: rendered apps use .NET 10, **Arc 22.25.0**, **Chronicle 19.8.1** and a React/Vite frontend scaffold (Components 4.14.0, Scene 4.2.0) |
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
| Version | 4.68.0 (this pin) | 3.28.3 or 3.28.2, bundling Screenplay 4.66.0 (3.28.1 and earlier bundled 4.60.1) |
| ESM admitted by the binder | v1 to v7 (v6: clocks, application triggers, captures, reactions, Automation and Translate slices; v7: generated command values and responses) | v1 to v6 (3.28.3 bundles 4.66.0, so `generated` and `returns` fail binding with `PLAY0268`), the binder of 4.66.0 (probed on 3.28.2: the Automation, Translate and capture examples of this corpus are `executableReady` over `cratis screenplay mcp`) |
| `numbers exact` | syntax parses; binding refuses (PLAY0268, `executableReady: false`). Absent from the grammar page; documented only in `diagnostics.md` (PLAY0508 to PLAY0513) | same (probed on 3.28.2; 3.27.1 reported PLAY0001 "Unexpected 'numbers'") |
| Cascade specs (a command spec listing events a reaction appends) | compiles | compiles on 3.28.2 (probed); before 3.28.2 reported a **false PLAY0285** (cli#242, still open on GitHub at the time of writing) |
| Imports in file mode | follows imports | still ignores imports, reports false unknown-name warnings (PLAY0165, cli#244, open; probed on 3.28.2): validate the folder |
| Used for | V1, V2, V3; MCP | `render`, `screenplay generate`, `prologue`, `run`; V1, V2 and V3 as well, since it bundles the same compiler |

**Routing rule.** With cratis 3.28.2 or later both tools compile and bind the same
models up to ESM v6 (the cratis bundle is Screenplay 4.66.0, the standalone pin 4.68.0), so either gives V1 to V3 for models up to v6; a model with generated values or responses (ESM v7) binds only with the standalone tool. Prefer the standalone tool when it is installed (file mode
follows imports); `cratis` is the route for rendering (V5), generation and Prologue. Projects
set up by `cratis ai install` register `cratis screenplay mcp`, which runs the bundled
compiler: on cratis 3.28.1 or earlier (all releases before 3.28.2) that is 4.60.1 and lags (ESM v5, false PLAY0285,
roots bug), so read `cratis --version` first. **Name the tool and its version with every
verdict**; a verdict from one tool does not carry to the other when their versions differ.

### Exact messages that tell the tools apart

Only binding (MCP or `render`) prints these; neither `screenplay <folder>` nor
`cratis screenplay validate` binds. *source*: `Semantics/Versions.cs`,
`SemanticModelBinder.Structure.cs`, `SemanticModelBinder.SliceMembers.cs`,
`SemanticModelBinder.Specifications.cs`.

| Construct | cratis before 3.28.2 (Screenplay 4.60.1) reported (PLAY0268) | 4.66.0 to 4.68.0, standalone and cratis 3.28.2 |
| --- | --- | --- |
| Automation or Translate slice | `Slice '<name>' of type '<type>' is not admitted by ESM v1.` | binds as ESM v6 |
| Reaction | `Reaction '<n>' requires portable occurrence and effect semantics.` | binds |
| Capture | `Capture '<n>' requires a portable compiled CDL plan.` | binds |
| Generated property, `returns` response, generated fixture or `then returns` | `PLAY0268` | `PLAY0268` on 4.66.0 and 4.67.0 (so on every cratis 3.28.x bundle); binds as ESM v7 from 4.68.0 (standalone only) |
| Clock, trigger or capture specification | `... which the executable model does not admit yet - clocks, application triggers and capture records are proposed for ESM v6 in decision 0022.` | binds |

The substring "is not admitted by ESM v1" still appears on 4.66.0 for constraints,
expressions and projection blocks that the binder cannot represent, so that text alone does
not prove an older compiler: read the construct it names. A v6 model that still fails binding
on 4.66.0 names a different construct, for example a reaction that reads a view before
producing directly (decision 0006).

## Standalone `screenplay` 4.68.0

| Fact | Value | Evidence |
| --- | --- | --- |
| V1 command | `screenplay <file.play or folder> --warnaserror --no-color`. No `validate` verb, no JSON output. Text lines `file(line,col): severity PLAYnnnn: message` and a summary `N file(s) compiled - E error(s), W warning(s)` | `--help`, probed |
| Exit codes | 0 pass; 1 on errors, on warnings with `--warnaserror`, or on a missing path. Warnings without `--warnaserror` exit 0; information never fails. **An empty folder prints "No .play files found beneath ..." and exits 0**: check the summary's file count | probed |
| File versus folder | file mode follows imports (`app.play` importing `Shared/*.play` compiled 2 files). A folder is one application | probed |
| MCP | `screenplay mcp <model-folder>` (fixed root) or `screenplay mcp` (dynamic root). Protocol `2025-06-18`; 29 tools (30 on hosts that advertise the MCP-Apps UI extension: adds `visualize-model`). Needs `notifications/initialized` before tool calls (otherwise -32600 "Initialize and send notifications/initialized before using tools."). Refuses symlinked paths ("Symbolic links and reparse points are not admitted"): pass a physical path (on macOS `/tmp` is a symlink) | source `McpToolCatalog.cs`, `McpConnection.cs`; probed on 4.63.1 |
| `read-workspace` views | `documents`, `semantics`, `eventContracts`, `diagnostics`, `executable-diagnostics`, `implementation-requirements`, `handler-intents`, `source-map`, `typed-contexts`, `executable-model`, `repairs`, and the event-source, event-stream and command-route views. `executable-model` returns `available:false` unless the model binds; when it binds it carries `modelRevision` (`rev1:<sha256>`), `languageVersion`, `semanticVersion` and `attachmentManifestRevision` | source `McpToolSchemas.cs`, `McpWorkspaces.Reading.cs` |
| Empty root | `state: "empty"`, `authoringAccepted: true`, PLAY0289 | probed |
| Pin of the roots bug | fixed (from 4.63.2); see "MCP roots bug" below | source `McpConnection.cs` |

## cratis 3.28.3 and 3.28.2 (Screenplay 4.66.0)

| Fact | Value | Evidence |
| --- | --- | --- |
| V1 command | `cratis screenplay validate <folder> --warnings-as-errors -o json-compact` | `--help`, probed |
| Exit codes | 0 pass; 5 errors (or warnings with `--warnings-as-errors`); 1 path missing **or no `.play` files**. Information never fails | probed |
| Output | JSON lines: a `diagnostics` array with `severity`, `code`, `message`, `location`, then either `{"path","files","diagnostics":N}` (N counts information too) or an error object. A passing folder run prints the file count | probed on 3.28.2 |
| File versus folder | file mode compiles one document and **ignores imports** (cli#244). Validate the folder | probed |
| MCP | `cratis screenplay mcp <root>`, or no argument inside a project: the server locates the model itself (existing `.play` files, else `Source/`/`src/`, else a new `Screenplay/` folder) unless `.cratis/ai.json` sets `mcpServers.screenplay.root`; 29 tools and the same `read-workspace` views as the standalone tool, including `event-sources`, `event-streams` and `command-routes` (probed on 3.28.2; the 4.60.1 bundle had no such views). Fails fast only when an explicitly configured root does not exist | source `ScreenplayMcpRoot.cs:20-37` |
| Render | `cratis render` binds with the bundled compiler first, then the bundled Stage (4.24.2 since 3.28.3; 4.24.1 in 3.28.2) admits; a v6 model reaches Stage and is refused whole with `STAGE-ESM-016` (probed on 3.28.2), and an evolved event is `STAGE-ESM-026` with no `CLI-RENDER-003` (probed on 3.28.3). See `renderable-subset.md` | source, probed |
| `prologue interpret` | no `--no-llm` flag; LLM resolution and `screenplay generate` flags were checked on 3.27.0 and are unchanged in 3.28.2 (`--help` shows no `--no-llm`; the Prologue and Screenplay generate sources have no diff between the tags) | source, probed |

## Event sources and streams

Declared since Screenplay v4.62.0 but not bound: PLAY0268, "not admitted by any supported
executable model (ESM) version yet" (Screenplay 4.68.0, `SemanticModelBinder.CommandProductions.cs`; the
highest admitted version is v7). Stage 4.24.0 and 4.24.1 admit ESM v1 to v3 and refuse with
STAGE-ESM-016; Stage 4.24.2 admits v4 and refuses v5 and later (v6 reactions and clocks, v7 generated values and responses) with STAGE-ESM-016 (4.24.1 also records the v6 members as rejected `STAGE-ESM-024` in its ledger; users still see STAGE-ESM-016). Details and trackers: `sources-and-streams.md`.

## MCP roots bug (4.63.1 and earlier; fixed in 4.63.2; not present in cratis 3.28.2)

A dynamic-root server (`screenplay mcp` with no folder) asks a roots-capable client for
`roots`, reads the wrong field and replies with an error whose `id` is `null`; real hosts
treat that as fatal. It happens right after `notifications/initialized`, before any tool
call, and only when the root is dynamic. **Passing `open-workspace.path` does not avoid
it.** Avoid it with a fixed root: `screenplay mcp <model-folder>`, `cratis screenplay mcp
<path>`, or `cratis screenplay mcp` inside a project with `.cratis/ai.json`; or use 4.63.2
or later. cratis before 3.28.2 bundled 4.60.1, which has the bug, so only the fixed-root
forms were safe there. Probed on cratis 3.28.2 (Screenplay 4.66.0): with a roots-capable
client and no fixed root, `cratis screenplay mcp` answers `initialize`, sends a well-formed
`roots/list` request, and serves `tools/list` (29 tools) after the client replies; no `id: null`
error appears. A fixed root is still the simplest way to avoid any host differences.
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
  the `--name` identity and the bundled compiler. **Never compare the MCP `modelRevision`
  with a render manifest.** Drift is detected by comparing successive `semanticRevision`
  values from renders made with the same name and inputs (probed on 3.28.2: the same model
  rendered as `Marina` and as `Harbour` gives different values). Unverified: whether 4.60.1
  and 4.66.0 produce byte-identical `rev1` values for the same v1 to v3 model.
- Source identity for a verdict is the commit plus the digest from
  the source-identity helper (`cratis-screenplay-modeling-lifecycle` `references/verdicts-and-modes.md` "Source identity"). Keep it apart from the MCP `modelRevision`.
- `description` and `documentation` never reach rendered code (Stage#178, open).

## Roadmap items that would change a verdict (all open at the pin)

Screenplay#377 (run specifications from MCP or the tool), #388 (completeness and lineage
report), #383 (identity for an `invokes` caller), #384 (`@pii` on identifiers, `@sensitive`
meaning), #379 (`visualize-model` counts reactions); Stage#79 (render Automation and
Translate slices), Stage#165 (admit ESM v4), Stage#197 (`@pii` identifier renders as
`[PII]` event source id); cli#242 (false PLAY0285 on the 4.60.1 bundle; fixed in effect by the 4.66.0 bundle but still open on GitHub), cli#243 (`validate --executable`),
cli#244 (file mode ignores imports), cli#245 (`render --check`). The standalone tool at
4.68.0 has only the compile command and `mcp` (no `test`; `screenplay --help` checked); the reference runner is library
only. Until these land, "specifications written" or "bound" is never "specifications
pass".

## Upgrade checklist

1. `screenplay --version`, `cratis --version`; note whether `cratis` bundles a newer
   Screenplay (then the routing rule collapses).
2. Update the pin table, the two-compiler table and the message table above.
3. Re-run the example compile gate with both tools; re-probe one binding example through
   MCP.
4. Check whether a `screenplay test` or `cratis screenplay test` exists (a V4 route).
