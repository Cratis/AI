---
name: cratis-screenplay-edit-workspace
description: Applies revision-bound Screenplay workspace edits. Use when editing a split model, proposing an AST change or recovering a stale workspace handle. Not for accepting the behavior (use cratis-screenplay-accept-model).
compatibility: Requires the Screenplay MCP server and CLI.
---

# Apply a model edit to the reviewed revision

Open the folder containing the complete model. A change in one document can affect references in another document in that folder.

1. Call `open-workspace` for `model/`. Keep the returned `revision` and `catalogRevision`. Use `read-ast` to obtain the handle for the `name` property of `RegisterAuthor`.
2. Call `propose-property` with that handle as `target`, `action: "rename"`, `expectedName: "name"`, `newName: "authorName"` and `validation: "Executable"`. Pass the saved revisions as `expectedRevision` and `expectedCatalogRevision`. Select no other fields: the event payload must still be named `name`.
3. Use `read-proposal` to review the affected references, identities, diagnostics, lost comments and exact files the proposal would write.
4. Obtain approval for that specific proposal before `apply`. Approval for one proposal does not transfer to another.
5. Reopen the composed folder after applying and compile it. Do not infer the persisted state from the proposed write plan.

## Example: rename a command input in a split model

Start with `model/Authors/registration.play` from [declaring the Authors slice](../cratis-screenplay-declare-slice/SKILL.md). To rename `RegisterAuthor.name`, open `model`, then select that command input in the assembled workspace. Request the rename there. Inspect the proposed changes to its production mapping and example values separately: a matching literal need not be a reference to the declaration.

If a collaborator edits the feature before apply, reopen the model, propose against the new revision and review the new write plan. If the connection drops during apply, inspect `workspace-state` **before** deciding whether recovery is needed. Obtain approval before recovery.

## Avoid

- Don't rename with a global replacement; target the declaration.
- Don't retry an interrupted write blindly; inspect the recorded workspace state.
- Don't generate a folder layout over the existing workspace; obsolete files can remain and still compile into the folder model.

## Related skills

- [Accept the model](../cratis-screenplay-accept-model/SKILL.md) to evaluate the resulting behavior rather than the edit mechanics.
