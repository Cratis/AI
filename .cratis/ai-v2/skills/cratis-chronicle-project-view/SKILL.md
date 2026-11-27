---
name: cratis-chronicle-project-view
description: Use when declaring Chronicle read-model mappings, counters or instance removal. Not for calculations the projection cannot declare (use cratis-chronicle-reduce-state).
compatibility: .NET SDK and Chronicle projections.
---

# Store each registered author's name in a read model

Use a projection, the observer that maps events to the `Author` read model. That read model is the data the state view queries.

1. In the backend project that references `Cratis.Arc` and `Cratis.Chronicle`, put `Author` beside the query that lists authors. Import `AuthorId` from [Name a domain value](../cratis-fundamentals-name-value/SKILL.md) and `AuthorRegistered` from [Record an event](../cratis-chronicle-record-event/SKILL.md).
2. Put `[FromEvent<AuthorRegistered>]` on the record. Chronicle uses the event source ID as `Id`. Chronicle copies event properties to read-model properties with the same name, without an explicit mapping. Both `AuthorRegistered.Name` and `Author.Name` are `string`, so the value copies unchanged.
3. Import `AuthorRemoved` from `Features/Authors/Removal/AuthorRemoved.cs` in [Reserve a name](../cratis-chronicle-constrain-append/SKILL.md). Put `[RemovedWith<AuthorRemoved>]` on the record. When this event is appended, Chronicle removes the instance with that author ID.

```csharp
// Features/Authors/Listing/Author.cs
using Cratis.Chronicle.Projections.ModelBound;
using Cratis.Arc.Queries.ModelBound;
using Library.Features.Authors;
using Library.Features.Authors.Registration;
using Library.Features.Authors.Removal;

namespace Library.Features.Authors.Listing;

[ReadModel, FromEvent<AuthorRegistered>]
[RemovedWith<AuthorRemoved>]
public record Author(AuthorId Id, string Name);
```

## When it goes off the usual path

- **The payload and model use different property names:** declare `[SetFrom<AuthorRegistered>(nameof(AuthorRegistered.Name))] string DisplayName`. Match the payload's type; the mapping does not change how Chronicle selects the row.
- For a last-updated timestamp, add `using Cratis.Chronicle.Events;` and declare `[FromEvery(contextProperty: nameof(EventContext.Occurred))] DateTimeOffset LastUpdated`. Don't read the wall clock while projecting an event.
- **A child event carries a parent ID different from its source ID:** for a separate `AuthorPublications(AuthorId Id, IEnumerable<Listing> Listings)` view, declare `public record Listing(string Id);` and `[EventType] public record ListingAdded(AuthorId AuthorId, string Id);`. Implement `IProjectionFor<AuthorPublications>` from `Cratis.Chronicle.Projections`. In `Define(IProjectionBuilderFor<AuthorPublications> builder)`, use `builder.From<AuthorRegistered>().Children(m => m.Listings, c => c.IdentifiedBy(m => m.Id).From<ListingAdded>(e => e.UsingParentKey(p => p.AuthorId).UsingKey(p => p.Id)));`. Test with two parents and assert each child appears only under its intended parent.
- **The view needs a simple count:** import `Cratis.Chronicle.Projections.ModelBound` and use `[Increment<CopyAdded>, Decrement<BookBorrowed>] int Available` on a book-stock read model. A simple counter does not need a reducer.
- **The screen needs to list stored rows:** keep the `Author` declaration above unchanged. Adding `[Passive]` (from `Cratis.Chronicle.ReadModels`) would compute by ID on demand instead of storing rows for the listing.

## Check removal by author ID

With default discovery, keep `Author` in the backend assembly; Chronicle discovers records with model-bound projection attributes. In a test with an `IEventStore eventStore` for an empty namespace, register Aster with `var result = await eventStore.EventLog.Append(authorId, new AuthorRegistered("Aster"));`. Check `result.IsSuccess`, then check `(await result.WaitForCompletion()).IsSuccess` (import `Cratis.Chronicle.Observation`). Repeat for Birch with a different ID. List `await eventStore.ReadModels.GetInstances<Author>()` and check both names and IDs. Append `new AuthorRemoved()` for Aster; check acceptance and completion the same way. List again and expect only Birch.

## Related skills

- [Expose the query](../cratis-arc-expose-query/SKILL.md)
- [Calculate state from previous values](../cratis-chronicle-reduce-state/SKILL.md)
