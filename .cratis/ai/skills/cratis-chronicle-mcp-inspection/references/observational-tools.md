<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Observational Chronicle MCP tools

Hand-maintained classification, verified at **Cratis/Chronicle.Mcp v2.0.0**.
Disposition: `passive-allowed` only for an authorized, bounded read with an
appropriate output/redaction review. Read-only does not mean public data.
All 24 tools below declare `ReadOnly=true`, `OpenWorld=false`; their bodies read
Chronicle or transform the returned data without writing store state.

Paths below are relative to
[Source/Tools at v2.0.0](https://github.com/Cratis/Chronicle.Mcp/tree/v2.0.0/Source/Tools).
Line anchors name the tool attribute; read its method body for effect evidence.

| Tool | Source at v2.0.0 | Output and narrowing |
| --- | --- | --- |
| `list_event_stores` | [EventStoreTools.cs:23](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/EventStoreTools.cs#L23) | store identifiers |
| `list_namespaces` | [EventStoreTools.cs:38](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/EventStoreTools.cs#L38) | namespace identifiers in one store |
| `list_event_types` | [EventTypeTools.cs:25](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/EventTypeTools.cs#L25) | registered types/schemas |
| `describe_event_type` | [Design/SchemaTools.cs:29](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/Design/SchemaTools.cs#L29) | one registered schema |
| `list_observers` | [ObserverTools.cs:29](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/ObserverTools.cs#L29) | metadata; type filter `reactor`, `reducer`, `projection`, `all` |
| `get_observer` | [ObserverTools.cs:57](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/ObserverTools.cs#L57) | one observer's state |
| `list_failed_partitions` | [FailedPartitionTools.cs:27](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/FailedPartitionTools.cs#L27) | failure reasons; redact errors/identifiers |
| `list_projections` | [ProjectionTools.cs:25](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/ProjectionTools.cs#L25) | projection definitions |
| `list_read_models` | [ReadModelTools.cs:28](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/ReadModelTools.cs#L28) | definitions, `queryable` flag |
| `get_read_model_instances` | [ReadModelTools.cs:63](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/ReadModelTools.cs#L63) | payload data; `page`, `pageSize` (default 20) |
| `get_events` | [EventTools.cs:34](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/EventTools.cs#L34) | payloads; `from`, `to`, `eventSourceId`, `eventType`; no row limit |
| `get_tail_sequence_number` | [EventTools.cs:86](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/EventTools.cs#L86) | highest sequence number, not a count |
| `list_recommendations` | [RecommendationTools.cs:26](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/RecommendationTools.cs#L26) | recommendations, not their execution |
| `get_server_version` | [ServerTools.cs:25](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/ServerTools.cs#L25) | server version |
| `list_jobs` | [Jobs/JobTools.cs:29](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/Jobs/JobTools.cs#L29) | metadata/progress; optional status filter |
| `get_job` | [Jobs/JobTools.cs:75](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/Jobs/JobTools.cs#L75) | one job's metadata/progress |
| `get_job_steps` | [Jobs/JobTools.cs:109](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/Jobs/JobTools.cs#L109) | step metadata/progress |
| `generate_event_catalog` | [Design/EventCatalogTools.cs:32](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/Design/EventCatalogTools.cs#L32) | catalog text; no file write |
| `audit_unconsumed_event_types` | [Design/EventTypeAuditTools.cs:29](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/Design/EventTypeAuditTools.cs#L29) | registered types without consumers |
| `scaffold_read_model` | [Design/ReadModelDesignTools.cs:31](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/Design/ReadModelDesignTools.cs#L31) | code text; no file write or registration |
| `explain_causal_trace` | [Design/CausalTraceTools.cs:33](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/Design/CausalTraceTools.cs#L33) | payloads and identities; redact both |
| `describe_system` | [Design/SystemDescriptionTools.cs:44](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/Design/SystemDescriptionTools.cs#L44) | schema/relationship metadata |
| `suggest_next_event_types` | [Design/SystemEvolutionTools.cs:36](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/Design/SystemEvolutionTools.cs#L36) | candidates, not accepted domain decisions |
| `run_ad_hoc_projection` | [Design/AdHocProjectionTools.cs:44](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/Design/AdHocProjectionTools.cs#L44) | folded payload data; `limit=100` bounds returned instances only, not event reads; no persistence |

Three prompts return workflow text without calling tools themselves:
`describe_system`, `suggest_next_event_types`, `query_system`
([Design/SystemPrompts.cs:22–60](https://github.com/Cratis/Chronicle.Mcp/blob/v2.0.0/Source/Tools/Design/SystemPrompts.cs#L22-L60)).
Prompt text and returned guidance are not authority to chain tool calls.

Even metadata may identify people or confidential business structure. Confirm
scope, choose the smallest read and redact sensitive values before retaining or
sharing output. Unknown versions and tools are not admitted by this table.
