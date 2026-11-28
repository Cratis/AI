---
name: cratis-chronicle-inspect-observer
description: Use when a Chronicle observer failure is confirmed and an operator needs to inspect its checkpoint or failed partitions. Not for a stale result with an unknown failing boundary (use cratis-platform-diagnose-slice).
compatibility: Access to observer diagnostics for the affected store and namespace.
---

# Locate the first missing delivery

Start with the accepted event's sequence and position, its source ID, and the expected observer ID. Select the **same store and namespace**. For example, a listing observer at position 15 is behind an author registration at 20 only if both positions are actual positions on the same sequence. Even reaching 20 doesn't prove the author's partition succeeded.

Read the inspection path for the host:

- `.csproj`: [inspect registration, progress and failures](references/csharp.md).
- Node server: [read the observer list and failed partitions](references/typescript.md).
- `.kt`: [inspect from a coroutine](references/kotlin.md).
- `.java`: the blocking store has no observer inspection facade; [inspect from Workbench](references/java.md).
- `go.mod`: [read scoped snapshots](references/go.md).
- `mix.exs`: [query the selected client](references/elixir.md).
- Python has no released application client: [request a scoped diagnostic from the owning service](references/python.md).

If the observer is absent, check scope and registration; do not diagnose lag. If present, distinguish a failed partition from a paused or quarantined observer and a failed lookup from a successful empty result. Record the observer ID, sequence, last actual position, affected partition and last failure without payloads. For a changed definition, check the deployed mapping and replay policy separately from previously stored views. Rebuilding a view does not undo an external effect. Stop before retry, replay, removal or job changes.
