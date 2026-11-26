---
name: cratis-arc-expose-query
description: Exposes a read model through an Arc query. Use when adding a query method to a read model, including a live author list. Not for defining how events populate the model (use cratis-chronicle-project-view).
compatibility: Requires Cratis, Cratis.Arc.MongoDB and a change-stream-capable MongoDB deployment.
---

# Expose the author list

[Connect MongoDB](../cratis-arc-connect-storage/SKILL.md) with `WithMongoDB()` before resolving the collection. Start with the existing [Author projection](../cratis-chronicle-project-view/SKILL.md); it already owns the row shape and event mapping.

In `Features/Authors/Listing/Author.cs` (`Library.Features.Authors.Listing`) put a public static query on the record itself. Import `System.Reactive.Subjects`, `Cratis.Arc.MongoDB` and `MongoDB.Driver` at the top of that file. Add only the following member to `Author`. Arc supplies the registered collection; do not include it among the client's query arguments.

```csharp
public static ISubject<IEnumerable<Author>> AllAuthors(IMongoCollection<Author> collection) =>
    collection.Observe();
```

Subscribe to `AllAuthors` (see [Diagnose a missing update](../cratis-arc-diagnose-live-query/SKILL.md) for a curl probe). Check its first list, register an author, then check that the same subscription delivers the new `Id` and `Name`.

## Avoid

- Do not materialize `Observe()` into a list; subscribers need subsequent deliveries.
- Do not expose helper methods as public static queries; keep helpers private.
- Do not return `IAsyncEnumerable<Author>` for this generated observable contract; return `ISubject<IEnumerable<Author>>`.

## Related skills

- [Generate the frontend contract](../cratis-arc-generate-proxies/SKILL.md)
- [Diagnose a missing update](../cratis-arc-diagnose-live-query/SKILL.md)
