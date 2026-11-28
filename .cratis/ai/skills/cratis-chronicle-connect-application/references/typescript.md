# Open a scoped Node store

With `ChronicleOptions.development()` only for a loopback kernel, create `const client = new ChronicleClient(options)` and `const store = await client.getEventStore("library", "test")`. Include the built artifact modules in discovery before opening the store. Use validated TLS and deployment credentials outside development. Check a registered event in the selected namespace; release the client with `client.dispose()` when the owning service stops.

For built JavaScript, configure `discoveryPatterns` for the emitted modules or import the artifacts explicitly. The default scan in a TypeScript process includes `.ts` and `.tsx` but excludes declarations, specs, tests, dependencies and built output; a plain JavaScript entry point has no default scan. The default connection string skips certificate validation: set `skipTlsValidation=false` when connecting outside loopback. Do not log a credential-bearing URL.

## Make schemas work in built JavaScript

Install `@cratis/chronicle`, its `@cratis/fundamentals` peer and `reflect-metadata`. At the top of the entry point, before importing any decorated artifacts, `import 'reflect-metadata';`. Prefer standard decorators with TypeScript 5.2+ and an `ES2022` target: leave `experimentalDecorators` and `emitDecoratorMetadata` unset. Use `experimentalDecorators: true` and `emitDecoratorMetadata: true` only for an existing legacy-decorator build. Ensure esbuild or tsx uses the intended tsconfig; do not rely on either to emit design type metadata.

Declare each serialized event field with its runtime type, for example `@field(String) title = '';` with `field` from `@cratis/fundamentals`. In a built JavaScript smoke spec, load the real entry-point initialization and inspect `getEventTypeJsonSchemaFor(BookAdded)` from `@cratis/chronicle/events`; verify the expected `title` property is a string.
