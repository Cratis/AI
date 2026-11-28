# Account for each modeled command and view

List every command and view once, then expand its obligations into separate rows when they have different dispositions. For a command, derive them from its `validate`, `authorize`, `reads` and `produces` declarations; for a view, inspect its projection joins, keys and query behavior. Passing examples alone do not show that every command or view was considered.

Assign exactly one disposition per obligation:

- **Executed:** name the specification and the passing scenario or case.
- **Not applicable:** record why the concern cannot arise for this artifact.
- **Open domain question:** name the owner and keep the question in `STATE.md`; don't claim acceptance for it.
- **Target-engine gap:** record the `Unsupported` reason and where to prove it at the first executable boundary. Do not count it as passed.

| Modeled artifact | Obligation from the model | Disposition |
| --- | --- | --- |
| `RegisterAuthor` command | `produces` routes `AuthorRegistered` to the requested author | Executed — `RegisteringAnAuthor`, `Aster` case passed |
| `AuthorList` view | Join isolation | Not applicable — one row per author, no joins |
