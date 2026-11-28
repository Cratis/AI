# Server paging and selection

Pass the generated query class to DataPage, not an array fetched elsewhere. Without server query configuration, filtering and sorting the loaded page cannot answer questions about the entire collection. Translate the visible filters into server arguments, map sortable field names, and restart at the first page after a filter changes. Test with a matching row that begins outside the loaded page.

Keep selection by stable `dataKey`. When the refreshed page arrives accept the replacement item (or `null`) from the controlled selection callback. Ignoring the proposal leaves the old author visible in details after removal. Clear old rows when arguments change; retain them during refresh only for the same arguments. A details refresh callback belongs to the host and does not by itself refetch the table; use an observable query for a live list.
