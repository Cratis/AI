<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Arc and Chronicle signals

Sources: Arc `Source/DotNET/Arc.Core/WellKnownDiagnostics.cs`, `WellKnownTelemetryNames.cs`, `Source/DotNET/MongoDB/WellKnownMongoDBDiagnostics.cs`, `Documentation/backend/csharp/observability.md`; Chronicle `Source/Clients/DotNET/Diagnostics/OpenTelemetry/Tracing/ClientActivity.cs`, `ChronicleTelemetryOptions.cs`, `Documentation/hosting/client-tracing.mdx`, `Documentation/hosting/configuration/telemetry-names.md`. Read the release you consume.

## Arc

Activity source and meter: `Cratis.Arc`. MongoDB meter: `Cratis.Arc.MongoDB`.

| Span | Meaning |
| --- | --- |
| `cratis.arc.command.execute` | Whole command execution |
| `cratis.arc.command.validate`, `.filter`, `.authorize`, `.provide`, `.handle` | Pipeline stages |
| `cratis.arc.validator.invoke` | One validator |
| `cratis.arc.query.perform`, `cratis.arc.query.push` | Query execution and observable push |
| `cratis.arc.command.action`, `cratis.arc.query.action` | Controller-based actions (server spans) |

| Attribute | Meaning |
| --- | --- |
| `cratis.arc.command.type`, `cratis.arc.command.outcome`, `cratis.arc.command.key.type` | Command identity and result |
| `cratis.arc.query.name`, `cratis.arc.query.transport`, `cratis.arc.query.outcome` | Query identity, transport and result |
| `cratis.correlation_id` | Business correlation id |
| `cratis.tenant.id` | Tenant (also legacy `cratis.tenant`); span attribute only, never resource or baggage |
| `http.route` | Route template, never a concrete URL |

| Metric | Kind |
| --- | --- |
| `cratis.arc.command.duration` | Histogram, seconds |
| `cratis.arc.command.outcomes` | Counter |
| `cratis.arc.query.duration` | Histogram, seconds |
| `cratis.arc.query.subscriptions` | Up-down counter of open subscriptions |
| `cratis.arc.query.pushes` | Counter |

Arc records at most 1,000 distinct command types or query names per metric and folds the rest into `_other`. A command rejected by validation or authorization does not fail the span; the outcome attribute carries the rejection.

## Chronicle .NET client

Activity source: `Cratis.Chronicle.Client` (`ClientActivity.SourceName`). Registration: `AddCratisOpenTelemetry` covers it through `Cratis.*`. Without it, `AddCratisChronicleInstrumentation()` (package `Cratis.Chronicle.AspNetCore`, namespace `Cratis.Chronicle.AspNetCore.OpenTelemetry`) or `AddSource("Cratis.Chronicle.Client")` is required, in the same tracing configuration as the exporter.

| Legacy span (default) | Convention span (`Telemetry:SpanNames=Convention`) |
| --- | --- |
| `client.event_sequence.append` | `cratis.chronicle.client.event_sequence.append` |
| `client.event_sequence.append_many` | `cratis.chronicle.client.event_sequence.append_many` |
| `client.unit_of_work.commit`, `client.unit_of_work.rollback` | `cratis.chronicle.client.unit_of_work.commit`, `...rollback` |
| `client.reactor.handle` | `cratis.chronicle.client.reactor.handle` |
| `client.reducer.handle` | `cratis.chronicle.client.reducer.handle` |

The option form is `ChronicleTelemetryOptions.SpanNames = ClientSpanNames.Convention`. Failed append and handle operations set Error status and `error.type` without messages. Append spans carry `cratis.chronicle.append.outcome`: `success`, `error`, `concurrency_violation` or `constraint_violation`. Both modes also carry shared keys such as `cratis.event_store.name`, `cratis.event_sequence.id` and `cratis.correlation_id`; legacy keys such as `correlation_id` appear only on the unit-of-work spans, so search on the shared key.

Kernel spans call the event source id `cratis.eventsource.id`; client spans use `event_source_id`. Both follow their own exposure setting.

## Naming modes

Legacy names stay the default. Legacy keys are deprecated for removal in the next major version, so build new dashboards on convention names where the mode is available, and use `Both` only as a temporary migration mode.
