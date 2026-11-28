---
name: cratis-screenplay-edit-workspace
description: Use when a maintainer needs to preview or apply a typed Screenplay edit, preserve declaration identity during a rename or recover an interrupted workspace write. Not for accepting changed behavior (use cratis-screenplay-accept-model).
compatibility: Requires the Screenplay CLI. Typed proposals and interrupted-write recovery use the Screenplay MCP server.
---

# Review and apply a command input rename

For a new declaration with unambiguous ownership, [author the slice](../cratis-screenplay-declare-slice/SKILL.md) directly. For a command property rename, use the typed proposal below to keep the property's identity.

Edit the application's actual model root; rehearse on a copy only when requested. The example assumes the requested change is `RegisterAuthor.name` to `authorName`. The requesting user approves writes unless they name another owner.

**Without MCP:** Edit the owning `.play` declaration and its bound references in place. Run `screenplay model` and `screenplay test model --format json`, then review the diff. These are one-off edit checks, not proof of identity continuity. If a rename must preserve identity, do not substitute a text rename for a typed proposal; leave that operation pending until the typed tooling is available.

**With MCP:**

1. Connect the MCP client to the application's model root and call `open-workspace`. Save the returned revision and catalog revision. Call `read-ast` with `expectedRevision` for that workspace, `kind: "PropertySyntax"` and `name: "name"`. From `page.items` take the `handle` of the item whose `handle.path` contains `/commands/`, not the `AuthorRegistered` payload or `Author` read-model property. The AST `address` contains `kind` and `parts`; it is not a dotted string.
2. Call `propose-property` with this handle as `target`, `action: "rename"`, `expectedName: "name"`, `newName: "authorName"`, `validation: "Executable"`, `expectedRevision` and `expectedCatalogRevision`.
3. Call `read-proposal` with its `proposalId` and `view: "changes"`, then `view: "diagnostics"`. If `droppedCommentCount` is not zero, also read `view: "dropped-comments"`. Check both sides of `name = name`: the event member remains `name`, the command reference becomes `authorName`. Review each input assignment changed in the example; a string literal is not a property reference. Check `stateChange` for identity continuity as well as references and dropped comments. If unsure whether a replacement is intended, stop at the proposal.
4. Obtain approval for this change set at the reviewed workspace and catalog revisions. Call `apply` with its `proposalId`, `expectedRevision` and `expectedCatalogRevision`.
5. Call `open-workspace` again and run `screenplay model`.

For a **declaration** rename with a stable semantic identity, the standalone `screenplay rename` also supports an explicit dotted declaration address, new name and model root. It is a write, not a preview. Confirm the address, kind, references, stored event name and authority first. On success the event's stored name is pinned and `.screenplay/identities.json` is updated. Exit 0 means renamed, 1 refused, 2 could not run. This declaration operation is not a substitute for the property proposal above.

Compare the approved before and after folders with `screenplay diff before/model after/model --format json`. Exit 0 means a comparison ran, **not** that there were no breaking changes; 2 means it could not run. Check the reported matching mode: a move matched by persisted identity is different from removal plus addition matched by address. `screenplay export` returns 0 for an emitted artifact, 1 for a model or requested export that cannot be emitted and 2 for an invocation or input error. If identities disagree with the sources, preserve both, restore the reviewed names and redo the intended rename through identity-aware tooling; do not delete identity state to produce a clean export.

For typed editing, discover actual tool names and input shapes with `tools/list`. Use read/inspection for diagnosis, a proposal for preview, and `apply` only for the reviewed change. Prefer a targeted repair over rewriting a file with dropped comments. Keep presentation layout, story order and executable behavior in separate reviewed changes. A valid proposal may still change the wrong thing.

## When it goes off the usual path

- **Either revision changed:** reopen the workspace and review a fresh proposal. Don't transfer approval to it.
- **The connection dropped during apply:** call `workspace-state` before retrying. If it reports an interrupted operation, obtain approval and call `recover-workspace` with that `operationId` when rollback is safe.

## Related skills

- [Declare the slice](../cratis-screenplay-declare-slice/SKILL.md) for the original model.
- [Accept the model](../cratis-screenplay-accept-model/SKILL.md) to review changed behavior.
