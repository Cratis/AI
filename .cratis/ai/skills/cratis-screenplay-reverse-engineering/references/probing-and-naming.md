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
- an unknown or foreign id;
- **limit + 1**: when a limit is suspected, probe the boundary and one past it (100 and 101 for a
  100 limit), and the common sibling limits (50, 100, 200, 255) when a sibling field has one;
  "100 accepted" alone proves no limit;
- **field combinations**: a rule that fails only when several fields are empty together
  (at-least-one-of, mutually dependent fields) never shows in per-field probes. Probe all
  fields empty, each one empty alone, and all filled;
- a duplicate is a second, distinct id with the same value, sent sequentially; read the body.

Read the command schema as well as the form: concept names (`x-concept`), enums, required flags
and formats show value types the screen hides. A field or probe not run is recorded as
`not probed`, never left silent.

Copy `validationResults[].message` verbatim into the rule's `message` and note the member and
the reason: a framework typing failure is not a model rule. Use fresh ids and a marker on test
data for every run, in a sandbox instance, so repeated sweeps do not pollute read models.
An out-of-range or missing value that is coerced or crashes (missing enum defaults to the first
member, overflow wraps, missing id gives HTTP 500) is an observed defect, not intent: record
it under "Observed defects" and model the intended behavior.

## Confirm surprises and enumerate the query surface

A result that contradicts a standard pattern (a uniqueness constraint that accepts a duplicate,
"no validation at all") needs a confirming second probe, designed differently, before it
becomes a row; until then it is `unconfirmed`. A wrong `Confirmed` row is worse than a gap.

The UI shows only the queries its screens use. On a system the team owns or is authorized to
probe (the owned-only limit above holds), also enumerate the surface from your own traffic and
the schema: by-id lookups, filters and argument variants of each query, and the routes seen in
the capture. Read the error text for required arguments. A query that returns HTTP 202 or
`isReady: false` is warming up: retry after a few seconds before recording it empty.

## Time-based views

A query, screen or filter whose name or text mentions time (overdue, due today, dormant, recent)
has a threshold that only data can reveal. Seed records through the commands' own date fields:
received or activity dates far in the past, due yesterday, today and tomorrow, done and not done.
Diff the result sets to find the boundary. If a threshold could not be exercised, record the
placeholder value as an `unknown` with a question; never ship a guessed number unrecorded.
The server's time zone and its "today" are standing unknowns: seed near midnight and with
backdated dates, and look for a zone setting or response header. A today-relative rule the
dialect cannot express is a comment plus an `event-model.md` gap row, not a guessed filter.

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
