---
name: cratis-arc-expose-query
description: Use when a developer needs an Arc read-model query for a live MongoDB list or a snapshot of projected graph relationships. Not for defining how events populate the model (use cratis-chronicle-project-view).
compatibility: Requires Cratis, Cratis.Arc.MongoDB and a change-stream-capable MongoDB deployment.
---

# Expose the author list

Use a live `AllAuthors` query because this state view must stay current while open. For a snapshot instead, use `public static IEnumerable<Author> AllAuthors(IMongoCollection<Author> collection) => collection.Find(_ => true).ToList();`. A query serves the `Author` read model; it does not define how facts build those rows.

[Connect MongoDB](../cratis-arc-connect-storage/SKILL.md) with `WithMongoDB()` before resolving the collection. Start with the existing [Author projection](../cratis-chronicle-project-view/SKILL.md); it already owns the row shape and event mapping.

In `Features/Authors/Listing/Author.cs` (`Library.Features.Authors.Listing`) put a public static query on the record itself. Import `System.Reactive.Subjects`, `Cratis.Arc.MongoDB` and `MongoDB.Driver` at the top of that file. Add only the following member to `Author`. Arc supplies the registered collection; do not include it among the client's query arguments.

```csharp
public static ISubject<IEnumerable<Author>> AllAuthors(IMongoCollection<Author> collection) =>
    collection.Observe();
```

Subscribe to `AllAuthors` (see [Diagnose a missing update](../cratis-arc-diagnose-live-query/SKILL.md) for a curl probe). Check its first list, register an author, then check that the same subscription delivers the new `Id` and `Name`.

## When it goes off the usual path

- **The first result looks empty:** a ready, successful frame with `data: []` is a valid list. If no initial frame is ready, keep it pending or show the transport failure; do not show an empty list.
- **Initial rows load but changes never arrive:** verify MongoDB supports change streams and [check the live response](../cratis-arc-diagnose-live-query/SKILL.md) before changing the projection or adding client polling.

## When the caller wants one graph snapshot

Start with [registered graph views](../cratis-arc-connect-storage/SKILL.md) and the graph projection's existing `Group`, `Person` and `MemberOf` declarations. Import `Cratis.Chronicle.Graphs` and `Cratis.Arc.Queries.ModelBound`. Anchor a view at the root node; follow the edge only for the member the caller needs:

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

## Related skills

- [Page an author search](../cratis-arc-page-query/SKILL.md) when the server should return one page rather than the whole list.
- [Expose a query as an MCP tool](../cratis-arc-expose-mcp-operation/SKILL.md) when a tool caller needs a snapshot.

- [Generate the frontend contract](../cratis-arc-generate-proxies/SKILL.md)
- [Diagnose a missing update](../cratis-arc-diagnose-live-query/SKILL.md)
