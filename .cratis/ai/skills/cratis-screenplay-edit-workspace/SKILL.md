---
name: cratis-screenplay-edit-workspace
description: Use when a maintainer needs to preview or apply a typed Screenplay edit, preserve declaration identity during a rename or recover an interrupted workspace write. Not for accepting changed behavior (use cratis-screenplay-accept-model).
compatibility: Requires the Screenplay MCP server and CLI.
---

# Review and apply a command input rename

For a new declaration with unambiguous ownership, [author the slice](../cratis-screenplay-declare-slice/SKILL.md) directly. For a command property rename, use the typed proposal below to keep the property's identity.

Use a **comparison copy** of the Library model for this exercise. Keep `RegisterAuthor.name` unchanged in the application contract.

1. Connect the MCP client to the comparison model root and call `open-workspace`. Save the returned revision and catalog revision. Call `read-ast` with `expectedRevision` for that workspace, `kind: "PropertySyntax"` and `name: "name"`. From `page.items` take the `handle` of the item whose `handle.path` contains `/commands/`, not the `AuthorRegistered` payload or `Author` read-model property. The AST `address` contains `kind` and `parts`; it is not a dotted string.
2. Call `propose-property` with this handle as `target`, `action: "rename"`, `expectedName: "name"`, `newName: "authorName"`, `validation: "Executable"`, `expectedRevision` and `expectedCatalogRevision`.
3. Call `read-proposal` with its `proposalId` and `view: "changes"`, then `view: "diagnostics"`. If `droppedCommentCount` is not zero, also read `view: "dropped-comments"`. Check both sides of `name = name`: the event member remains `name`, the command reference becomes `authorName`. Review each input assignment changed in the example; a string literal is not a property reference. Check `stateChange` for identity continuity as well as references and dropped comments. If unsure whether a replacement is intended, stop at the proposal.
4. Obtain approval for this change set at the reviewed workspace and catalog revisions. Call `apply` with its `proposalId`, `expectedRevision` and `expectedCatalogRevision`.
5. Call `open-workspace` again and run `screenplay model`.

## When it goes off the usual path

- **Either revision changed:** reopen the workspace and review a fresh proposal. Don't transfer approval to it.
- **The connection dropped during apply:** call `workspace-state` before retrying. If it reports an interrupted operation, obtain approval and call `recover-workspace` with that `operationId` when rollback is safe.

## Related skills

- [Declare the slice](../cratis-screenplay-declare-slice/SKILL.md) for the original model.
- [Accept the model](../cratis-screenplay-accept-model/SKILL.md) to review changed behavior.
