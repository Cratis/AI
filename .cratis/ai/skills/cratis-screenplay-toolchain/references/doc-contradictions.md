# Documentation contradictions and which side to trust

`D/` is Screenplay `Documentation/screenplay/` at **v4.66.0**; line numbers were re-read at
that tag. Rule: the compiler you ran decides what the tool accepts today; the documentation
and the domain decide what the model should mean. When they disagree, follow the compiler
for syntax, keep the intended semantics in the model, and record the gap (an issue).
Tool names mean the standalone `screenplay` 4.68.0 and `cratis` 3.28.2 (bundled Screenplay
4.66.0; before 3.28.2 bundled 4.60.1); see `versions.md`. [probed] marks a row re-checked by running a tool; the rest are
read from source or documentation.

| # | Topic | Conflict | Trust |
| --- | --- | --- | --- |
| 0 | ESM v6 | `D/specifications.md` and `D/reactions.md` describe clocks, triggers, captures and reactions as admitted and executed | both tools admit them (ESM v6) since cratis 3.28.2; cratis 3.27.1 (4.60.1) rejected them with PLAY0268 [probed] |
| 1 | `#` comments | PDL docs use `#` (`D/projections/auto-map.mdx:125,147,153`, `D/forms.md:10`) | compiler: PLAY0058 in a projection; use `//` [probed] |
| 2 | projection `automap` | `D/projections/grammar.md:70,77` now allow `automap` for children and nested; the projection-level `ProjDirective` (`:38`) still lists only `no automap` | compiler accepts bare `automap`; keep `no automap` at projection level |
| 3 | AutoMap inside `from` | `D/projections/auto-map.mdx:49` "cannot be toggled" vs `:226` "apply `no automap` per event" | ambiguous; use `no automap` at the projection, children or nested level |
| 4 | child id syntax | `D/projections/keys.md:110` says `id userId` | `identified by` (compiled) |
| 5 | root `remove via join` | `D/projections/removal.md` promises instance removal | `D/projections/semantic-model.md:59,94`: the engine wires it as a child pull and the evaluator does not execute it. Unverified at runtime |
| 6 | `$strings` in authentication | `D/internationalization.md:30` allows it wherever a value expression is accepted | PLAY0183: no provider configuration lines |
| 7 | interaction examples | `D/interactions.md:33` uses `button` | PLAY0103; `on double click` on `table` compiles though not in the EBNF |
| 8 | where screens live | `D/screens.md:3` "inside `StateView` slices" | samples also put dialogs in `StateChange` |
| 9 | where reducers live | `D/slices.md:74` and `D/glossary.md:21` call a reducer an `Automation` thing vs `D/slices.md:87` (`StateView`) | `StateView` (samples) |
| 10 | `then` after `when append` | `D/specifications.md:67` "must match exactly the appended fact" vs `:232` and `:282` (v6: what followed it) | v6 text on the standalone tool; before v6, `:67` |
| 11 | constraint collision across sources | `D/constraints.md:118` "cannot yet show" vs `D/specifications.md:77` (`for` lets a spec claim a value on another source) | `specifications.md` (newer) |
| 12 | capture backtick `when` | opaque (`D/captures/grammar.md:321`) vs small portable grammar (`D/captures.md:94`) | both: storage versus binder |
| 13 | clock boundary | resolved: an occurrence fires if due **after** the given clock and **at or before** the when clock (`D/specifications.md:282-284`; `Semantics/Execution/SemanticClock.cs`, `at > from && at <= to`). Given equal to when fires nothing, so the Screenplay sample `Samples/Commerce/Fulfillment/Shipping/ReleasePickingWave.play:20-22` (06:00 to 06:00, expecting `PickingWaveReleased`) is wrong | the code; never write given equal to when. A Screenplay issue for the sample is a candidate |
| 14 | `$causedBy` | not evaluable (#4119), not ESM | showcase only |
| 15 | literal keys | `key literal "global"` vs `key "global"` | both compile; prefer `literal` |
| 16 | query admission | `D/queries.md:74` now says live, filtered, scoped and performer queries are not admitted | the binder also rejects collection queries and a missing `by`, which stay undocumented [probed] |
| 17 | `@pii` | `D/concepts.md:3,33` "Chronicle applies `@pii` and `@sensitive` rules automatically" | the binder rejects any compliance attribute (PLAY0268); keep it, report V3 blocked. `@sensitive` has no verified portable meaning (Screenplay#384); `@pii` on an event-source identifier is CHR0034 in Chronicle |
| 18 | read-model identity | `D/readmodels.md:32` "from the keyed query" | the `by` name must also equal a read-model property (the doc still omits it) |
| 19 | `$strings` constraint messages | `D/constraints.md:31` vs `D/internationalization.md:55` | the compiler keeps the key; realization localizes |
| 20 | composite key braces | optional in the EBNF; both forms in docs | both fine |
| 21 | counters list | `D/projections/index.md:54` lists only increment and decrement | `count` exists too [probed] |
| 22 | ESM version allocation | older text and decisions 0023 and 0024 give exact numbers, operations, streams and reads fixed numbers (v7 to v11) | decision 0025 (accepted 2026-10-06): v7 is generated values and responses (decision 0026, released in 4.68.0); every other feature has no number until its release-ready admission, so say "not admitted by any supported ESM version" |
| 23 | claim conditions | the condition grammar lists `==` | claims need `matches` (PLAY0120) [probed] |
| 24 | `numbers exact` | released in 4.64.0 as syntax only, but absent from `D/grammar.md`; documented only in `D/diagnostics.md` (PLAY0508 to PLAY0513) | the compiler: it parses, never binds (PLAY0268, "not admitted by any supported executable model (ESM) version yet"), PLAY0001 on older compilers [probed] |
| 25 | command `concurrency` | `D/commands.md:609` says the executable model "does not bind the `concurrency` block yet" | the binder reports PLAY0271 as an **error**, not a silent skip (`SemanticModelBinder.Commands.cs:32-38`) |
| 26 | MCP approval policy | `D/mcp/reference.md:37` "Keep client approval enabled for both" vs the server instructions (`McpConnection.cs:14`) "hosts need not confirm them each time" | keep approval on; this skill's rule is explicit user approval before `apply` |
| 27 | decision index | `decisions/README.md` row 0020 shows stage `none` while v5 is implemented | the code: v5 `then no readmodel` binds |
| 28 | `visualize-model` kind | the tool filters on the kind "Reactor" (`McpVisualization.cs:21`) although the construct is a Reaction; its added/removed summary never counts reactions (Screenplay#379, open) | the model, not the summary |
| 29 | bodied reducers in Stage | cli `Documentation/reference/screenplay.md:38` says bodied reducers are unsupported (STAGE-ESM-019) | Stage 4.24 code admits pure allowlisted reducer bodies (`PureTransitionAdmission.cs`); trust the code |
| 30 | `cratis screenplay validate <file>` | the command reads as a document validator | file mode ignores the file's imports and reports false unknown-name warnings (cli#244, open): validate the folder [probed] |
| 31 | cli false PLAY0285 | `D/diagnostics.md:640` defines PLAY0285 as a contradiction against every possible producer | cratis before 3.28.2 reported it falsely on reaction cascades (cli#242); not reproduced on cratis 3.28.2 [probed] |

Rows 0 to 12, 14 to 21 and 23 were re-read at the v4.66.0 line numbers above; rows 14, 15,
19, 20 and 23 are properties of the language rather than documentation defects and were
not re-probed on 4.66.0.
