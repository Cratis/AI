# Loading, refusal and projection updates

Do not close a registration dialog by waiting for a list to grow: the command result owns submission success; the observable query owns the list. A newly committed author can be absent from the next projection result. Do not manufacture the row or treat that absence as permanent.

On first load show pending, not “no authors”. Handle denial and failure before inspecting data. Only show the empty state for a ready, successful, authorized collection with zero rows. For arrays `hasData` means length greater than zero, not “a response arrived”. A refresh for the same arguments may retain content; when the key changes discard the old rows and the old key’s error. Make a spec switch between two keys while the second result is pending.

Use `QueryBoundary` to separate loading from a recoverable failure, or compose equivalent Suspense and error boundaries. Clear suspense caches in specs that exercise independent users or results. For paged queries use the generated paging hook; sort and filter before paging on the server. For a hand-written screen, [bind the accepted model](manual-screen.md); do not replace Stage-managed output.

For a paged snapshot, destructure `[result, perform, setSorting, setPage, setPageSize]`; for a paged observable query, use `[result, setSorting, setPage, setPageSize]`. Use `useWithPaging` and its page and page-size setters, not a client slice of server data. Use `.when(condition).use(...)` rather than calling hooks conditionally. Supply stable keys when reconciling replacements; comparing JSON cannot recover identity. For a Stage extension, place the registered component on the screen with `component <System>.<Component>`; a stylesheet cannot insert a page.

## Aggregate pending reads

Use `QueryScope` for one busy indicator across several query views. Hooks report outstanding work to the nearest scope automatically; a nested scope in turn reports to its nearest parent. Read the scope inside its provider with `useQueryScope()` from `@cratis/arc.react/queries`, or use `setIsPerforming` to render reactive state outside it. Given existing `AuthorSummary` and `AuthorList` views that bind generated queries:

```tsx
import { useState } from 'react';
import { QueryScope } from '@cratis/arc.react/queries';

export function AuthorsScreen() {
    const [busy, setBusy] = useState(false);
    return <section aria-busy={busy}>
        {busy && <p role="status">Loading authors…</p>}
        <QueryScope setIsPerforming={setBusy}>
            <AuthorSummary />
            <QueryScope><AuthorList /></QueryScope>
        </QueryScope>
    </section>;
}
```
