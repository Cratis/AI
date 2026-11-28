# Review before writing managed artifacts

Check against the **real** destination. An empty temporary folder cannot tell you about an existing manifest, a stale file the developer edited, or another tool's file at the same path. Record application identity, target, model revision, destination and selected scope. A project name is not the application identity. Preserve persisted IDs and the project's existing ownership metadata on a rerender.

Use the result of `--check`, not the presence of generated files in a directory left by another run:

| Exit | Decision |
| --- | --- |
| `0` | The checked plan is up to date. Run the relevant behavior checks; convergence is not runtime proof. |
| `6` | Writes, removals or a manifest-only rewrite are pending. Inspect each effect before seeking permission to publish. |
| `5` | Planning or publication was refused, or recovery is pending. Preserve the diagnostic. Do not assume a fresh render fixes ownership. |
| `9` with `--strict` | Acceptance is incomplete. A real render can already have published safe files; inspect the destination rather than assuming rollback. |
| `10` | Unexpected failure. Inspect the reported cause, manifest and recovery state before another attempt. |

A planned overwrite of a developer-edited **active managed** file needs specific approval before `--force`. That flag does not allow takeover of an unmanaged file or deletion of a modified stale file. If publication was interrupted, a check is read-only: it cannot recover the transaction. Preserve the destination and reported state; review recovery effects before an authorized real render.

Test the exact shape on the renderer bundled with the CLI. For example, the Cratis renderer can generate a synthetic `Id` plus typed parts for an admitted root composite projection. Check that a real keyed lookup addresses one instance across replay. Its composite route refuses `Decimal` key parts because differing scales can split one identity, and does not admit `DateTime` parts. Do not replace a domain key with a lossy string to pass admission. For reactions, one trigger combining direct events and calls is not equivalent to multiple direct-production triggers for the same event, or a direct production combined with an event-producing refusal branch. Check the exact refusal before designing a manual implementation.

For `STAGE-IMPL-002`, inspect the command handler requirement: a pending implementation or one resolved in a language the selected Cratis renderer cannot realize is not a generated decision. Keep modeled outcomes, host implementation and runtime proof separate. For a foreign inbox or outbound event, inspect the actual generated artifact; admission of one capture does not establish support for nested or child mapping in another. Exercise the adapter that supplies observations, not just the parser.

If the model binds but the renderer refuses a required behavior, separate that refusal from a collision in the destination. Keep the business requirement and record exactly which behavior would be realized manually. Choose an unmanaged implementation seam with an owner, a target test and a regeneration check; do not patch generated output as a standing solution. If the next render would claim that file or there is no safe seam, stop. After publication, rerun the identical check and test the addressed outcome on the actual target. List scaffold work still owed by the application owner.
