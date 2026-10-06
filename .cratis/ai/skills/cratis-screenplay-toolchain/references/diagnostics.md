# Diagnostics: meaning -> fix

Authority: Screenplay `Documentation/screenplay/diagnostics.md` and
`Source/DotNET/Screenplay/Diagnostics/DiagnosticCodes.cs`. Codes are permanent; match the code,
never the message. Severities: E (does not compile), W (compiles; usually an unresolved name),
I (never fails, even with `--warnings-as-errors`). `PLAY` = compiler, `SP` = Arc generator,
`STAGE-*`/`CLI-RENDER-*` = renderer.

Where each layer appears: `screenplay <folder>` / `cratis screenplay validate` = syntax and
consistency (V1). MCP `executable-diagnostics` = binding (V2 reads them, V3 needs none:
PLAY0268-0274, 0350-0352, 0389, 0449). `cratis render` = binding with the bundled compiler,
then STAGE (V5 admission). Tool differences: `versions.md`.

## Warnings that hide defects (always validate with `--warnings-as-errors`)
| Code | Meaning | Fix |
|---|---|---|
| PLAY0029 | unknown word in a slice body: the construct is **skipped** | fix the keyword; `type`/`concept` belong at top level |
| PLAY0165/0166/0167 | unknown type / event / policy (0167 is E inside a persona) | declare it, or validate the **folder** (cratis file mode ignores imports) |
| PLAY0177 | `reads` a read model no projection builds | add the builder or fix the name |
| PLAY0248 | reaction `when` names no event/trigger | declare it |
| PLAY0195 | `invokes` an unknown command | declare it |
| PLAY0381 | projection-level `key` routes nothing | put `key` on each `from` |
| PLAY0455 | quoted import glob matches no file | fix the glob |
| PLAY0196/0197/0198 | unknown query/screen; ambiguous bare name | declare or qualify `Slice.Name` |

## Not caught at V1 (fail binding: V2/V3, PLAY0273)
- Projection mapping to a property the read model does not declare.
- Undeclared event in `remove with` or in a capture `append`.
(Screenplay v4.66.0 `SemanticModelBinder` `BindMapping`, `LevelEvent`, `BindCaptureAppends`.)

## Silent at every level
- A declared read-model property that nothing maps (it stays empty): walk field lineage by hand.

## Consistency errors (V1: the model contradicts itself)
| Code | Meaning |
|---|---|
| PLAY0282 | `validate` rule targets a field absent from the command |
| PLAY0283 | `reads View by field` type matches no `by` param of the view's queries |
| PLAY0284 | `children`/`nested` never populates a declared element field |
| PLAY0285 | a spec's `then` event contradicts every possible declared producer of its `when` command (decidable literals, property copies, equality conditions). Fix the model or the spec deliberately. **False positive** on reaction cascades with the compiler bundled in cratis before 3.28.2 (4.60.1; cli#242; reachability through reactions and `invokes` was added later); gone in 4.66.0 and cratis 3.28.2 (probed). On an older bundle confirm with the standalone tool, record a tool gap, do not "fix" a correct model |
| PLAY0286 | spec value is not a member of the enum |
| PLAY0287 | producer/capture/spec assigns a field the event lacks |
| PLAY0291-0294 | bad single-line JSON / unknown key / wrong shape / duplicate key |

## Binding (V2 and V3) - see `executable-subset.md` for the full table
| Code | Meaning | Fix |
|---|---|---|
| PLAY0268 | construct the ESM cannot represent; read the message for the construct (`executable-subset.md` lists the common ones: handler, list or observable query, `@pii`, `produces when` over read models, v6 constructs on cratis before 3.28.2) | stay in design mode, or change the construct if the domain allows; never strip `@pii`/authorization |
| PLAY0269 / 0270 | UI deferred / authoring metadata (I) | none |
| PLAY0271 | legacy `reads` or a `concurrency` block keeps its legacy meaning and cannot bind (error) | design gap; a constraint for uniqueness; protected decisions are a target requirement |
| PLAY0273 | incoherent: ambiguous `for`, property not on event revision, operand type mismatch, derived `$eventContext` path | fix the reference |
| PLAY0350 | `null` in command/event value | Chronicle semantics (nullable event properties are CHR0012; an optional fact is a separate event), not only a binder limitation: specs cannot state an absent command/event value. Omit the value or record a capability gap; whether the optional detail is really a separate fact is a review question, not this code's fix |
| PLAY0351 | given/then readmodel lacks the key property | add the keyed query's `by` property |
| PLAY0352 | when-less spec asserting events/errors | add a `when` or assert readmodel/query |
| PLAY0389 | gated command/query exercised without `given caller` | add `given caller` (empty block = anonymous) |

## Frequent errors
| Code | Meaning / fix |
|---|---|
| PLAY0001 | unknown top-level word (e.g. `slice` at top level of an un-imported file; `numbers` on a compiler older than 4.64.0) |
| PLAY0007 | a `concept` line is not `concept <Name> : <Type>` |
| PLAY0042 | a `produces` line is neither `produces <EventType>` nor `produces when <condition>` (the event goes on its own line and `for` on the line below) |
| PLAY0048 | a query body line opens with a word a query does not declare by (for example `observable` as a body line; it belongs in the return position) |
| PLAY0295/0297 | `$eventContext` path starts with an unknown member (W) / continues below `causation` or `tags` (E) |
| PLAY0357 | a `$strings.` message without a valid dotted key (blocks binding) |
| PLAY0508-0513 | `numbers exact` preamble errors (syntax only; a valid exact document still cannot bind, PLAY0268) |
| PLAY0006 | tab indentation (W) |
| PLAY0017/0019 | `identifier` outside a command / on an event property |
| PLAY0058 | unexpected token in projection (often a `#` comment) |
| PLAY0114/0117/0120 | policy without `require`; claim needs `claim "x" matches "v"` |
| PLAY0141 | unreadable rule (e.g. `length 3 to 10`; use `min`/`max`/`length ==`) |
| PLAY0191 | more than one builder for a read model |
| PLAY0193 | more than one `for` in a production |
| PLAY0358/0097 | more than one `when` action |
| PLAY0386-0389 | `given caller` shape / duplicates / `then denied` mixed / missing |
| PLAY0390-0393 | constraint: unknown event, property not on event, duplicate name, `ignore casing` on `unique event` |
| PLAY0410/0411/0412 | same view read twice / duplicate alias / alias collision |
| PLAY0453 | `then no readmodel` needs `RM for "<key>"` |
| PLAY0461 | clock instant not ISO 8601 with `Z`/offset |
| PLAY0468 | `when query` argument is not a `by`/`filter` param |
| PLAY0474 | `produces event` (inline) outside a command, e.g. in a reaction |
| PLAY0478 (I) | plain `produces` without `for`: add `for <identifier>` |
| PLAY0469 (I/W) | command identifier copied into the payload while targeting it |
| PLAY0479 (I) | legacy `?` optional |
| PLAY0480/0484 | modifier order `Type optional generated identifier` |
| PLAY0289 | (binding) no documents: empty root |

Fix order: E at V1 -> W at V1 -> silent-gap check -> V2 codes (if the mode needs V3).
Report each as `code file:line one-line meaning`; never paste more than about 30 lines.

## Render admission (V5): `STAGE-*`, `CLI-RENDER-*`, `STAGE-CRATIS-*`
Full table with causes: `renderable-subset.md`. Codes you meet most:
| Code | Meaning |
|---|---|
| STAGE-ESM-016 | model above the admitted ESM schema (v4 on Stage 4.24.2: v5 absence and v6 constructs; 4.24.1 admitted v3, so a v4 model with generations was refused): whole model refused |
| STAGE-ESM-025 | Stage 4.24.2: a typed-context member references a historical event revision or property identity; only the current revision renders |
| STAGE-ESM-026 | Stage 4.24.2: a selected event, or an event a selected scope depends on, is above its initial revision; Stage cannot render event-type migrations yet (Stage#204, needs Screenplay#71); gap-fill and hand-write the migrations |
| STAGE-ESM-024 | ledger-only (Stage 4.24.1 and later): the ESM v6 members are dispositioned Rejected; a v6 model is still refused whole by STAGE-ESM-016, so this is not the code a user sees |
| CLI-RENDER-003 | historical: reported by cratis 3.28.2 and earlier for an ESM v4 model with generations; not emitted since 3.28.3, which reports an evolved event with `STAGE-ESM-026` |
| STAGE-ESM-001 | slice kind is not `StateChange`/`StateView` (Automation, Translate: Stage#79) |
| STAGE-ESM-004 / 006 / 013 | more than one command per `StateChange`; conditional or value-expression production; other context value |
| STAGE-ESM-005 / 015 | code rule or code validation; opaque policy or an ownership claim against a Uuid-backed target |
| STAGE-ESM-007 / 009 / 010 / 017 | projection shape (one per read model, cardinality, query delivery, keys, `all`, event-context values) |
| STAGE-ESM-011 | specification shape not rendered (`when append`, `then no readmodel`, composite values) |
| STAGE-ESM-014 | constraint shape (multi-claim in one command, intra-command multi-event change) |
| STAGE-ESM-019/022 | reducer body outside the pure allowlist |
| STAGE-ESM-020 | a body the model requires is missing or changed (content hash check); blocks publication |
| STAGE-CRATIS-005 | a modeled artifact would render into `Customizations/` |
Fix by changing the model only where the domain allows it; otherwise the slice is gap-fill
with the model as its contract (`cratis-screenplay-render-and-gap-fill`).
