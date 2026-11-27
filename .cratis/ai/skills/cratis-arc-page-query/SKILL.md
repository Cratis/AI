---
name: cratis-arc-page-query
description: Use when a developer needs to page or sort filtered results on the server, or rows repeat across pages. Not for rendering list columns (use cratis-components-display-list).
compatibility: Requires curl, Node.js, Cratis and Cratis.Arc.MongoDB with Mongo registered on the host.
---

# Page authors with the requested name

Use a finite `IQueryable` for this paged search. If an open page must reflect writes, replace the method below with `public static ISubject<IEnumerable<Author>> AuthorsNamed(string name, IMongoCollection<Author> collection) => collection.Observe(author => author.Name == name);`. Import `System.Reactive.Subjects` and `MongoDB.Driver`; MongoDB applies the page and sort from the request.

Add `AuthorsNamed` to [the Author read model](../cratis-chronicle-project-view/SKILL.md) in `Features/Authors/Listing/Author.cs` (`Library.Features.Authors.Listing`). The client supplies `name`; Arc injects the collection. Import `MongoDB.Driver` and `MongoDB.Driver.Linq`. Add the method below to the existing file; do not replace `AllAuthors` or declare a second `Author`. Return the filtered query unexecuted so Arc counts matching authors before applying the requested page.

```csharp
public static IQueryable<Author> AuthorsNamed(string name, IMongoCollection<Author> collection) =>
    collection.AsQueryable().Where(author => author.Name == name).OrderBy(author => author.Id);
```

One-off paging check: keep the matching rows unchanged between requests. With prefix `api` and one namespace segment skipped, request `GET /api/features/authors/listing/authors-named?name=Aster&page=0&pageSize=2`, then change `page` to `1`, with three authors named Aster and one other author. Expect two different IDs on page zero and the remaining ID on page one. All three matching rows tie on `Name`, so leave request sorting unset for this check and verify the pages follow the query's `Id` order. Both responses should have `paging.totalItems` equal to three, not four. To check for repeated IDs, save the two response bodies: from the skill directory, with the same caller and tenant on both requests, run:

```sh
url='https://localhost:5001/api/features/authors/listing/authors-named?name=Aster&pageSize=2'
curl -fsS "$url&page=0" -o first.json
curl -fsS "$url&page=1" -o second.json
node scripts/check-pages.mjs first.json second.json id
```

If some fields are masked, reject unauthorized sorts before Arc orders the rows: their order can reveal a hidden field's ranking. In a discovered `IQueryFilter.OnPerform`, return `QueryResult.Success(context.CorrelationId)` for other fully qualified query names or `Sorting.None`. For this query, compare `context.Sorting.Field.Value` against the caller's allowed fields using `StringComparer.OrdinalIgnoreCase`; return success for a match and `QueryResult.Unauthorized(context.CorrelationId)` otherwise. Restrict the query to authorized rows before Arc counts them. Test that a reader can sort by `Id` but is refused when requesting a masked field.

## Avoid

- Do not call `ToList()` before returning; that moves paging off the database.
- Do not apply `Skip` or `Take` yourself; Arc applies them once.
- Do not rely on insertion order. To override the query's order in a GET, append `&sortBy=id&sortDirection=desc`. Use a unique sort key for stable page boundaries: Arc applies the request sort before paging and does not add the query's `Id` order as a tie-breaker.
- Do not reuse `page`, `pageSize`, `sortBy` or `sortDirection` as business filter names.

## Related skills

- [Expose a live query](../cratis-arc-expose-query/SKILL.md) for the unpaged Authors list.
- [Connect MongoDB](../cratis-arc-connect-storage/SKILL.md)
- [Display the list](../cratis-components-display-list/SKILL.md)
