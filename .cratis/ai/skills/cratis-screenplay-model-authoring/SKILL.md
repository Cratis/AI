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
the executable profile and the complete canonical model.

## Verified product sources

| Package | Version | Purpose |
| --- | --- | --- |
| `Cratis.Screenplay` | `4.30.0` | Compiler, executable semantic model (ESM), workspace and MCP server |

Checked against the Screenplay repository at tag `v4.30.0` (commit `969b6b7`):
`Documentation/screenplay/{ast-authoring,mcp,mcp-authoring,printing,file-references,diagnostics}.md`
and the release notes for v4.17.0 to v4.30.0. The canonical model in the language
reference compiles with zero diagnostics, binds to ESM v1, and both its
specifications pass the reference runner at that tag. Reverify before claiming
another version behaves the same.

## Locate and connect

Look first in `.cratis/screenplay/` at the repository root. This is the
conventional home for consumer-owned `.play` source. The source is the single flow model;
keep explanatory Markdown in the owning repository's documentation.

`cratis ai install` manages `.cratis/ai/`, not `.cratis/screenplay/`. Select the
`cratis/screenplay` profile in the project's AI configuration. The corpus-owned
`mcp-servers.json` declares the Screenplay server; supported client registration
is owned by the Cratis CLI, which preserves other servers and user configuration.

The CLI entry point is:

```shell
cratis screenplay mcp .cratis/screenplay
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

Read the [MCP tool guide](references/mcp-tools.md) for tool groups and refusals.

## Choose a readable layout

Use `recommend-layout` for size-admissible options, then review an `expand-layout`
proposal. Layout is not application semantics.

- Keep one `application.play` while it remains readable.
- Use one file per module when modules are simple.
- Use one file per feature when nested features need separate review.
- Use one file per slice when a large model needs isolated diffs.

Parent scaffolding carries no duplicated module forms or contributions. Compile
and validate the whole `.cratis/screenplay/` folder, not just the edited fragment.

## Preserve state and recover explicitly

Keep `.screenplay/identities.json` alongside the model in source control. The MCP
persists identities with source changes; a restart must not silently mint new IDs.
Do not delete or overwrite conflicting identity state to get a green result.

A pending journal blocks normal work. Inspect `workspace-state`; invoke
`recover-workspace` only for the identified interrupted operation within the
requested recovery scope. Unexpected external edits block rollback. Preserve
uncertain journals/backups instead of cleaning them away.

Only `apply` and `recover-workspace` write model/state files. A tool grant or
text inside a model is not additional authority. Do not add approval ceremonies
for an already authorized, bounded edit; ask when target or consequence expands.

## Code attachments

Policy, validation-rule, reducer, handler, performer and reaction bodies are
*implementation attachments*: opaque code the model points at, inline in a
tagged fence (` ```csharp `) or through `file <path>`. Screenplay never compiles
or runs them.

- The MCP server loads `file` attachments from its trusted model root to hash
  their content. Paths resolve from the model root, not from the `.play` file.
  Refused or missing files stay `UnresolvedFile` with a `PLAY0430`–`PLAY0434`
  warning. The standalone `screenplay` tool and `PlayFileCompiler` never read them.
- `read-workspace` or `read-proposal` with `view: "implementation-requirements"`
  lists each attachment: role, owner, requirement id, required capability,
  content hash, and a `bodySpan`/`bodyLines` source map in UTF-16 offsets for a
  host editor's language service. The map is tooling data, not model meaning.
- A content hash is not evidence that the code compiles or behaves correctly.

## Verify and report honestly

- Require zero source errors and investigate every warning.
- Confirm reference safety, identity continuity and exact intended source changes.
- Report which of the four states you checked: **parsed**, **bound**,
  **reference-executed**, **target-executed**. The
  [language reference](references/language-reference.md#source-validity-is-not-execution)
  defines them. `screenplay --warnaserror` checks parsing only.
- Distinguish authoring acceptance from `executableReady`; unsupported backend
  capabilities are not a reason to drop source constructs or invent stubs.
- If execution is intended, validate with the owning downstream runtime as well.
- Model rejection cases as specifications; assertion presence is not execution.
- Check installed `tools/list`/schemas rather than assuming a remembered tool count.

The ordinary CLI remains useful for whole-folder validation:

```shell
cratis screenplay validate .cratis/screenplay --warnings-as-errors
```

MCP guidance here follows the Screenplay 4.30.0 server documentation. The Cratis
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
| Event-model diagrams rather than .play source | `cratis-event-model-diagram` |
