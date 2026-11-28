# C#: expose a model-bound Arc query

Prerequisite: an Arc host with the storage integration for the read model registered.

Use a live `AllAuthors` query because this state view must stay current while open. For a snapshot instead, use `public static IEnumerable<Author> AllAuthors(IMongoCollection<Author> collection) => collection.Find(_ => true).ToList();`. A query serves the `Author` read model; it does not define how facts build those rows.

Connect MongoDB with `WithMongoDB()` before resolving the collection. Start with the existing `Author` projection; it already owns the row shape and event mapping.

In `Features/Authors/Listing/Author.cs` (`Library.Features.Authors.Listing`) put a public static query on the record itself. Import `System.Reactive.Subjects`, `Cratis.Arc.MongoDB` and `MongoDB.Driver` at the top of that file. Add only the following member to `Author`. Arc supplies the registered collection; do not include it among the client's query arguments.

```csharp
public static ISubject<IEnumerable<Author>> AllAuthors(IMongoCollection<Author> collection) =>
    collection.Observe();
```

One-off live query check: subscribe to `AllAuthors`. Check its first list, register an author, then check that the same subscription delivers the new `Id` and `Name`.

## When the first result is empty or changes never arrive

- **The first result looks empty:** a ready, successful frame with `data: []` is a valid list. If no initial frame is ready, keep it pending or show the transport failure; do not show an empty list.
- **Initial rows load but changes never arrive:** verify MongoDB supports change streams and check the live response before changing the projection or adding client polling.

## When the caller wants one graph snapshot

Start with registered graph views and the graph projection's existing `Group`, `Person` and `MemberOf` declarations. Import `Cratis.Chronicle.Graphs` and `Cratis.Arc.Queries.ModelBound`. Anchor a view at the root node; follow the edge only for the member the caller needs:

```csharp
[ViewOf<Person>]
public record MemberSummary(PersonId Id, PersonName? Name);

[ReadModel, ViewOf<Group>]
public record GroupWithMembers(GroupId Id, [Follows<MemberOf>] IReadOnlyList<MemberSummary> Members)
{
    public static Task<GroupWithMembers?> ById(GroupId id, IGraph graph) =>
        graph.Nodes<GroupWithMembers>().Where(g => g.Id, id).FirstOrDefault();
}
```

Expect `null` for a missing group, an empty list for an existing group with no members. A relation filter selects matching **roots**, not a subset of each root's members. Return this as a finite query; it isn't a live subscription. For a path of unknown length, use parameterized Cypher with a tenant-scoped `IGraphSession` rather than expanding a recursive view. In shared-database mode the session alone does not isolate raw Cypher: restrict every matched node and relationship to the trusted namespace or keep the typed view. For an ordinary list or a single document by ID, don't add a graph just to populate a DTO.

## Avoid

- Do not materialize `Observe()` into a list; subscribers need subsequent deliveries.
- Do not expose helper methods as public static queries; keep helpers private.
- Use `ISubject<IEnumerable<Author>>` for this .NET observable list; a finite query does not need a subject.

## Routes, transformations and time

- **Route:** Arc derives the route. To set it, put `[Path("/api/authors")]` (`Cratis.Arc.Queries.ModelBound`) on the query method; not ASP.NET `[Route]`, which a model-bound query does not read.
- **Per-caller transformation:** implement `IInterceptReadModel<Author>` to format or resolve values after the query selected the rows. An interceptor sees only delivered rows, so it cannot rebuild totals and does not replace authorization or owner-scoped selection.
- **Time:** an observable emits when stored data changes. A view whose content depends on the clock does not emit when time passes; emit at the boundary explicitly or let the client ask again.
