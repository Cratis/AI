---
name: cratis-arc-page-query
description: Use when an existing list endpoint must page, sort or filter on the server. Not for rendering table columns (cratis-components-display-list).
compatibility: Requires the .NET SDK; the page comparison uses Node.js.
---

# Page before materializing

1. Record scope, filter, zero-based page and size. Pick a total ordering, e.g. name then unique ID; seed tied names across the page boundary and a nonmatching control. **Done:** the expected adjacent ID lists are disjoint and their concatenation has a known order.
2. Return provider-backed `IQueryable<Author>` from the one-shot static query. Apply tenant and business filters before paging. Do not call `ToList()` and wrap it with `AsQueryable()`. Let Arc count the filtered query and slice it once. Inspect the effective ordering: a requested dynamic `sortBy` can replace an earlier `OrderBy`; do not claim stable ties unless the final query preserves the unique key. **Done:** the provider executes a bounded page and a matching total count, not a full collection transfer.
3. Request `?page=0&pageSize=2` and `?page=1&pageSize=2` against the same unchanged dataset. Check the result verdict before comparing `data`, `paging.totalItems` and `paging.totalPages`. **Done:** no extra, duplicated or omitted keys. For a live page the producer must apply the same filter, total order and slice on *every* update; insert a row before the boundary and check the shifted page. If it grows beyond two rows, repair the producer, not the UI.

For example, keep the provider query ordered and unmaterialized on the read model:

```csharp
[ReadModel]
public record Row(int Id, string Name)
{
    public static IQueryable<Row> ByName(string name, Catalog db) =>
        db.Rows.Where(row => row.Name == name).OrderBy(row => row.Name).ThenBy(row => row.Id);
}
```

Run `node scripts/check-pages.mjs first.json second.json id` from the installed skill directory with the two saved successful page responses and their key field. It prints the row counts only if both pages contain rows with distinct keys; compare their concatenation with the expected order separately.
