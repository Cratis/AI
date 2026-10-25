<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Recovery outcomes and namespace comparison

Check the installed `cratis llm-context` and server version before using these
commands. Confirm server, event store, namespace and exact targets. A prompt or
`--yes` is not authority to mutate a live store.

## Jobs: acceptance is not completed removal

Requires CLI 3.79.0 for `chronicle jobs stop` / `resume` and the terminal
Workbench to report kernel refusals as failures, with reasons in text/JSON and a
nonzero exit. Do not parse an old CLI's success message as proof of progress.
Inspect the job again; resume can be refused for missing, concluded, unpersisted
or otherwise unresumable work. Do not repeat it without understanding the reason.

Requires CLI 3.99.0 for `cratis chronicle jobs delete <JOB_ID>`. It is destructive
and irreversible: retained job state is removed. Before confirmation it names
the store, namespace and job id. An invalid GUID, declined/unavailable prompt,
server refusal, authorization failure or server error is nonzero. `--yes` skips
only the local prompt; the server still authorizes and decides. Exit zero and
"deletion requested" are **not** proof of completed removal. Capture the relevant
pre-state first and inspect again after an authorized deletion. This is not a
terminal Workbench key or permission to delete every retained job.

## Retry all failed partitions

Requires CLI 3.79.0 and Chronicle 19.80.0 for
`cratis chronicle observers retry-failed-partitions <OBSERVER_ID>`. It starts
server-owned bounded-batch recovery and reports how many partitions were failed;
it does not wait for all handlers to succeed. Inspect failures first, fix their
cause, authorize the observer-wide target, then re-read state after the request.
Do not mistake this for a client loop of one-partition requests or a guarantee
that quarantines were cleared.

## Inspect or repair a closed scope

Requires CLI 3.80.0 and Chronicle 19.39.0 for
`cratis chronicle streams closed list`. It is read-only and lists exact scope
dimensions, origin, owner constraint, sequence number and closing time. Filter by
event source id/type and event stream type/id; do not select a repair from a
partial dimension match.

`cratis chronicle streams closed reopen --reason <text>` is a confirmed,
mutating repair of **one exact** mistaken manual close. Supply the scope flags
shown by the installed help/catalog and the reason. The kernel records actor
and reason in `StreamScopeReopened` and refuses a closure owned by a closing
event. `--yes` skips confirmation, not that ownership check. Never turn this into
a way around a modeled closure or reopen broad scopes speculatively.

## Compare a model with live metadata

Requires CLI 3.85.0 for
`cratis screenplay conform-namespace <model> --event-store <store> --namespace <ns>`.
This is a read-only comparison, not model authoring, rendering or state repair.
It compares registered event types, producing commands/reactors and observers
with the model, scanning metadata up to the tail captured at start. The default
`--max-events` is `100000`; `--from`/`--to` bound a range. A partial scan stays
partial; without `--fail-on-drift` a drift report need not fail the command.

Requires 3.89.1 for authorization failures to exit 4 (`authentication_error`),
Ctrl+C between pages to exit 8 (`inconclusive`), and event attribution only when
the causation is a command. Chronicle's metadata API still transmits event source
ids and subjects; the CLI drops them without persisting them. Do not claim they
never cross the connection. It does not request payloads or command values.
Redact the report before sharing it, and do not treat an incomplete or cancelled
comparison as evidence of conformance.
