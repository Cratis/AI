---
name: cratis-platform-diagnose-slice
description: Use when tracing a missing update between a successful command and an open list, such as a registration that never appears on the Authors screen. Not for repairing a known observer problem (use cratis-chronicle-inspect-observer).
compatibility: Requires a running Library host, Chronicle and access to the Authors list.
---

# Find where registration stops reaching the Authors list

Add the `Cratis.OpenTelemetry` package to the Library host. In `Program.cs`, import `Cratis.OpenTelemetry` and add the following after creating the web application builder, before building the host:

```csharp
builder.AddCratisOpenTelemetry(options => options.ServiceName = "library");
```

This registers Cratis traces and metrics for the host, not the kernel. To send them to a collector, configure the host's `OTEL_EXPORTER_OTLP_ENDPOINT`. Select the trace for one registration request. Keep its author ID, store and namespace fixed through the checks below; aggregate request counts cannot identify the missing row.

1. Submit `RegisterAuthor` with a fresh `AuthorId` and name Aster. Inspect `CommandResult.IsSuccess`. On refusal, inspect the validation results before investigating the list.
2. In the Library event store and the application's namespace, read `eventLog.GetForEventSourceIdAndEventTypes(authorId, [typeof(AuthorRegistered).GetEventType()])` as in [reading back the append](../cratis-chronicle-record-event/SKILL.md). For this fresh ID take the single event and record `stored.Context.SequenceNumber` and `EventSequenceId.Log`; a successful command result alone does not establish the append.
3. Read `await eventStore.Observers.GetAll()` and select the observer whose ID is `Library.Features.Authors.Listing.Author`. In `Features/Authors/Diagnostics/AuthorListingProgress.cs`, use [ComparePosition](../cratis-chronicle-inspect-observer/SKILL.md) with that observer, the same event sequence ID and the recorded write position. Compare `LastHandledEventSequenceNumber` only within the same store, namespace and sequence.
4. After catch-up, check the materialized row independently in the tenant's read-model database and collection. Look up the written source by its persisted row key and check its projected fields. If the observer reached the write and that row is missing or stale, investigate the projection, key or storage mapping.
5. **Rerun the query for the original key before touching the screen.** As the same librarian in the same tenant, repeat the application's lookup for the original `AuthorId`. For Library's `AllAuthors` collection query, make a new HTTP `GET <query-route>?waitForFirstResult=true` (no SSE or WebSocket) and look for that exact `Id` in the fresh result. A plain GET on an observable query can return 202 with `isReady: false` and no data; that is not an answer, so never read it as a missing row. A database row check cannot replace rerunning the query. If the fresh query returns the row but the screen doesn't, inspect the open subscription for that ID using the [live query diagnostic](../cratis-arc-diagnose-live-query/SKILL.md) before changing React rendering.

## Example: a registration at position 12

| Result | Next check |
|---|---|
| AuthorRegistered at 12; observer at 11 | The observer hasn't reached the write. Check its running state and failures for this author ID. |
| Observer reaches 12 | Check the persisted row, then rerun the lookup for Aster's exact `AuthorId` against a fresh `AllAuthors` result from `GET <query-route>?waitForFirstResult=true`. If absent from a ready result, check the projected row key and query scope, not the screen. |
| Query contains the author; open screen doesn't | Distinguish a missing subscription update from a row the component didn't render. |

## Avoid

- Don't infer a failed append from a missing telemetry span; inspect the event log.
- Don't log sensitive payloads or credentials in a diagnostic capture.

## Related skills

- [Exercise the complete slice](../cratis-platform-deliver-slice/SKILL.md) after correcting the first failing step.

- [Inspect the observer](../cratis-chronicle-inspect-observer/SKILL.md) to investigate a confirmed checkpoint gap.
