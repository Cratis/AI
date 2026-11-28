# Generate proxies from a Mix application

Run `mix arc.gen.proxies --application MyApp.Arc --output assets/src/arc` with the application's actual Arc module. Configure `arc: [application: MyApp.Arc, output: "assets/src/arc"]` in the Mix project to make `mix arc.gen.proxies` reproducible. Keep the generated directory separate from handwritten components.

Enable the `:arc` compiler in the Mix project. For `layout: :colocated` place `package.json` above `lib` so generated imports resolve. Keep the generated marker intact: stale cleanup distinguishes owned files from handwritten files. Slice identity follows the module namespace after `segments_to_skip`; associate events a command actually constructs with its slice. Use `consumes:` for read-model inputs the compiler cannot infer.

**Check committed proxies before updating them.** `mix arc.gen.proxies --check` runs `compile` before its dry run. In the CI freshness job omit `:arc` from `compilers` and run the check from a clean checkout before any generating build. Otherwise the compiler can repair the files and mask drift. Change a command field without regenerating its committed proxy: the check must exit nonzero and leave the proxy unchanged.

**Check the event model separately.** Append `:arc_event_model` to `Mix.compilers()` and set `event_model_strict: true` inside the project's `arc: [...]` options alongside `application:`. In a test project, compile a state-change slice whose command appends no event. Expect a nonzero compile, not a warning or a successful proxy check.
