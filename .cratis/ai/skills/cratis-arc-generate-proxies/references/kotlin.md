# Generate from Kotlin contracts

In the module using `io.cratis.arc`, enable `cratisArc.proxies.enabled` and set `outputDirectory` in the proxies block. Run `./gradlew generateArcProxies`. The task reads compiled artifact manifests, not a running HTTP endpoint. Keep the output directory distinct from handwritten UI modules.

Changing `proxies.segmentsToSkip` changes the file path, not the URL. To change route segments, match `endpoints.segmentsToSkip` to the runtime `cratis.arc.endpoints.segments-to-skip-for-route`. Resolve startup disagreements before testing the client.

Use `useProxyFileSuffix` to distinguish proxies and `removeStaleGeneratedFiles` for obsolete generated files. For shared types map the type or package (`mapType` / `mapPackage`) rather than generating competing copies. Mark additional model types `@ExportedType` when they must appear outside an inferred contract.
