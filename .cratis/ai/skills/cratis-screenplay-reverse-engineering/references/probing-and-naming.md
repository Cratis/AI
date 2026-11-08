# Probing, time, naming and defects

What a walk must exercise beyond the happy path, and how to label what it cannot observe. Rows
follow [evidence-format.md](evidence-format.md). Probes are writes: they need the write approval
of the walk, on a target the user owns.

## Boundary probes

Rules that were never submitted are never seen. For every command reached in the walk, probe
each input and record one row per probe (accepted or rejected, plus the exact message):

- empty required text, and whitespace only;
- over-long text, past any limit the form or schema hints at;
- zero and negative numbers, and the largest plausible value;
- repeat submit of the same payload;
- an unknown or foreign id.

Read the command schema as well as the form: concept names (`x-concept`), enums, required flags
and formats show value types the screen hides. A field or probe not run is recorded as
`not probed`, never left silent.

## Time-based views

A query, screen or filter whose name or text mentions time (overdue, due today, dormant, recent)
has a threshold that only data can reveal. Seed records through the commands' own date fields:
received or activity dates far in the past, due yesterday, today and tomorrow, done and not done.
Diff the result sets to find the boundary. If a threshold could not be exercised, record the
placeholder value as an `unknown` with a question; never ship a guessed number unrecorded.

## Client-side or server-side

A rejection seen only in a UI form is a hypothesis: the form may validate what the server
accepts. Confirm with a direct API call (or the same field on a sibling command) before modeling
a rule. Mark each rule row `client-side`, `server-side` or `unconfirmed` in `fact` or
`unknowns`. Prefer the API response over the form when they differ; an unconfirmed rule is
modeled as a question, not a `validate` line.

## Naming fidelity

When the target exposes artifact names (command, field, concept and route names in the UI,
schema or OpenAPI), record that those names are `Observed`. Event names, streams, event payloads
and read-model, query and screen names that are not exposed are `Inferred`: label them as
inferred in model comments, and report naming fidelity separately from structural fidelity,
because an exposed command name makes its past-tense event name look confirmed when it is not.

## Observed defects

Model behavior that looks like a defect (a stale join, a missing filter) as observed, with a
comment flagging the suspected defect, and specify it so the round-trip proves the model is
faithful. List each in a findings section of the report for the owner to decide; never fix one
silently, and never present it as intended.

## Queries the renderer can serve

When an observed rule is expressible declaratively (filter, join, sort, count), prefer a
declarative query. A code-performed query is opaque: `cratis run` cannot serve it and
specifications cannot execute it. Record each opaque query as `unverified` in the fidelity
result and the report.
