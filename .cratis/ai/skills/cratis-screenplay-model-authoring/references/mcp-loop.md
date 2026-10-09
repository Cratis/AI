<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# The Screenplay MCP loop

## Contents

- Connect
- Who owns the connection
- The loop
- One edit strategy
- Identity state (`.screenplay/identities.json`)
- Read-only views worth knowing
- Failures (use `failureKind`, never message text)
- Provenance

The working loop for the session that owns the model connection: connect, orient,
choose an edit route, propose, review, apply, verify. Tool-by-tool arguments and
refusals are in the [MCP tool guide](mcp-tools.md); verdict names (V1 to V5) are
defined by `cratis-screenplay-modeling-lifecycle`. Facts here were read at
Screenplay v4.66.0 (`Source/DotNET/Screenplay.Mcp/`, `Documentation/screenplay/mcp/`)
and probed against the standalone 4.66.0 tool and, for the connection behavior,
4.63.1. Cratis CLI 3.28.2 bundles Screenplay 4.66.0 (probed: 29 tools and the same views);
Cratis CLI before 3.28.2 bundled 4.60.1, whose tool set and views differ: read `tools/list`.

## Connect

1. Launch with a **fixed root**: `screenplay mcp <model-folder>`, or
   `cratis screenplay mcp <model-folder>`, or `cratis screenplay mcp` inside a
   project, where the CLI locates the model (the project's `.play` files, else `Source/`
   or `src/`, else a new `Screenplay/` folder; what the `cratis/screenplay` profile registers). Stdio, newline-delimited
   JSON-RPC, one sequential connection.
2. Send `initialize`, then the `notifications/initialized` notification, **before
   any tool call**. Earlier calls fail with `-32600` "Initialize and send
   notifications/initialized before using tools".
3. Pass a physical path. Symbolic links and reparse points are refused, including
   `.screenplay` metadata.
4. `tools/list` returns **29 tools**, or **30 on hosts that advertise the MCP-Apps
   UI extension** (the extra tool is `visualize-model`). Read the schemas once per
   connection; never hard-code a count or an argument list.
5. A root given at startup is fixed for the connection: `open-workspace.path` may
   name the same directory, anything else returns `RootChangeRefused`. Start a
   separately authorized connection to model another application.

### Roots bug and the workaround

Screenplay up to 4.63.1 (fixed in 4.63.2; the 4.66.0 tool is fixed) read the
client's roots reply from the wrong member. A server started **without** a root,
facing a client that advertises roots, answered with an error with `id: null`
immediately after `notifications/initialized`, before any tool call. Real hosts
treat that as fatal and drop the connection. Passing `open-workspace.path` does
**not** avoid it, because the error is sent before `open-workspace` runs.

Avoid it by fixing the root at launch (the forms in step 1). The `cratis/screenplay`
profile registration is not affected in an installed project, and the CLI now locates the model itself, so no model directory has to exist. Cratis CLI before 3.28.2 bundled 4.60.1: for a
dynamic root there, fix the root. Cratis CLI 3.28.2 bundles 4.66.0, which is fixed (probed:
the server sends `roots/list` and serves `tools/list` after the reply).

## Who owns the connection

- **Proposals are connection-local.** They live in memory, at most **16**
  outstanding (`LimitExceeded`); `open-workspace`, a successful `apply` and a root
  change clear them. A proposal id means nothing in another process, another
  session or after a reopen.
- **One owner** (normally the main session) holds the connection and does
  open, propose, review, approval, `apply`. Only `apply` and `recover-workspace`
  write.
- **Non-owners** (reviewers, renderers, explainers, subagents without MCP) never
  return proposal ids. They return a bounded **edit request**; the owner
  re-proposes it on its own connection:

  ```text
  root: <model root>
  beforeRevision / catalogRevision: <the values read>
  target: <qualified address and kind>
  change: <text diff or typed intent>
  rationale: <why>
  expected impact: <diagnostics, identity effect, specifications>
  ```

- Read-only orientation (`describe-application`, `search-declarations`,
  `diagnostics`, and `read-workspace` views) is fine from any session that has its
  own short-lived connection.
- Discover capabilities once per session (tool, version, `tools/list` schemas,
  root, configuration) and reuse them. Refresh when the root, tool, version or
  configuration changes or a call fails. Never reuse a stale revision, catalog
  revision, handle or proposal.
- Identify a declaration by its qualified address (module, feature, slice, name)
  and load only that scope plus what it depends on. Do not keep a duplicate JSON
  copy of the model. Bind every edit request and proposal to the revision you read.

## The loop

1. `tools/list` once per connection.
2. Orient cheaply: `describe-application` summary, `diagnostics`, then scoped
   `search-declarations`, `declaration-details`, `dependencies`. Paging with
   `offset > 0` requires `expectedSourceRevision`.
3. `open-workspace` and keep `revision` and `catalogRevision`. Opening writes
   nothing. With `identityPersistence: "root-local-on-apply"` the identities file
   is written only by `apply`.
4. Choose the edit route (next section). For typed edits: `syntax-schema` for the
   node kind, then `read-ast` with `includeContent` for revision-bound handles.
   Never invent a handle.
5. Propose one coherent change (a slice works best): `propose-ast` with
   `validation: "Authoring"`, `referencePolicy: "Safe"` (`Draft` only for
   deliberate, reported gaps), `formatting: "PreserveTrivia"` for value and mapping
   patches, otherwise `CanonicalizeTouchedDocuments` (reprints the touched files).
6. Review: `read-proposal` (`view` changes, then before/after per document, then
   `dropped-comments`), `introducedExecutableErrors`, `droppedCommentCount`. On
   MCP-Apps hosts `visualize-model` with the `proposalId` shows Current and
   Proposed, and its `sketch` argument previews a what-if of whole documents
   without writing. An
   unintended executable regression is discarded (`discard-proposal`) and
   re-proposed. Intent the user has accepted that does not run yet (`system`/`operation`, `eventsource`/`stream`, and `generated`/
   `returns` on a tool older than 4.68.0; `PLAY0268` by design)
   may be applied from a reviewed `Authoring` proposal: disclose the new
   diagnostics, report V3 as not binding-ready, and never drop or stub the
   construct. The server's own guidance is to apply such a proposal only when
   the user accepts a model that does not run yet.
7. Get approval unless the user already approved this effect and target (ask again
   only when target or consequence expands). A request or brief that names a rename,
   move or removal is that approval, also unattended: do not ask again per apply. Then `apply` with the **before**
   revisions. Every old handle and proposal is gone afterwards: re-read at the new
   revision.
8. Verify: compile the whole folder (V1), read `executable-diagnostics` (V2,
   V3), naming the tool and version. Hand off to the verdict vocabulary; do not
   restate a state you did not run.

## One edit strategy

1. **Discover** what the installed server offers (`tools/list`, `repair-capabilities`).
2. **Prefer typed, identity-preserving operations**: `propose-rename` for renames
   (keeps `id` pins and assigned identities, refuses on ambiguity),
   `propose-repair`, `propose-extract-inline-event`, `propose-ast` for additions,
   replacements, removals and moves.
3. **Bounded text edits** are fine only where no catalog address changes (table below). With
   `.screenplay/identities.json`, adding, removing or renaming a declaration, a property of a
   command, event, read model, composite type or trigger, a query, a query argument or a
   specification changes addresses; creating, deleting, renaming or moving a mapped `.play` file
   changes the document mappings (`IdentityMappingConflict` at reopen).
   A text edit is **never** a way around a refusal: if a typed operation refused,
   change the request or ask, do not retype the file.
4. **`id` pins alone are not enough when `.screenplay/identities.json` exists.**
   A text rename plus an `id "<old name>"` pin protects the stored event type
   name but leaves the identity catalog pointing at the old declaration; the next
   `apply` can mint new identities silently. Use the identity-preserving operation.
5. **A session without MCP** (a subagent, or a harness with no server) carries out a
   requested rename by text with `id "<Old>"` pins and an identity note when no
   `.screenplay/identities.json` exists. When it exists, it does not edit
   catalog-changing declarations by text: it returns the edit request above to the
   owning session, and its report says first that the requested change is NOT done.

| Edit class | Examples | Route |
| --- | --- | --- |
| Address-preserving | descriptions; bodies of rules and expressions; mappings between members that already exist; any edit that adds, removes or renames no addressed element. Also every edit in a model with no `.screenplay/identities.json` except persisted names | bounded text edit of the `.play` file, then compile the folder; or `propose-ast` |
| Catalog-changing (identity file present) | add, remove or rename a declaration (slice, command, event, read model, projection, ...), a property of a command, event, read model, composite type or trigger, a query, a query argument or a specification; create, delete, rename or move a mapped `.play` document (McpState refuses reopening with `IdentityMappingConflict`; use document operations in `propose-ast`); rename, remove or move an event, command, read model, constraint, module, feature or slice; move declarations between files; contract evolution of a persisted event (new generation, property added, removed or retyped) | `propose-rename` or a reviewed `propose-ast`; never a blind text rename. Renaming a constraint resets its uniqueness index: ask first unless the request names it, then report the reset. A persisted event rename needs `id "OldName"` (added by default) |
| Repair | `PLAY0166`, `0478`, `0469`, `0471`, `0479` (and recipe-only `0397`) | `propose-repair` with `formatting` |
| Inline event extraction | `produces event ...` to a declared event | `propose-extract-inline-event` |
| Parser-invalid document | no editable handles | `propose-ast` `replace-document` with a whole typed document, or fix the text |
| Syntax-only constructs | `system`/`operation`, `eventsource`/`stream` (and `generated`/`returns` before 4.68.0) | typed `propose-ast` edits; no automatic rename or routing repair exists |

## Identity state (`.screenplay/identities.json`)

- `apply` persists identities with the `.play` changes (probed: the file survives
  restarts without `export-workspace`). `open-workspace` and read-only commands
  never create it. Commit both.
- A model only ever edited as text has **no persisted identities** until the first
  `apply`. Whether a first apply is the intended initialization is not documented
  beyond "after the first apply, keep `.screenplay/identities.json`"; ask before
  relying on it.
- Text-editing an identity-affecting declaration in a model that has the file
  breaks continuity silently on the next apply. In a model without it the risk is
  to persisted Chronicle event types (use `id` pins).
- Do not read the file for content (token cost); `read-workspace` with `view:
  "semantics"` returns identity assignments, not a model summary.
- See "Make one coherent proposal" in SKILL.md for the exclusive-write prerequisite of `apply`.

## Read-only views worth knowing

- **`source-map`** (`read-workspace`): the compiler's semantic entries ordered by
  semantic id with `role` (Declaration or Description), identity `origin`,
  `documentId`, `path` and an exact zero-based UTF-16 `span` plus one-based
  line and column. `available` is true only when compilation succeeded; an empty
  page alone is not evidence of success. Executable diagnostics have their own view.
- **`whenAppendedEvent`**: specification fixtures that use `when append` appear in
  `declaration-details`, the syntax index and `find-fixtures` with the role
  `whenAppendedEvent` (payload) and `whenAppendedEventDestination` (the `for`
  value). References and dependencies carry that role instead of `thenEvent`, so a
  query for `then` events does not return the appended event.
- **`executable-model`**: canonical ESM bytes; `modelRevision` (`rev1:<sha256>`)
  exists only when the model binds. Without an identities file it changes when the root folder is
  renamed (a relocation that keeps the name does not), because application identity is
  bootstrapped from the root name. Source positions and descriptions do not change it, and a
  file move changes it only if it changes logical placement or application identity. Do not compare it with a render manifest's revision. Do not read
  the bytes themselves.
- **`implementation-requirements`**: attachments with `bodySpan`/`bodyLines`; see
  the [MCP tool guide](mcp-tools.md#code-attachments).

## Failures (use `failureKind`, never message text)

See "Failures (use `failureKind`, never message text)" in SKILL.md.

## Provenance

The structure of this loop (ownership, edit-request shape, failure handling) is
adapted from the project's earlier event-modeling toolkit draft and re-verified
against the Screenplay sources named above. See [provenance](provenance.md).
