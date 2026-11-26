---
name: cratis-screenplay-edit-workspace
description: Applies a revision-bound Screenplay workspace edit. Use when proposing a typed change to a split model or recovering an interrupted write. Not for accepting changed behavior (use cratis-screenplay-accept-model).
compatibility: Requires the Screenplay MCP server and CLI.
---

# Review and apply a command input rename

Use a **comparison copy** of the Library model for this exercise. Keep `RegisterAuthor.name` unchanged in the application contract.

1. Call `open-workspace` with `path: "model"`. Save the returned revision and catalog revision. Call `read-ast` with `expectedRevision` for that workspace, `kind: "PropertySyntax"` and `name: "name"`. From `page.items` take the `handle` of the item whose `handle.path` contains `/commands/`, not the `AuthorRegistered` payload or `Author` read-model property. The AST `address` contains `kind` and `parts`; it is not a dotted string.
2. Call `propose-property` with this handle as `target`, `action: "rename"`, `expectedName: "name"`, `newName: "authorName"`, `validation: "Executable"`, `expectedRevision` and `expectedCatalogRevision`. Do not pass `alsoRename`.
3. Call `read-proposal` with its `proposalId` and `view: "changes"`, then `view: "diagnostics"`. If `droppedCommentCount` is not zero, also read `view: "dropped-comments"`. Check both sides of `name = name`: the event member remains `name`, the command reference becomes `authorName`. Review the example input changes separately; a string literal is not a property reference.
4. Obtain approval for this proposal. Call `apply` with its `proposalId`, `expectedRevision` and `expectedCatalogRevision`. If either revision changed, reopen the workspace and review a new proposal instead.
5. Call `open-workspace` again and run `screenplay model`. If the connection dropped during apply, call `workspace-state` first. If it reports an interrupted operation, obtain approval and call `recover-workspace` with that `operationId` before retrying.

## Avoid

- Don't rename by global text replacement; select the command property by its owner.
- Don't transfer approval from a stale proposal to a new one.

## Related skills

- [Declare the slice](../cratis-screenplay-declare-slice/SKILL.md) for the original model.
- [Accept the model](../cratis-screenplay-accept-model/SKILL.md) to review changed behavior.
