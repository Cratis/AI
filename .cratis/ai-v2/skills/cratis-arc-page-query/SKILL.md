---
name: cratis-arc-page-query
description: Use when a list query needs server-side paging or sorting of filtered results in the database. Not for rendering list columns (use cratis-components-display-list).
compatibility: Requires Node.js for the verification script, and Cratis and Cratis.Arc.MongoDB with Mongo registered on the host.
---

# Page authors with the requested name

Use a finite `IQueryable` for this paged search. Choose MongoDB's provider-backed `Observe()` instead only when an open page must reflect writes; the provider applies the query context to the observed page.

Add `AuthorsNamed` to [the Author read model](../cratis-chronicle-project-view/SKILL.md) in `Features/Authors/Listing/Author.cs` (`Library.Features.Authors.Listing`). The client supplies `name`; Arc injects the collection. Import `MongoDB.Driver` and `MongoDB.Driver.Linq`. Add the method below to the existing file; do not replace `AllAuthors` or declare a second `Author`. Return the filtered query unexecuted so Arc counts matching authors before applying the requested page.

```csharp
public static IQueryable<Author> AuthorsNamed(string name, IMongoCollection<Author> collection) =>
    collection.AsQueryable().Where(author => author.Name == name).OrderBy(author => author.Id);
```

With prefix `api` and one namespace segment skipped, request `GET /api/features/authors/listing/authors-named?name=Aster&page=0&pageSize=2`, then change `page` to `1`, with three authors named Aster and one other author. Expect two different IDs on page zero and the remaining ID on page one. All three matching rows tie on `Name`, so leave request sorting unset for this check and verify the pages follow the query's `Id` order. Both responses should have `paging.totalItems` equal to three, not four. To check for repeated IDs in the two saved responses run `node scripts/check-pages.mjs first.json second.json id` from the skill directory.

## Avoid

- Do not call `ToList()` before returning; that moves paging off the database.
- Do not apply `Skip` or `Take` yourself; Arc applies them once.
- Do not rely on insertion order. To override the query's order in a GET, supply both `sortBy` and `sortDirection`. Use a unique sort key for stable page boundaries: Arc applies the request sort before paging and does not add the query's `Id` order as a tie-breaker.
- Do not reuse `page`, `pageSize`, `sortBy` or `sortDirection` as business filter names.

## Related skills

- [Expose a live query](../cratis-arc-expose-query/SKILL.md) for the unpaged Authors list.

- [Connect MongoDB](../cratis-arc-connect-storage/SKILL.md)
- [Display the list](../cratis-components-display-list/SKILL.md)
