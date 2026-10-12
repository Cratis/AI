<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Observability and trusted host scopes

Verified at `Cratis/Arc.TypeScript` **v0.57.2** (source preview):
`Source/Core/execution/WellKnownTelemetryNames.ts`, `observability.ts`,
`runInScope.ts`, `RunInScopeOptions.ts`, and `Documentation/observability.md`.

- `cratis.arc.command.duration` / `cratis.arc.query.duration` measure **seconds**.
  `cratis.arc.command.outcomes` counts command outcomes; the outcome vocabulary
  is `success`, `validation`, `authorization`, `append_rejected`, `cancelled`,
  `error`. `cratis.arc.query.transport` distinguishes query transports.
- Core exports `WellKnownTelemetryNames`, `OperationOutcome`, `QueryTransport`;
  `@opentelemetry/api ^1.9.0` is a peer. Instrumentation caps command/query names
  at 1,000 to bound cardinality. Do not add raw user/tenant keys to metric names.
- `cratis.arc.operation.duration` and the `query_name` attribute are deprecated;
  migrate dashboards to command/query-specific names.

`ArcServer.runInScope(scope, callback, options?)` runs trusted host integration
work in a scope created with `server.services.createScope(context)`.
Service scopes snapshot the execution context at creation. Per-invocation
options accept only a correlation id (valid UUID) and extra abort signal.
This is **not** authentication or authorization: never turn untrusted request
values into a trusted principal by creating a scope.
