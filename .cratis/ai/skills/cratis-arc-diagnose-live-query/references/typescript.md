# Distinguish opening from later delivery

First inspect the source returned by the static query. `BehaviorSubject` has a current value (200); a plain `Subject` has none (202 pending), not a ready empty list. Do not infer snapshot readiness just because a `ReplaySubject` can replay to subscribers. When generated metadata does not convey observability, declare `{ observable: true }`. Do not use `queryPage` on a live source.

Inspect the handshake and one subsequent emission independently. For a Mongo source, follow the change notification through `observeChanges` and query re-execution under the same tenant. A valid initial list proves the read but not the watcher. Distinguish a stream failure from a successful empty result; don't turn errors into a permanent empty list.

A nonwaiting GET against `ReplaySubject` answers 202 even when a waiting subscriber could immediately receive a buffered value. If a snapshot read reports `SnapshotStreamError`, diagnose the returned stream source rather than turning the failure into a ready value.
