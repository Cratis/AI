---
name: cratis-platform-diagnose-slice
description: Finds the first missing result between a command and an open list. Use when registration succeeds but an Authors screen stays stale. Not for repairing a known observer problem (use cratis-chronicle-inspect-observer).
---

# Find where registration stops reaching the Authors list

1. Submit `RegisterAuthor` with a fresh `AuthorId` and name Aster. Inspect `CommandResult.IsSuccess`. On refusal, inspect the validation results before investigating the list.
2. In the Library event store and the application's namespace, read `eventLog.GetForEventSourceIdAndEventTypes(authorId, [typeof(AuthorRegistered).GetEventType()])` as in [reading back the append](../cratis-chronicle-record-event/SKILL.md). For this fresh ID take the single event and record `stored.Context.SequenceNumber` and `EventSequenceId.Log`; a successful command result alone does not establish the append.
3. Read `await eventStore.Observers.GetAll()` and select the observer whose ID is `Library.Features.Authors.Listing.Author`. In `Features/Authors/Diagnostics/AuthorListingProgress.cs`, use [ComparePosition](../cratis-chronicle-inspect-observer/SKILL.md) with that observer, the same event sequence ID and the recorded write position. Compare `LastHandledEventSequenceNumber` only within the same store, namespace and sequence.
4. Fetch `AllAuthors` once as the same librarian using the [live query diagnostic](../cratis-arc-diagnose-live-query/SKILL.md). If the row exists there but not on screen, inspect the open subscription for that ID before changing React rendering.

## Example: a registration at position 12

| Result | Next check |
|---|---|
| AuthorRegistered at 12; observer at 11 | The observer hasn't reached the write. Check its running state and failures for this author ID. |
| Observer reaches 12; query still lacks the author | Check the projected row key and the caller's query result. |
| Query contains the author; open screen doesn't | Distinguish a missing subscription update from a row the component didn't render. |

## Avoid

- Don't infer a failed append from a missing telemetry span; inspect the event log.
- Don't log sensitive payloads or credentials in a diagnostic capture.

## Related skills

- [Inspect the observer](../cratis-chronicle-inspect-observer/SKILL.md) to investigate a confirmed checkpoint gap.
