# Generate proxies from a Mix application

Run `mix arc.gen.proxies --application MyApp.Arc --output assets/src/arc` with the application's actual Arc module. Configure `arc: [application: MyApp.Arc, output: "assets/src/arc"]` in the Mix project to make `mix arc.gen.proxies` reproducible. Keep the generated directory separate from handwritten components. In CI `mix arc.gen.proxies --check` reports stale output without rewriting it.
