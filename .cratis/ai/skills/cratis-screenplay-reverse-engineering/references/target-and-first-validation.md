# Running target, first validation and no-MCP fallback

Short recipes for turning a recovered model into a running Stage app. The commands, verdicts and
syntax are owned by `cratis-screenplay-toolchain`, `cratis-screenplay-render-and-gap-fill` and
`cratis-stage-rendering-and-sandbox`; this page only sequences them.

## From recovered model to running app

1. Validate the folder with warnings as errors, `screenplay <folder> --warnaserror`
   (`cratis-screenplay-toolchain`). Fix the model, never silence a diagnostic.
2. Run the reference specifications, `screenplay test <folder>`. `Unsupported` is not a pass.
3. Start it with `cratis run <model folder>` (Stage sandbox, needs Docker), or render with
   `cratis render` and gap-fill (`cratis-screenplay-render-and-gap-fill`).
4. Re-walk the observed journeys on the running app (`fidelity-check.md`).

`render --force`, `prologue` start, the Extractor and `prologue interpret` need approval and stay
outside this recipe.

## First-validation traps

Errors that cost iterations on a first pass; each is confirmed in the toolchain references.

- A scalar type is `Bool`, not `Boolean`; an unknown type is PLAY0165.
- A queryless or list read model needs an explicit `key` mark; a read model with two `*Id`
  properties needs one keyed query (`cratis-screenplay-toolchain` traps 12 and 46).
- A `require` message goes on the next indented line (trap 38).
- `given clock "<ISO timestamp>"` is one line.
- Productions from different streams need explicit destinations (PLAY0470).
- Prove a projection with `given` events, then `when`, then `then readmodel`/`then query`
  (trap 15). A command spec on an update-style command (archive, rename, complete) needs a
  `given` of the event that created the row, or the run reports Unsupported; see
  `cratis-screenplay-specifications`.
- Add a per-command screen only when no data screen carries the action; command forms come
  from actions on data screens.

## Without the Screenplay MCP server

The propose, read, apply loop needs the MCP server. When it is unavailable, write the `.play`
file directly, then validate with `screenplay <folder> --warnaserror` and run
`screenplay test <folder>` after every slice. A diagnostic is still a finding: fix the model,
never weaken protection to pass. Record in the report that the MCP loop was not used. Write
helper scripts to files rather than long inline shell, which guards may block.
