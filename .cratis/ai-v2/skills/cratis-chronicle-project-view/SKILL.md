---
name: cratis-chronicle-project-view
description: Maps Chronicle events onto a stored read model. Use when projecting event properties or removing a projected instance. Not for calculating state from previous values (use cratis-chronicle-reduce-state).
compatibility: .NET SDK and Chronicle projections.
---

# Store each registered author's name in a read model

1. In the backend project that references `Cratis.Chronicle`, put `Author` beside the query that lists authors. `AuthorId` and `AuthorRegistered` come from [Record an event](../cratis-chronicle-record-event/SKILL.md).
2. Put `[FromEvent<AuthorRegistered>]` on the record. Chronicle uses the event source ID as `Id` and maps `AuthorRegistered.Name` to `Author.Name` by name.
3. Reuse the feature's `AuthorRemoved` event if it exists; don't declare a second type with the same persisted ID. Put `[RemovedWith<AuthorRemoved>]` on the record. When this event is appended, Chronicle removes the instance with that author ID.

```csharp
// Features/Authors/Listing/Author.cs
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Projections.ModelBound;
using Library.Authors.Registration;

namespace Library.Authors.Listing;

[EventType] public record AuthorRemoved;

[FromEvent<AuthorRegistered>]
[RemovedWith<AuthorRemoved>]
public record Author(AuthorId Id, string Name);
```

## Choose the mapping for each property

- Keep matching property names for direct copies. If the read model calls the name `DisplayName`, declare `[SetFrom<AuthorRegistered>(nameof(AuthorRegistered.Name))] string DisplayName` instead.
- For a last-updated timestamp, declare `[FromEvery(contextProperty: nameof(EventContext.Occurred))] DateTimeOffset LastUpdated`. Don't read the wall clock while projecting an event.
- Keep `[Passive]` off this record: the listing needs stored instances, not a model computed only when requested by ID.

## Check removal by author ID

With default discovery, keep `Author` in the backend assembly; Chronicle discovers records with model-bound projection attributes. Register Aster and Birch using different IDs. After the projection handles the registrations, check both IDs and names. Append `AuthorRemoved` for Aster. After it is handled, list `await store.ReadModels.GetInstances<Author>()` in the test namespace and check that only Birch remains with the same ID and name.

## Related skills

- [Expose the query](../cratis-arc-expose-query/SKILL.md)
- [Calculate state from previous values](../cratis-chronicle-reduce-state/SKILL.md)
