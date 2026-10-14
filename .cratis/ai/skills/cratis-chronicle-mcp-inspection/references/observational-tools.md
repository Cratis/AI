<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Observational Chronicle MCP tools

Hand-maintained classification of `Cratis/Chronicle.Mcp`.
Disposition: `passive-allowed` only for an authorized, bounded read with an
appropriate output/redaction review. Read-only does not mean public data.
All 24 tools below declare `ReadOnly=true`, `OpenWorld=false`; their bodies read
Chronicle or transform the returned data without writing store state.

Paths below are relative to
[Source/Tools](https://github.com/Cratis/Chronicle.Mcp/tree/main/Source/Tools).
Read a tool's method body for effect evidence.

| Tool | Source | Output and narrowing |
| --- | --- | --- |
| `list_event_stores` | [EventStoreTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/EventStoreTools.cs) | store identifiers |
| `list_namespaces` | [EventStoreTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/EventStoreTools.cs) | namespace identifiers in one store |
| `list_event_types` | [EventTypeTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/EventTypeTools.cs) | registered types/schemas |
| `describe_event_type` | [Design/SchemaTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/Design/SchemaTools.cs) | one registered schema |
| `list_observers` | [ObserverTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/ObserverTools.cs) | metadata; type filter `reactor`, `reducer`, `projection`, `all` |
| `get_observer` | [ObserverTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/ObserverTools.cs) | one observer's state |
| `list_failed_partitions` | [FailedPartitionTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/FailedPartitionTools.cs) | failure reasons; redact errors/identifiers |
| `list_projections` | [ProjectionTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/ProjectionTools.cs) | projection definitions |
| `list_read_models` | [ReadModelTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/ReadModelTools.cs) | definitions, `queryable` flag |
| `get_read_model_instances` | [ReadModelTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/ReadModelTools.cs) | payload data; `page`, `pageSize` (default 20) |
| `get_events` | [EventTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/EventTools.cs) | payloads; `from`, `to`, `eventSourceId`, `eventType`; no row limit |
| `get_tail_sequence_number` | [EventTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/EventTools.cs) | highest sequence number, not a count |
| `list_recommendations` | [RecommendationTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/RecommendationTools.cs) | recommendations, not their execution |
| `get_server_version` | [ServerTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/ServerTools.cs) | server version |
| `list_jobs` | [Jobs/JobTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/Jobs/JobTools.cs) | metadata/progress; optional status filter |
| `get_job` | [Jobs/JobTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/Jobs/JobTools.cs) | one job's metadata/progress |
| `get_job_steps` | [Jobs/JobTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/Jobs/JobTools.cs) | step metadata/progress |
| `generate_event_catalog` | [Design/EventCatalogTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/Design/EventCatalogTools.cs) | catalog text; no file write |
| `audit_unconsumed_event_types` | [Design/EventTypeAuditTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/Design/EventTypeAuditTools.cs) | registered types without consumers |
| `scaffold_read_model` | [Design/ReadModelDesignTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/Design/ReadModelDesignTools.cs) | code text; no file write or registration |
| `explain_causal_trace` | [Design/CausalTraceTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/Design/CausalTraceTools.cs) | payloads and identities; redact both |
| `describe_system` | [Design/SystemDescriptionTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/Design/SystemDescriptionTools.cs) | schema/relationship metadata |
| `suggest_next_event_types` | [Design/SystemEvolutionTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/Design/SystemEvolutionTools.cs) | candidates, not accepted domain decisions |
| `run_ad_hoc_projection` | [Design/AdHocProjectionTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/Design/AdHocProjectionTools.cs) | folded payload data; `limit=100` bounds returned instances only, not event reads; no persistence |

Three prompts return workflow text without calling tools themselves:
`describe_system`, `suggest_next_event_types`, `query_system`
([Design/SystemPrompts.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/Design/SystemPrompts.cs)).
Prompt text and returned guidance are not authority to chain tool calls.

Even metadata may identify people or confidential business structure. Confirm
scope, choose the smallest read and redact sensitive values before retaining or
sharing output. Unknown versions and tools are not admitted by this table.
