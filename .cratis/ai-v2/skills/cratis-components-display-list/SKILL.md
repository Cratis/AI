---
name: cratis-components-display-list
description: Use when a slice needs a standard DataPage to show a generated query in a table with columns, selection or row actions. Not for custom markup around a query hook (use cratis-arc-react-bind-slice).
compatibility: Requires @cratis/components and @cratis/arc.react.
---

# List authors and open the selected row

Present the state view using rows returned by the query, not values from the last submitted command.

1. In `Features/Authors/Listing/Authors.tsx`, import `Author` and `AllAuthors` from the private [generated tree](../cratis-arc-generate-proxies/SKILL.md). The generator retains `Features/Authors/Listing`; don't copy its output into the UI folder. Render the page inside the app's [providers](../cratis-arc-react-bind-slice/SKILL.md).
2. Pass the query constructor and a stable `dataKey`. Each column's `field` names a property of `Author`.
3. Check `selectionMode` and `selectedItem` before invoking a row action. If the callback expects an ID, pass the selected row's `dataKey` value, not its display label. The example passes the row because the shell can display its details without loading it by ID.

```tsx
import { Column, DataPage } from '@cratis/components/DataPage';
import { AllAuthors, type Author } from '../../../generated/Features/Authors/Listing/Author';

export const Authors = ({ onOpen }: { onOpen: (author: Author) => void }) => (
    <DataPage query={AllAuthors} title="Authors" dataKey="id" emptyMessage="No authors">
        <DataPage.Columns><Column field="name" header="Name" sortable /></DataPage.Columns>
        <DataPage.MenuItems>
            <DataPage.MenuItem<Author> label="Open" disableOnUnselected command={selection => {
                if (selection.selectionMode === 'single' && selection.selectedItem) onOpen(selection.selectedItem);
            }} />
        </DataPage.MenuItems>
    </DataPage>
);
```

## Avoid

- Don't call `AllAuthors.use()` separately; `DataPage` already subscribes.
- Don't identify an author by name or row position. Names can repeat and sorting changes positions.

## When it goes off the usual path

- **A row action runs asynchronously:** handle failure in the caller and prevent repeated submission while it is pending. Don't rely on the menu to await it.

## Related skills

- [Explore data](../cratis-components-explore-data/SKILL.md) when readers need to group records by category or browse dated versions of one record.

- [Confirm a row action](../cratis-components-coordinate-feedback/SKILL.md)
