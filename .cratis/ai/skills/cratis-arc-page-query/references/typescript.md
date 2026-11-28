# Page in the Node storage provider

With the Mongo collection registered as `tasks`, inject the request options into the model-bound query. Pass the whole options object so storage sees sorting as well as paging.

```typescript
@query(service(tasks), queryOptions())
static async page(items: MongoCollection<TaskRecord>, options: QueryOptions) {
    return items.queryPage({}, options);
}
```

For three matching tasks, page 1 at size 2 returns one task and total 3. Returning an array instead lets Arc page in memory. In a custom provider, return `queryPage(items, totalItems, sorting)` with exactly the requested window and the sort actually applied. A sort request without that confirmation fails with 400. Refuse a provider limit with `QueryPagingRequired` or a disallowed sort with `InvalidQuerySort`; do not return a partial list as complete.
