# Generate proxies from a Mix application

Run `mix arc.gen.proxies --application MyApp.Arc --output assets/src/arc` with the application's actual Arc module. Configure `arc: [application: MyApp.Arc, output: "assets/src/arc"]` in the Mix project to make `mix arc.gen.proxies` reproducible. Keep the generated directory separate from handwritten components. In CI `mix arc.gen.proxies --check` reports stale output without rewriting it.

Enable the `:arc` compiler in the Mix project. For `layout: :colocated` place `package.json` above `lib` so generated imports resolve. Keep the generated marker intact: stale cleanup distinguishes owned files from handwritten files. Slice identity follows the module namespace after `segments_to_skip`; associate events a command actually constructs with its slice. Use `consumes:` for read-model inputs the compiler cannot infer, and `event_model_strict: true` to make model inconsistencies fail the build.
