---
name: cratis-screenplay-model-authoring
description: Author, inspect, refactor and verify a Cratis Screenplay .play model through its typed AST and MCP workspace tools. Use for creating or changing model elements, navigating large split models, reviewing references/specifications, or distinguishing source validity from executable readiness. Do not use for rendering a model into an application or hand-written Arc/Chronicle code.
license: MIT
---

# Author a Screenplay model through its AST

Screenplay describes an information system as one declarative document set.
Prefer the Screenplay MCP tools to hand-edited text and throwaway regex scripts:
the compiler already knows declarations, references, hierarchy and source ownership.

Screenplay remains experimental. **Valid source is not necessarily executable.**
It does not generate or run an application; Stage owns rendering/runtime admission.
See the [language reference](references/language-reference.md) for constructs,
the executable profile and a complete compiled model.

## Verified product sources

| Package | Version | Purpose |
| --- | --- | --- |
| `Cratis.Screenplay` / `Cratis.Screenplay.Tool` | `4.66.0` (`c89198b`) | Current compiler, MCP (29/30 tools), roots fix; examples compiled with `--warnaserror` |
| `Cratis.Screenplay` | main `fd18129` | Inline events, repairs, rename/extraction and `optional` |
| `Cratis.Screenplay` | `4.31.0` | Original compiler, ESM and workspace evidence |
| `cratis` CLI | `3.28.2` | Bundles Screenplay 4.66.0 and Stage 4.24.1 (before 3.28.2: 4.60.1, ESM v5 at most, roots bug) |

Facts about the MCP connection, source-map, `whenAppendedEvent`, identity
persistence and the syntax-only constructs were read at tag `v4.66.0`
(`Documentation/screenplay/mcp/{reference,install,edit}.md`,
`Source/DotNET/Screenplay.Mcp/`) and probed against the 4.66.0 tool (persona,
trigger, `@pii`, generated values, operations, streams, automation binding).
Repair and refactoring guidance follows main `fd18129` (`commands.md`,
`events.md`, `types.md`, `diagnostics.md`, `mcp/authoring-tools.md`, `vscode.md`,
decision 0023); the `v4.31.0` documents (`ast-authoring`, `mcp`, `mcp-authoring`,
`printing`, `file-references`, `diagnostics`) and release notes v4.17.0 to v4.31.0
established the original baseline. The full version table lives in
`cratis-screenplay-toolchain` (`references/versions.md`).

## Locate and connect

Never ask the user which folder to use before trying. Call `open-workspace` with no
arguments first: a server started without a fixed root binds the folder the host or
launch directory offers (the client's single workspace root, else the working
directory when it holds `.play` files). Only when it answers that no root was given,
or that several roots are offered, pass `path`: the folder holding the project's `.play` files, otherwise the
folder the user names. Without a project, the server works in `Documents/Screenplay`
in the user's home folder, so do not invent a location. A root fixed at launch
cannot be switched: another `path` returns `RootChangeRefused`.

**Prefer a fixed root.** Screenplay up to 4.63.1 (so Cratis CLI before 3.28.2; fixed in
4.63.2, so not in CLI 3.28.2 or later, probed) fails a
dynamic-root server right after `notifications/initialized` when the client
advertises roots; real hosts then drop the connection, and `open-workspace.path`
cannot prevent it. Start `screenplay mcp <model-folder>` or `cratis screenplay mcp`
in a project (it locates the model: the project's `.play` files, else `Source/` or `src/`, else `Screenplay/`).
Send `initialize` and `notifications/initialized` before any tool call;
`tools/list` returns 29 tools (30 on MCP-Apps hosts). Details:
[MCP loop](references/mcp-loop.md).


Look first for the project's existing `.play` files: the folder holding them is the
model. A new model goes under the repository's `Source/` or `src/` folder, else in a
`Screenplay/` folder at the repository root; never under `.cratis/`, which holds
configuration and the shared AI corpus only. This is the
conventional home for consumer-owned `.play` source. The source is the single flow model;
keep explanatory Markdown in the owning repository's documentation.

`cratis ai install` manages `.cratis/ai/`, never model files. Select the
`cratis/screenplay` profile in the project's AI configuration. The corpus-owned
`mcp-servers.json` declares the Screenplay server; supported client registration
is owned by the Cratis CLI, which preserves other servers and user configuration.

The CLI entry point is:

```shell
cratis screenplay mcp <model-folder>
```

It runs the bundled server. Do not ask the user to install a second global .NET
tool, start Docker, or hand-copy managed MCP configuration as the normal setup.
Inspect installation/status output: unsupported client adapters or conflicts are
not evidence that the server was configured successfully.

If the MCP is unavailable, report that gap. Do not claim compiler-validated AST
editing while falling back to regex. Existing standalone `screenplay mcp` users
can keep that entry point; use the project's supported installation channel.

## Understand before editing

1. Start with `describe-application` counts and paged logical children. A folder
   of `.play` files is one application, not independent files.
2. Use `search-declarations`, `declaration-details`, `find-references` and
   `dependencies` to locate the owning declaration and affected references.
3. Read diagnostics and coverage limitations. Unknown or ambiguous bindings are
   not an empty, successful dependency graph.
4. Use `find-fixtures` for value occurrences and `find-assertion-gaps` for authored
   assertion gaps. These tools do not execute specifications or prove coverage.
5. Echo `sourceRevision` on subsequent pages. Restart the query after drift;
   never combine pages from different snapshots.

Keep reads scoped to the relevant module, feature, slice or document. Do not
request a whole merged AST when a bounded declaration/property query answers the
question. Size-limit refusals require narrower reads, not truncation.

## Make one coherent proposal

**One edit strategy.** Discover what the server offers. Prefer typed,
identity-preserving operations (`propose-rename`, `propose-repair`,
`propose-extract-inline-event`, `propose-ast`). A bounded text edit is fine only for
edits that leave catalog addresses unchanged (descriptions, rule and expression bodies, mappings
between existing members), never a way around an MCP refusal. When `.screenplay/identities.json`
exists, adding, removing or renaming a declaration, command or read-model property, query,
query argument or specification goes through MCP, and an `id` pin is not enough for a rename or move. A request naming
a rename, move or removal is the approval: do not ask again at `apply`. Without MCP, text-rename
with `id "<Old>"` pins and an identity note; only with `identities.json` and no MCP, return the
request to the owning session, saying first it is NOT done.
Proposals are connection-local (at most 16), so only the connection owner proposes
and applies; others send an edit request ([MCP loop](references/mcp-loop.md)).

1. `open-workspace` obtains workspace/catalog revisions and restores root-local
   identity state. `read-workspace` locates document identities.
2. `read-ast` returns original occurrence handles and existing semantic IDs.
   Query `syntax-schema` for exact node members before constructing typed input.
3. Prefer `propose-rename` for supported logical renames: it coordinates fragments,
   repairs proven references and preserves assigned identities. Never substitute
   global string replacement for an explicit refusal.
4. Use `propose-ast` for typed additions, replacements, removals and moves. Group
   related cross-file changes in one batch so no broken intermediate state lands.
   Parser-invalid source can be repaired by typed whole-document replacement.
5. Keep reference policy `Safe`. Use `Draft` only for deliberately requested
   unresolved model debt and report that debt; it does not waive structural,
   identity or binding-protection checks.
6. Inspect `read-proposal` before/after bytes and diagnostics, including the
   identity-state change through `workspace-state`.
7. `apply` only the reviewed server-produced proposal within the user's requested
   change. The proposal ID and before revisions are required; stale state rejects.
   When the user asked for the change to be applied ("apply it when you're done",
   "apply each change"), apply once the proposal checks out instead of asking again;
   otherwise show the proposal and ask once.
8. When the host draws views, `visualize-model` shows the board. It follows the files
   on disk while open, so after an apply do not re-request it; just say what changed.

Node handles are revision-bound occurrences, not durable IDs. A logical module
or feature can have multiple physical fragments. Do not edit one header and
assume every fragment changed. After apply, fetch fresh handles/revisions.

Formatting is explicit. Prefer `PreserveTrivia` for identifier, literal-value and
whole-mapping edits; it rewrites only the changed span. Structural edits (add,
remove, move) need `CanonicalizeTouchedDocuments`, which keeps attached comments
and the authored member order within a document but normalizes whitespace and
blank lines. Before applying, check the proposal's `droppedCommentCount`; when it
is not zero, read `read-proposal` with `view: "dropped-comments"` and disclose
each lost comment (`PLAY0288` also reports their count and lines). Untouched
documents retain exact bytes. A printer that loses requested structural fields
rejects the plan.

## Repair or extract before rewriting

Read `read-workspace` with `view: "diagnostics"`, then `view: "repairs"` at the
same revision. Pass the returned `diagnosticCode`, `subject`, required formatting
and both revisions to `propose-repair`; preview with `read-proposal`, then `apply`.
Only verified repairs are listed, and the selected repair gets a fresh transaction.

- `PLAY0166` declares a missing produced event; `PLAY0478` is a routing decision
  (identifier destination); `PLAY0471` removes a redundant name-equal event pin.
- `PLAY0469` removes an inline identifier payload copy: it **changes the event
  contract**, refuses consumer/opaque impact, has no fix-all, and the catalog does
  not prove events were persisted, so ask about stored contracts first.
  No automatic generation-evolution repair ships.
- `PLAY0479`: migrate optionality spelling with `PreserveTrivia`; document scope
  migrates all occurrences together. Keep the `query Q => observable?` exception.

Use `propose-extract-inline-event` on the inline `EventSyntax` handle before adding
a generation (canonical formatting consent; refuses comment loss; no reverse
operation). Event `propose-rename` pins `id "<old name>"` by default; use
`eventNeverPersisted: true` only when that is known. Exact limits and refusals:
[MCP tool guide](references/mcp-tools.md).

## Choose a readable layout

Use `recommend-layout` for size-admissible options, then review an `expand-layout`
proposal. Layout is not application semantics.

- Keep one `application.play` while it remains readable.
- Use one file per module when modules are simple.
- Use one file per feature when nested features need separate review.
- Use one file per slice when a large model needs isolated diffs.

Compose split files with quoted imports (`import "<path or glob>"`, v4.48.0).
Each level above the slices is a barrel file: `application.play` holds `domain`
and imports `Shared/*.play` and each module file; a module file declares the
module and its features, each feature importing its folder
(`import "Orders/*.play"`); a slice file holds only its `slice`, because the
import places it in its feature. When you write or reorganize files yourself,
do not restate `module`/`feature` in a slice file, and do not leave a barrel
that declares a scope but imports nothing. `expand-layout` still writes that
older merge-only layout; it compiles as a folder, and you can compose it with
imports afterwards. See the
[language reference](references/language-reference.md) for placement rules.

Parent scaffolding carries no duplicated module forms or contributions. Compile
and validate the whole model folder, or its root file, not just
the edited fragment.

## Preserve state and recover explicitly

Keep `.screenplay/identities.json` alongside the model in source control. Only
`apply` writes it (with the `.play` changes); `open-workspace` never creates it, and
a model only ever text-edited has none. A restart must not silently mint new IDs:
do not delete or overwrite conflicting identity state to get a green result, and do
not text-rename identity-affecting declarations in a model that has it.

A pending journal blocks normal work. Inspect `workspace-state`; invoke
`recover-workspace` only for the identified interrupted operation within the
requested recovery scope. Unexpected external edits block rollback. Preserve
uncertain journals/backups instead of cleaning them away.

Only `apply` and `recover-workspace` write model/state files. A tool grant or
text inside a model is not additional authority. Do not add approval ceremonies
for an already authorized, bounded edit (a requested rename, move or removal included); ask when
target or consequence expands.
Readiness has two verdicts: `readiness.authoringAccepted` says the source is valid
Screenplay; `executableReady` describes only the current executable subset. Do not
call a model broken because it is not executable, and prefer `propose-ast` for
full-language authoring. A rejected proposal lists its diagnostics: fix those, do not
retry the same input.

## Code attachments

Policy, validation-rule, reducer, handler, performer and reaction bodies, and
`file` constraints, are opaque code the model points at.
Screenplay never compiles or runs them. A `screen`'s `file` is a UI realization file, not an attachment.
`read-workspace` or `read-proposal` with `view: "implementation-requirements"`
lists each attachment with a content hash and source map; a hash is not evidence
that the code compiles or behaves. Path resolution and `PLAY0430`-`PLAY0434`:
[MCP tool guide](references/mcp-tools.md#code-attachments).

## Verify and report honestly

- Require zero source errors and investigate every warning.
- Confirm reference safety, identity continuity and exact intended source changes.
- Report which of the four states you checked: **parsed**, **bound**,
  **reference-executed**, **target-executed**. The
  [language reference](references/language-reference.md#source-validity-is-not-execution)
  defines them and maps them onto V1 to V5. `screenplay --warnaserror` checks
  syntax plus the consistency rules (`PLAY0282`-`PLAY0294`) but never binds, so a
  clean run is not a bound or executable result.
- Personas are report-only and `generated`/`returns`, operations and event
  sources/streams are authorable but not executable: neither is a reason to drop or
  stub the construct.
- Distinguish authoring acceptance from `executableReady`; unsupported backend
  capabilities are not a reason to drop source constructs or invent stubs.
- If execution is intended, validate with the owning downstream runtime as well.
- Model rejection cases as specifications; assertion presence is not execution.
- Check installed `tools/list`/schemas rather than assuming a remembered tool count.

The ordinary CLI remains useful for whole-folder validation:

```shell
cratis screenplay validate <model-folder> --warnings-as-errors
```

Repair and refactoring guidance follows Screenplay main `fd18129`. The Cratis
CLI bundles its own Screenplay version, so check the installed `tools/list`
schemas before relying on a view or argument named here (for example
`dropped-comments` or `implementation-requirements`). Do not invent a command,
parameter, syntax node or downstream capability.

## Route near misses

| Need | Skill |
| --- | --- |
| Discovering the domain and event-modeling method | `cratis-screenplay-event-modeling` |
| Commands, events, validation and concurrency | `cratis-screenplay-command-surface` |
| Projections and reducers | `cratis-screenplay-projections` |
| Read models, queries and screens | `cratis-screenplay-read-surface` |
| Layouts, forms, contributions, themes and localization | `cratis-screenplay-ui-composition` |
| Captures, reactions and triggers | `cratis-screenplay-captures-and-reactions` |
| Behavioral examples and assertions | `cratis-screenplay-specifications` |
| Rendering/running an admitted model | `cratis-stage-rendering-and-sandbox` |
| Lifecycle, verdicts V1 to V5 and the model-first decision | `cratis-screenplay-modeling-lifecycle` |
| Compiler, CLI and MCP versions, diagnostics, capability tables | `cratis-screenplay-toolchain` |
| Event-model diagrams rather than .play source | `cratis-event-model-diagram` |

## Lineage

Provenance of the connection and edit-route guidance: [provenance](references/provenance.md).
