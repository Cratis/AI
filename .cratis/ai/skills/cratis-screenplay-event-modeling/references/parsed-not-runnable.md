# Parsed is not runnable: ESM versions and dispositions

Facts read at Screenplay `v4.66.0` (`c89198b`): `Source/DotNET/Screenplay/Semantics/Versions.cs`,
`SemanticModelBinder.cs` (`ReportTopLevelDispositions`), `SemanticModelBinder.CommandProductions.cs`,
`Documentation/screenplay/{commands,operations,event-sources}.md`. Tool versions and which tool
reports what: `cratis-screenplay-toolchain` `references/versions.md`.

## Which ESM version a model needs

- **v1** by default.
- **v2** for typed event-source facts: `produces ... for <identifier>` when the event does not
  repeat the identifier, `for` values in specifications, and `$context.occurred` or caller
  identity in `produces`.
- **v3** for code the model hands off: bodied reducers, code validation, code policies. Code
  binds as an opaque requirement; the reference runner reports any specification that needs it
  as unsupported. A command `handler` (including `implementation` and `hint`) never binds
  (`PLAY0268`).
- **v4** for event-contract lineage (multiple event generations) and **v5** for keyed read-model
  absence assertions (`then no readmodel`).
- **v6** for reactions, captures, application triggers and the clock (and so `Automation` and
  `Translate` slices).

## Dispositions to keep apart

| Construct | Authoring | Binding at 4.66.0 |
| --- | --- | --- |
| `persona` | accepted | information `PLAY0270` ("authoring metadata and is not part of ESM v1 behavior"). Never blocks; an unknown policy on a persona is an error |
| `domain`, `authentication` | accepted | report-only information (`PLAY0270`) |
| `@pii`, `@sensitive` on a concept | accepted | `PLAY0268`, blocks binding and rendering |
| `reads`, `concurrency` on a command | accepted | `PLAY0271` |
| `reads` under a reaction trigger that only `invokes` | accepted | information `PLAY0270`: report-only intent, the model does not consult the view |
| `reads` under a reaction trigger that `produces` directly | accepted | `PLAY0268` |
| Generated properties, `returns` responses | authorable, syntax-only | `PLAY0268`; allocated to ESM v8 |
| `system`, `operation` | authorable, syntax-only | `PLAY0268`; allocated to ESM v9 |
| `eventsource`, `stream` | authorable, authoring-only | `PLAY0268`; allocated, not implemented (`cratis-screenplay-toolchain` `references/sources-and-streams.md`) |
| UI constructs | accepted | information `PLAY0269` |

A model that carries one of the blocked constructs is still a valid design model. Never remove
the construct to make a tool pass; record the gap against its address
(`cratis-screenplay-modeling-lifecycle`).

## The Step 7 clock example

The complete example in [nine-steps.md](nine-steps.md) (Step 7) compiled with
`screenplay <folder> --warnaserror` 4.66.0 (0 errors, 0 warnings) and opened through
`screenplay mcp <folder>` with `executableReady: true` and five `PLAY0270` information
diagnostics. It binds as a scheduled invocation; its `reads` is intent only, so the overdue
decision is not executed by the model. The `cratis` 3.27.1 bundle (Screenplay 4.60.1, ESM v1
to v5) compiles it but rejects the Automation slice at binding. Report reaction
specifications as authored, not as run, unless a V4 run says otherwise.
