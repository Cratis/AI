# Server paging and selection

Pass the generated query class to DataPage, not an array fetched elsewhere. Without server query configuration, filtering and sorting the loaded page cannot answer questions about the entire collection. Translate the visible filters into server arguments, map sortable field names, and restart at the first page after a filter changes. Test with a matching row that begins outside the loaded page.

Keep selection by stable `dataKey`. When the refreshed page arrives accept the replacement item (or `null`) from the controlled selection callback. Ignoring the proposal leaves the old author visible in details after removal. Clear old rows when arguments change; retain them during refresh only for the same arguments. A details refresh callback belongs to the host and does not by itself refetch the table; use an observable query for a live list.

## Numbered pages and local matchers

With Components 4.35.1 or newer, `pageLinks` is off by default; set it to `true` for numbered buttons or pass `{ siblings: 1, boundaries: 1 }` to set the window. Localize the accessible numbered-button name and visible range through `paginatorAriaLabels={{ page: pageLabel, range: rangeLabel }}` on `DataPage` (standalone `TablePaginator` uses `ariaLabels`). The callbacks receive one-based numbers. Set shared defaults in the Components provider's `messages.paginator`.

For custom client filtering, import `registerDataTableFilterMatcher` from `@cratis/components/DataTables`. Register before mounting the table and unregister on teardown; do not register from render. For example, where the host owns table startup and disposal:

```ts
const prefix = registerDataTableFilterMatcher('library.namePrefix',
    (value, filter) => typeof value === 'string' && typeof filter === 'string' && value.startsWith(filter));
const defaultFilters = { name: { value: 'A', matchMode: prefix.matchMode } };
// Pass defaultFilters to the table. After its final unmount:
prefix.unregister();
```

Keep the matcher function stable if multiple owners share its name. For server paging, map filter intent to server arguments instead of applying a client matcher to one page.
