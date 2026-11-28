# C#: page a model-bound Arc query

Prerequisite: the `Author` read model and its MongoDB collection are already connected.

For an ordinary snapshot without Arc-composed paging, use `Find(filter)` with a `Builders<Author>.Filter` definition; see [native MongoDB operations](../../cratis-arc-connect-storage/references/csharp.md#use-native-mongodb-operations). For an Arc page that must reflect writes, use `collection.Observe(Builders<Author>.Filter.Eq(author => author.Name, name))` and return `ISubject<IEnumerable<Author>>` instead of the method below. Import `Cratis.Arc.MongoDB`, `System.Reactive.Subjects` and `MongoDB.Driver`; MongoDB applies the page and sort from the request.

A finite search that Arc must count and page is the exception: use a provider-backed `IQueryable` so Arc can compose that work.

Add `AuthorsNamed` to the `Author` read model in `Features/Authors/Listing/Author.cs` (`Library.Features.Authors.Listing`). The client supplies `name`; Arc injects the collection. Import `MongoDB.Driver` and `MongoDB.Driver.Linq`. Add the method below to the existing file; do not replace `AllAuthors` or declare a second `Author`. Return the filtered query unexecuted so Arc counts matching authors before applying the requested page.

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

## Avoid in C#

- Do not call `ToList()` before returning; that moves paging off the database.
- Do not apply `Skip` or `Take` yourself; Arc applies them once.
- Do not rely on insertion order. To override the query's order in a GET, append `&sortBy=id&sortDirection=desc`. Use a unique sort key for stable page boundaries: Arc applies the request sort before paging and does not add the query's `Id` order as a tie-breaker.
- Do not reuse `page`, `pageSize`, `sortBy` or `sortDirection` as business filter names.

## What Arc pages and what it does not

- **`IQueryable<T>`** is counted, sorted, skipped and taken by Arc, in the database when the provider can translate it. Calling `AsQueryable()` on a list that is already loaded pages only that list; it does not reduce the read.
- **A materialized collection or an arbitrary `ISubject<IEnumerable<T>>`** is not sliced: a subject that emits 100 items emits 100 whatever page was requested.
- **MongoDB `collection.Observe(...)`** applies the request's sort and page in the database and keeps the total current. `ObserveSingle()` and `ObserveById()` do not page.
- **When a paging predicate does not translate**, keep it server-side. Use a typed filter with `Observe(filter)` if the page can be live. `Find(filter)` followed by materialization is not a drop-in replacement for an Arc-composed finite page.

`page` is zero-based and defaults to zero when `pageSize` is supplied; `pageSize` is what turns paging on for a GET. A request without it returns every matching row, so paging is not a size limit: enforce a maximum separately when the read needs one.
