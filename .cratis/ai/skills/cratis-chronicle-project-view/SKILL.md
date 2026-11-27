---
name: cratis-chronicle-project-view
description: Use when a maintainer needs to project Chronicle events into a read model through field mappings, counters or instance removal. Not for calculations the projection cannot declare (use cratis-chronicle-reduce-state).
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

Leave the listing active: `[Passive]` would compute by ID on demand instead of storing rows. For counts, use projection operators such as `[Increment<CopyAdded>, Decrement<BookBorrowed>] int Available`. A simple counter does not need a reducer.

## When it goes off the usual path

- **The payload and model use different property names:** declare `[SetFrom<AuthorRegistered>(nameof(AuthorRegistered.Name))] string DisplayName`. This mapping can target a positional parameter or an explicit property. Match the payload's type; the mapping does not change how Chronicle selects the row. In a fluent projection, use `.To(e => e.Name)` for an event member and `.ToValue(...)` for a constant.
- **The row is keyed by an event property rather than the source:** if `BookBorrowed` carries a `MemberId`, put `[FromEvent<BookBorrowed>(key: nameof(BookBorrowed.MemberId))]` on the member view. This selects the displayed row; it does not make the view a protected command read.
- **A child event carries a parent ID different from its source ID:** for a separate `AuthorPublications(AuthorId Id, IEnumerable<Listing> Listings)` view, declare `public record Listing(string Id);` and `[EventType] public record ListingAdded(AuthorId AuthorId, string Id);`. Implement `IProjectionFor<AuthorPublications>` from `Cratis.Chronicle.Projections`. In `Define(IProjectionBuilderFor<AuthorPublications> builder)`, use `builder.From<AuthorRegistered>().Children(m => m.Listings, c => c.IdentifiedBy(m => m.Id).From<ListingAdded>(e => e.UsingParentKey(p => p.AuthorId).UsingKey(p => p.Id)));`. Test with two parents and assert each child appears only under its intended parent.

## Check removal by author ID

One-off wiring check in a disposable namespace, not a committed spec of Chronicle removal. For an uncovered application mapping, use a [`ReadModelScenario<Author>`](../cratis-specifications-exercise-backend/SKILL.md) instead.

With default discovery, keep `Author` in the backend assembly; Chronicle discovers records with model-bound projection attributes. With an `IEventStore eventStore` for that namespace, register Aster with `var result = await eventStore.EventLog.Append(authorId, new AuthorRegistered("Aster"));`. Check `result.IsSuccess`, then check `(await result.WaitForCompletion()).IsSuccess` (import `Cratis.Chronicle.Observation`). Repeat for Birch with a different ID. List `await eventStore.ReadModels.GetInstances<Author>()` and check both names and IDs. Append `new AuthorRemoved()` for Aster; check acceptance and completion the same way. List again and expect only Birch.

When the next value requires a computation over prior state that projection operators cannot express, switch to [a self-reducing model](../cratis-chronicle-reduce-state/SKILL.md). Keep side effects out of both.

## Related skills

- [Expose the query](../cratis-arc-expose-query/SKILL.md)
