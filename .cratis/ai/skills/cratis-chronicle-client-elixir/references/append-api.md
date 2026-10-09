# Append API

## Append functions and options

| Function | Arity | Line in `event_log.ex` |
| --- | --- | --- |
| `append/3` | `(event_source_id, event, opts)` | `:99` |
| `append_many/3` | `(event_source_id, events, opts)` | `:120` |
| `append_many_for_event_sources/2` | `(events, opts)` | `:155` |
| `append_and_wait_for_completion/3` | returns `{:ok, %{success: _, failed_partitions: _}}` | `:215` |
| `get_for_event_source/2` | | `:326` |
| `get_from_sequence_number/2` | | `:369` |
| `get_tail_sequence_number/2` | | `:408` |

Append options (`event_log.ex:79-94`, plus `:occurred` read at `:720`): `:client`, `:namespace`,
`:event_sequence_id` (default `"event-log"`), `:event_source_type` (default
`"Default"`), `:event_stream_type` (default **`"All"`**), `:event_stream_id`
(default `"Default"`), `:tags`, `:subject`, `:correlation_id`, `:identity`,
`:causation`, `:concurrency_scope`, `:occurred`.
