# Model notes and storylines

## Notes

Read the workspace and call `list-model-notes` on the `screenplay` MCP server. The source `revision`, `catalogRevision` and `notesRevision` are independent. Use the stable semantic ID read for the intended element, not an ID guessed from its name. For example, call `propose-model-notes` with the returned values substituted:

```json
{
  "expectedRevision": "<source revision>",
  "expectedCatalogRevision": "<catalog revision>",
  "expectedNotesRevision": "<notes revision>",
  "operations": [{"operation":"add","kind":"question","author":"Review team","text":"Can withdrawn invoices be reopened?","anchor":{"semanticId":"<element semantic ID>"}}]
}
```

Inspect `read-proposal` with `view: "notes"` and verify the resolved anchor. If the server reports a substitution, do not apply it silently: fix the target or seek review of the new anchor. With permission call `apply` with the reviewed `proposalId`, `expectedRevision` and `expectedCatalogRevision`; reread and repropose on stale state. Use `reanchor` with the note `id` and a verified stable anchor when a note legitimately moves. Resolve a note only with cited evidence: use `resolve` with the note `id` and a `resolution` containing `by: "specification"`, the witness `semanticId`, explanatory `text` and `author`. Do not put secrets or personal data in note content, references, authors or resolutions.

Check `orphanedNotes` on source proposals and their review. A null value with unreadable notes is unknown, not proof of no orphans. Preserve or deliberately reanchor affected notes and verify with `list-model-notes` and `state: "orphaned"` after the source change.

## Storylines

Place the storyline at the top level of one model document. For the Library registration and list slices, the ordered steps can be:

```play
storyline RegisterAndSeeAuthor "Register and see an author"
  command RegisterAuthor "The librarian submits the name"
  event AuthorRegistered
  query AllAuthors "The list shows the author"
```

Use element references, qualified if ambiguous. Storyline metadata presents order; it does not execute commands or establish a delivery dependency. Compile with `screenplay model --warnaserror` (substitute the real root) so missing or ambiguous steps are not overlooked.
