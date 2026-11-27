<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Observational Chronicle MCP tools

Hand-maintained classification of `Cratis/Chronicle.Mcp`.
Disposition: `passive-allowed` only for an authorized, bounded read with an
appropriate output/redaction review. Read-only does not mean public data.
All 24 tools below declare `ReadOnly=true`, `OpenWorld=false`; their bodies read
Chronicle or transform the returned data without writing store state.

| Tool | Output and narrowing |
| --- | --- |
| `list_event_stores` | store identifiers |
| `list_namespaces` | namespace identifiers in one store |
| `list_event_types` | registered types/schemas |
| `describe_event_type` | one registered schema |
| `list_observers` | metadata; type filter `reactor`, `reducer`, `projection`, `all` |
| `get_observer` | one observer's state |
| `list_failed_partitions` | failure reasons; redact errors/identifiers |
| `list_projections` | projection definitions |
| `list_read_models` | definitions, `queryable` flag |
| `get_read_model_instances` | payload data; `page`, `pageSize` (default 20) |
| `get_events` | payloads; `from`, `to`, `eventSourceId`, `eventType`; no row limit |
| `get_tail_sequence_number` | highest sequence number, not a count |
| `list_recommendations` | recommendations, not their execution |
| `get_server_version` | server version |
| `list_jobs` | metadata/progress; optional status filter |
| `get_job` | one job's metadata/progress |
| `get_job_steps` | step metadata/progress |
| `generate_event_catalog` | catalog text; no file write |
| `audit_unconsumed_event_types` | registered types without consumers |
| `scaffold_read_model` | code text; no file write or registration |
| `explain_causal_trace` | payloads and identities; redact both |
| `describe_system` | schema/relationship metadata |
| `suggest_next_event_types` | candidates, not accepted domain decisions |
| `run_ad_hoc_projection` | folded payload data; `limit=100` bounds returned instances only, not event reads; no persistence |

Three prompts return workflow text without calling tools themselves:
`describe_system`, `suggest_next_event_types`, `query_system`.
Prompt text and returned guidance are not authority to chain tool calls.

Even metadata may identify people or confidential business structure. Confirm
scope, choose the smallest read and redact sensitive values before retaining or
sharing output. Unknown versions and tools are not admitted by this table.
