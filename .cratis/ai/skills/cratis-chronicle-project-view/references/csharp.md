# Store each registered author's name in a read model

Use a projection, the observer that maps events to the `Author` read model. That read model is the data the state view queries.

1. In the backend project that references `Cratis.Arc` and `Cratis.Chronicle`, put `Author` beside the query that lists authors. Import `AuthorId` from Name a domain value (`cratis-fundamentals-name-value` skill in `cratis/fundamentals`) and `AuthorRegistered` from [Record an event](../../cratis-chronicle-record-event/SKILL.md).
2. Put `[FromEvent<AuthorRegistered>]` on the record. Chronicle uses the event source ID as `Id`. Chronicle copies event properties to read-model properties with the same name, without an explicit mapping. Both `AuthorRegistered.Name` and `Author.Name` are `string`, so the value copies unchanged.
3. Import `AuthorRemoved` from `Features/Authors/Removal/AuthorRemoved.cs` in [Reserve a name](../../cratis-chronicle-constrain-append/SKILL.md). Put `[RemovedWith<AuthorRemoved>]` on the record. When this event is appended, Chronicle removes the instance with that author ID.

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

Leave the listing active: `[Passive]` would compute by ID on demand instead of storing rows. For counts, use projection operators such as `[Increment<CopyAdded>, Decrement<BookBorrowed>] int Available`. A simple counter does not need a reducer. These operators see events, not transitions: a duplicate add or close drifts the value, and replay reproduces the drift. Refuse non-transitions in the producing command. Before shipping, fold the authoritative membership or open-state history for the same key and assert that its count equals the projection counter after replay.

## When it goes off the usual path

- **The payload and model use different property names:** declare `[SetFrom<AuthorRegistered>(nameof(AuthorRegistered.Name))] string DisplayName`. This mapping can target a positional parameter or an explicit property. Match the payload's type; the mapping does not change how Chronicle selects the row. In a fluent projection, use `.To(e => e.Name)` for an event member and `.ToValue(...)` for a constant.
- **The row is keyed by an event property rather than the source:** if `BookBorrowed` carries a `MemberId`, put `[FromEvent<BookBorrowed>(key: nameof(BookBorrowed.MemberId))]` on the member view. This selects the displayed row; it does not make the view a protected command read.
- **A child event carries a parent ID different from its source ID:** for a separate `AuthorPublications(AuthorId Id, IEnumerable<Listing> Listings)` view, declare `public record Listing(string Id);` and `[EventType] public record ListingAdded(AuthorId AuthorId, string Id);`. Implement `IProjectionFor<AuthorPublications>` from `Cratis.Chronicle.Projections`. In `Define(IProjectionBuilderFor<AuthorPublications> builder)`, use `builder.From<AuthorRegistered>().Children(m => m.Listings, c => c.IdentifiedBy(m => m.Id).From<ListingAdded>(e => e.UsingParentKey(p => p.AuthorId).UsingKey(p => p.Id)));`. Test with two parents and assert each child appears only under its intended parent.

## Check removal by author ID

One-off wiring check in a disposable namespace, not a committed spec of Chronicle removal. For an uncovered application mapping, use a `ReadModelScenario<Author>` (`cratis-specifications-exercise-backend` skill in `cratis/application`) instead.

With default discovery, keep `Author` in the backend assembly; Chronicle discovers records with model-bound projection attributes. With an `IEventStore eventStore` for that namespace, register Aster with `var result = await eventStore.EventLog.Append(authorId, new AuthorRegistered("Aster"));`. Check `result.IsSuccess`, then check `(await result.WaitForCompletion()).IsSuccess` (import `Cratis.Chronicle.Observation`). Repeat for Birch with a different ID. List `await eventStore.ReadModels.GetInstances<Author>()` and check both names and IDs. Append `new AuthorRemoved()` for Aster; check acceptance and completion the same way. List again and expect only Birch.

When the next value requires a computation over prior state that projection operators cannot express, switch to [a self-reducing model](../../cratis-chronicle-reduce-state/SKILL.md). Keep side effects out of both.

## Related skills

- Expose the query (`cratis-arc-expose-query` skill in `cratis/arc/csharp`)

## Keep subscriptions, routing and mapping separate

`[FromEvent<T>]` starts with matching names and source-key routing. Use an explicit key and field mapping when either differs. Auto-mapping is on by default. `[NoAutoMap]` changes mapping, not identity; `.AutoMap()` can re-enable mapping in a child scope beneath `.NoAutoMap()`. Preserve the previous explicit projection ID when moving a type or namespace; the default derives from its full type name. A join consumes an event, not a read model. If local and joined facts both change a field, a subsequent event may overwrite it; keep independent facts in separate fields and derive the display instead. Do not assign a target twice from one event. `FromAll` expands what the observer consumes and may create rows from unrelated events. `FromEvery` maps events already consumed, including child events. An unmatched join is not a fallback create.

For a basket with line items, route the event to its basket ID first, then identify the line within that basket (`IdentifiedBy` on the child). Route removal to that same basket and line; deleting the entire parent is a different transition. For mutually exclusive shapes sharing an identity use `[VariantOf<T>]` and a deliberate `[EntersOn<TEvent>]` entry event. For a status that changes but leaves the shape intact, keep a field instead.

Set the sequence explicitly for inputs outside the log. An artifact tag is not a delivery filter. Projections consume their declared event types, regardless of append metadata. Use a reducer for filtered state or a reactor for a filtered effect. These support `[FilterEventsByTag]`, `[EventSourceType]` and `[EventStreamType]` against append metadata. A stream-scoped passive read declares a different dependency. Query one key with `GetInstanceById`; a passive fold is not a protected command decision. For a materialized collection, `Observe<T>(filter)` reports snapshots and applies the predicate client-side after release; it does not bound transport or page on the server. Use `GetInstanceById` for a keyed read or a query with supported pagination. `Watch<T>()` reports changesets. Do not expose an on-demand fold as a materialized observable collection. `[Index]` and `[CompositeIndex]` describe read-side indexes, not uniqueness. Verify physical indexes and bounded string/path support on the intended provider, not in an in-memory model scenario.

## Keep first values, per-key totals and ordered children

Requires Chronicle 19.150.0 or later. Use `SetOnce = true` on `[SetFrom<TEvent>]` or `[SetFromContext<TEvent>]`; clearing the property to null lets a subsequent event assign it again. For a dictionary of 64-bit totals, use fluent `Increment`, `Decrement`, `Count`, `Add`, `Subtract` or `RemoveKey` with a key selector, for example `.Increment(m => m.SalesByCategory, e => e.Category)` in `From<ItemSold>`. Use `CausedBy.Subject` rather than an email for context-derived keys. Event-content keys must not be empty, contain `.`, `[`, `]` or NUL, or begin with `$`. A null or missing key skips the mapping; a malformed value fails the event, and an unknown declared path fails registration.

Use `[ChildrenFrom<TEvent>(key: ..., Prepend = true)]` for newest first or `OrderBy = nameof(Child.Priority)` / `OrderByDescending = nameof(Child.Priority)` for sorted children. Choose one ordering for the collection; equal sort values break ties by child ID ascending. Specify a malformed key leaving the view unchanged and reporting a failure, and equal priorities inserted in reverse ID order ending in ascending ID order after replay.

## Choose a sink

For a named destination put `[Sink("reporting")]` on the materialized read-model type, not its builder. Configure `sinks.configurations.reporting` on the kernel with `type: SQL` (or `MongoDB`) and a connection supplied through `connectionDetailsFile`. Precedence is the explicit attribute, client `DefaultSinkName`, kernel `sinks.readModels`, then the kernel storage connection with the client’s `DefaultSinkTypeId`. Graphs use `DefaultGraphSinkName` and `sinks.graphs` instead. Unknown names fail with `UnknownSinkName`; routing a graph to a read-model sink or the reverse fails with `SinkConfigurationIsForAnotherKindOfReadModel`. `[Passive]` has no sink and combining it with `[Sink]` is CHR0069. Event targets ignore sink names.

Moving a view can require a rebuild. `Manual` can leave the new destination empty with only a recommendation. Check the actual replay (see “Definition change replay” in `cratis-chronicle-inspect-observer`) and read from the new destination before routing traffic to it.

## Graph projections

Use a graph for relationship queries. Give each node one `[Key]`, map its creation with `[FromEvent<TEvent>]` and use `[RemovedWith<TEvent>(detach: true)]` when removing the node must also remove its incident edges. Store primitives or arrays of primitives as properties, not nested objects. For example, a person node is `[Graph("Organization"), Node, FromEvent<PersonRegistered>, RemovedWith<PersonRemoved>(detach: true)] public record Person([Key] Guid PersonId, string Name);`. Declare `Group` as a second node in the same graph with a keyed `GroupId` and `FromEvent<GroupCreated>`.

```csharp
[Graph("Organization"), Edge("MEMBER_OF")]
[EdgeFrom<MemberAdded>(sourceKey: nameof(MemberAdded.PersonId), targetKey: nameof(MemberAdded.GroupId), identity: nameof(MemberAdded.MembershipId))]
[EdgeRemovedWith<MemberRemoved>(sourceKey: nameof(MemberRemoved.PersonId), targetKey: nameof(MemberRemoved.GroupId), identity: nameof(MemberRemoved.MembershipId))]
public record Membership([Source<Person>] Guid PersonId, [Target<Group>] Guid GroupId, [Key] Guid MembershipId);
```

Without the extra `[Key]`, type plus endpoints identify one edge. Use an extra identity only when parallel edges are meaningful. To deploy, configure a named `Neo4j` sink in `sinks.configurations` with the Bolt `server`, `userName` and mounted `passwordFile`; select it with the same `[Sink]` name on the graph elements or `sinks.graphs` for the kernel default. Different names on elements of one graph fail with `GraphHasConflictingSinks`.

With `GraphScenario`, append both node events and two membership events with the same endpoints and distinct IDs. Read `Edges<Membership>()` and assert both exist. Append `MemberRemoved` for one identity and assert only that edge disappears; append `PersonRemoved` and assert the remaining incident edge is detached.
