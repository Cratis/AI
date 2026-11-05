<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Configure Arc for TypeScript

Source: `Cratis/Arc.TypeScript`: `Documentation/configuration/index.md`,
`Source/Core/configuration/loadConfiguration.ts`. Settings live in one
`ArcOptions` object. Serializable settings may come from `appsettings.json`,
environment variables and code; **code always wins**.

## Which entry point reads configuration

| Entry point | Reads `appsettings.json` and environment |
| --- | --- |
| `ArcApplication.createBuilder()` (`@cratis/arc.core`) | Yes, unless `configuration: false` |
| `CratisApplication.createBuilder()` (`@cratis/cratis`) | Yes, including `Cratis:Chronicle` |
| `ArcApplication.createBuilder()` from `@cratis/arc.core/fetch` | No; code options only (no filesystem) |
| `new ArcServer(options)` | No; code options only |

Precedence, lowest to highest: `appsettings.json` in the working directory,
`appsettings.{Environment}.json`, `Cratis__...` environment variables, then code
options. `Cratis__Arc__CorrelationId__HttpHeader=X-Other-ID` overrides the file;
`correlationId: { httpHeader: 'X-Code-ID' }` overrides that variable. Choose
files explicitly with `{ configuration: { file: new URL(...), env } }`.

```json
{ "Cratis": { "Arc": {
    "Tenancy": { "ResolverType": "Fixed", "FixedTenantId": "default" },
    "GeneratedApis": { "RoutePrefix": "api", "EnableQueryHttpMethod": true },
    "Query": { "KeepAliveInterval": "00:00:30" },
    "Hosting": { "ApplicationUrl": "http://127.0.0.1:3000/" },
    "ExposeExceptionDetails": false } } }
```

## Core options (configuration path / code path)

| Option | Default | Effect |
| --- | --- | --- |
| `ExposeExceptionDetails` / `exposeExceptionDetails` | `true` only in Development | Include exception messages and stack traces in results; otherwise redacted |
| `Development` / `development` | `false` | Enables development user and tenant discovery only; not an auth bypass |
| `Introspection:Enabled` / `introspection.enabled` | `true` | `false` unmaps catalogs and OpenAPI everywhere |
| `CorrelationId:HttpHeader` / `correlationId.httpHeader` | `X-Correlation-ID` | Request and response correlation header |
| `GeneratedApis:RoutePrefix` / `generatedApis.routePrefix` | `api` | Convention route prefix |
| `GeneratedApis:SegmentsToSkipForRoute` | `0` | Leading namespace segments dropped from routes |
| `GeneratedApis:IncludeCommandNameInRoute`, `IncludeQueryNameInRoute` | `true` | Append the artifact name to its route |
| `GeneratedApis:EnableQueryHttpMethod` | `true` | Accept HTTP `QUERY`; `false` answers 405 with `Allow: GET` |
| `GeneratedApis:OpenApiVersion` | `0.1.0` | OpenAPI `info.version` (TypeScript only) |
| `Query:KeepAliveInterval` / `query.keepAliveIntervalMs` | 30 s | Idle hub `Ping`; `hh:mm:ss` in files, milliseconds in code, `0` disables in code |
| `Hosting:ApplicationUrl` / `hosting.applicationUrl` | `http://127.0.0.1:3000/` | Standalone listener; `app.run({ host, port })` overrides |
| `Hosting:MaxBodyBytes` / `hosting.maxBodyBytes` | `1048576` | Largest JSON command or `QUERY` body |
| `Tenancy:*` | see `cratis-arc-tenancy-typescript` | Tenant selection and membership |

Keep route options equal to the proxy generator's `--api-prefix`,
`--segments-to-skip`, `--skip-command-name-in-route` and
`--skip-query-name-in-route` (see `proxy-generator-options.md`).

## Observable-query limits (code options under `query`)

| Option | Default |
| --- | --- |
| `allowedOrigins` | same origin; exact HTTP(S) origins or a code-only predicate |
| `observableEmissionGuards` | `[]` (scoped guard tokens) |
| `enableObservableHealth` | `false` |
| `maxObservableSubscriptions` / `...PerCaller` | 4096 / 4096 |
| `maxObservableHubConnections` / `...PerCaller` | 512 / 512 |
| `maxObservableHubSubscriptionsPerConnection` | 256 |
| `maxObservableInboundFrames` / `maxObservableOutboundFrames` | 256 / 256 |
| `maxObservableInboundFrameBytes` / `maxObservableOutboundFrameBytes` | 65536 / 1048576 |
| `maxObservablePendingEmissions` | 256 |
| `maxObservableTombstones` | 1024 per hub connection |
| `observableHandshakeTimeoutMs`, `observableShutdownTimeoutMs` | 10000 each |

## Package options bound from configuration

| Builder method | Configuration it binds |
| --- | --- |
| `withMongoDB({ ... })` | `Cratis:MongoDB:{Server,Database}` |
| `withDrizzle({ ... })` | none; pass the database in code |
| `withChronicle({ ... })` | `Cratis:Chronicle:{ConnectionString,EventStore}` |

Low-level `commands`, `queries` and `observableQueries` arrays take
`defineCommand`/`defineQuery` definitions; the model-bound decorators are the
default.
