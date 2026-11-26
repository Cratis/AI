---
name: cratis-arc-page-query
description: Use when an existing list endpoint must page, sort or filter on the server. Not for rendering table columns (cratis-components-display-list).
---

# Page before materializing

1. Record scope, filter, zero-based page and size. Pick a total ordering, e.g. name then unique ID; seed tied names across the page boundary and a nonmatching control. **Done:** the expected adjacent ID lists are disjoint and their concatenation has a known order.
2. Return provider-backed `IQueryable<Author>` from the one-shot static query. Apply tenant and business filters before paging. Do not call `ToList()` and wrap it with `AsQueryable()`. Let Arc count the filtered query and slice it once. Inspect the effective ordering: a requested dynamic `sortBy` can replace an earlier `OrderBy`; do not claim stable ties unless the final query preserves the unique key. **Done:** the provider executes a bounded page and a matching total count, not a full collection transfer.
3. Request `?page=0&pageSize=2` and `?page=1&pageSize=2` from the same fixture. Check the result verdict before comparing `data`, `paging.totalItems` and `paging.totalPages`. **Done:** no extra, duplicated or omitted keys. For a live page the producer must apply the same filter, total order and slice on *every* update; insert a row before the boundary and check the shifted page. If it grows beyond two rows, repair the producer, not the UI.
