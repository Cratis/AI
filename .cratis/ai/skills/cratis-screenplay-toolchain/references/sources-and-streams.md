# Event sources, streams and command routes

What a model that uses `eventsource`, `stream`, `streamId` or a command route can and
cannot do today. Facts read at Screenplay v4.64.0 (`SemanticModelBinder.CommandProductions.cs`),
Stage v4.24.0 (`SemanticCratisAdmission.cs`) and Chronicle v19.30.0 / Arc v22.49.0.

| Activity | Today |
| --- | --- |
| Author in `.play` (syntax, MCP views `event-sources`, `event-streams`, `command-routes`) | yes, since Screenplay v4.62.0 |
| Validate (V1: authorable) | yes |
| Bind (V3) and run specifications | no: binding reports `PLAY0268`; the whole application then has no executable model. V2 (executable diagnostics) shows that blocking `PLAY0268` as the evidence for the blocked V3 |
| Render (V5) | no: Stage admits ESM v1 to v3 only, so the model is refused with `STAGE-ESM-016` |
| Deliver as code | gap-fill by hand with the model as the contract (`cratis-screenplay-render-and-gap-fill`, case C) |

Why binding refuses: the constructs need an ESM version that is **allocated** but **not
implemented**. The highest **implemented** ESM version is v6. At 4.64.0 the `PLAY0268`
message names the allocated version; do not copy a number into a model, a skill or a
decision, because the numbering is under decision (Cratis/Screenplay PR #401). Tracked in
Cratis/Screenplay#407 (increment 2 of #302).

Stage: even when a model uses none of these constructs, Stage 4.24.0 renders appends
without event source type, event stream type or event stream id, so Chronicle's defaults
apply. Tracked in Cratis/Stage#177, #200 and #201. Keep a declared route as intent in the
model and implement it in hand-written code; never remove it to make the model bind or render.

Code-level target for the hand-written part: `IEventSource`, `[EventSource]`, `[EventStream]`
(Chronicle 19.30.0 and later) and Arc's `[EventSource<TSource>(stream)]` on a command
(Arc 22.49.0 and later); see `cratis-chronicle-client-dotnet` and `cratis-arc-command`
(`references/handler-shapes.md`).
