# Generate proxies from a Mix application

Keep the event model and proxies in separate directories. In the Mix project set `compilers: Mix.compilers() ++ [:arc_event_model]` and `arc: [application: MyApp.Arc, event_model_strict: true]`, using your application's module. **Omit `arc[:output]`.** The event-model compiler then owns `priv/cratis/event_model`; it may delete other files in its output directory without checking proxy markers. Never point it at proxies or handwritten files.

Generate the client explicitly with `mix arc.gen.proxies --output assets/src/arc`. Keep proxy markers intact for stale-file cleanup. For `layout: :colocated` place `package.json` above `lib` so generated imports resolve. Slice identity follows the module namespace after `segments_to_skip`; associate events a command actually constructs with its slice. Use `consumes:` for read-model inputs the compiler cannot infer.

**Check freshness before generation.** From a clean checkout run `mix arc.gen.proxies --check --output assets/src/arc`. The task compiles before its dry run: keep the automatic proxy compiler `:arc` out of the check profile so it cannot repair stale files first. Change a command field without regenerating its committed proxy; expect a nonzero check and an unchanged proxy directory.

**Check model strictness separately.** Compile a test project with a state-change slice whose command appends no event. Expect a nonzero compile, not a warning. Verify that compiling the event model leaves the proxy directory unchanged.
