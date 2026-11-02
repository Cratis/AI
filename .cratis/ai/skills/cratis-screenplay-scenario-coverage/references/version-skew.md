# One slice per specification: reactions and `then invokes`

How to cover reactions that span slices.

A specification runs its own slice only (it applies to every model): only the reactions, captures and outbound publications declared in the slice that
holds it run. A command spec's `then` lists the command's own facts. Stating an event
another slice's reaction appends, or the public event an outbound Translate slice
publishes, is refused by `PLAY0285` ("cannot be produced") and fails at run time.
- Cover the reaction in its own Automation slice: `when append <Trigger>` -> `then <Produced>`.
- When the reaction invokes a command another slice owns, state the hand-over with
  `then invokes <Command>` and the values passed (ESM v34;
  `PLAY0815` for a malformed line, `PLAY0816` when no reaction of the specification's slice
  invokes the command). The invoked command's own slice covers the events it appends.
- A command's own specification covers the command; an outbound Translate's specification
  covers the public event it publishes.
- Validate with `screenplay <folder> --warnaserror --no-color` or
  `cratis screenplay validate <folder> --warnings-as-errors`, and name the tool. A compiler
  that predates ESM v34 still runs every slice's reactions and rejects `then invokes`; do not
  restate a spec to suit it. Never delete the reaction.
