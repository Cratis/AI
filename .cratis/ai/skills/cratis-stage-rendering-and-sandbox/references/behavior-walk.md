# Behavior walk in the sandbox

An optional check after V3: use the model as each persona would and record what changes.
It produces **findings for the model owner and changes nothing**: no code fix, no model
edit, no Stage-managed edit by the walker. It is not a UI-faithfulness review
(`cratis-screenplay-ui-composition`), and it is not V3, V4 or
V5 evidence.

## Prerequisites

- V3 passed, and `cratis render` admits the model (a model Stage refuses cannot be walked
  as the application it describes).
- Docker, and the `cratis/stage` image at the tag `cratis run` would use (by default the
  Stage version the CLI renders with).
- The **semantic engine**. From CLI 3.73.0 `cratis run` runs it by default; CLI 3.64.0 to 3.72.x need
  `cratis run --engine semantic`. Older CLIs only start the legacy EventModel engine, which enforces only
  simple literal validation rules, no authorization, and refuses routed models; with those, start the same image directly:

```bash
docker run --rm -p 127.0.0.1:9090:9090 -p 127.0.0.1:35000:35000 \
    -e Stage__Runtime__Engine=semantic \
    -v "$PWD/model":/eventmodel:ro cratis/stage:<tag>
```

Wait until `GET /stage/status` reports `ready` and `engine: "semantic"`. `unsupported`
means the engine cannot execute the model and `/api/**` answers 501: stop, and record the
issues from `GET /stage/semantic/admission`; nothing was walked. `GET /stage/routes` lists
the command and query routes, and `/scalar/v1` is the API reference.

## The walk

For each persona, list the commands and screens that persona can reach (from the model's
`authorize`, `persona` and `screen` declarations), then for each one:

1. Note the state first: the persona's queries before acting.
2. Act: call the command as that persona with realistic input. Callers are built from the
   unsigned `x-ms-client-principal` header, so set the persona's roles and claims there.
3. Look at what changed: the HTTP outcome (accepted; `403` denied; `400` validation or
   constraint; `501` unsupported), the persona's queries again, and the queries of the
   other personas the change should reach.
4. Repeat the action, then try the obvious refusals a person would expect (an empty value,
   a repeat, the wrong persona, a step out of order).

Read models on the semantic engine live in the process and the history is unbounded, so
keep a session short and restart it for a clean state.

## Finding kinds

| Finding | Evidence to record |
| --- | --- |
| An action that changes nothing visible | Persona, command, input, outcome, and the queries before and after that stayed identical |
| A screen whose data stays empty because nothing feeds it | Screen, its read model and query, the events that should fill it, and that no walked command produces them |
| A pending-work or to-do view that never empties | The view, the item added, the action expected to clear it, and the unchanged view afterward |
| A refusal the person expected but the model lacks | The action tried, the accepted outcome, and the rule the person expected |
| An action the persona can take but should not, or cannot take but should | Persona, command, outcome, and the `authorize` line involved |
| A command or query the engine cannot execute | The `501` or admission entry with its reported reason |

Every finding names the persona, the steps in order, the observed outcome (status and
payload) and the model declaration it points at. Keep observations apart from opinions.

## What the walk cannot show

- A partial UI: the sandbox renders only part of a screen, so it says nothing about whether
  an authored screen, template or form is rendered faithfully.
- Production authorization: callers come from forgeable headers, so a pass is not a
  security result. Authorization on rendered applications is checked by their Debug tests.
- Anything the engine refuses: an unsupported model is not walked, and artifacts listed as
  unsupported are blind spots, not passes.
- Chronicle projections in the Workbench: the semantic engine's read models are in-process.
- Rendered behavior: it is not a build, not Debug tests and not the specification runner.

## Hand-off

Give the findings to the model owner. A finding becomes an edit request
(`cratis-screenplay-model-authoring`) or a review finding (`cratis-screenplay-model-review`),
followed by the usual verdicts. Never turn a finding into a code fix, a change to
Stage-managed output or a weakened model, and never report the walk as an acceptance.
