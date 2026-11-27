---
name: cratis-components-display-list
description: Use when a developer displays generated query results in a DataPage table with columns, selection or row actions. Not for custom markup around a query hook (use cratis-arc-react-bind-slice).
compatibility: Requires @cratis/components and @cratis/arc.react.
---

# List authors and open the selected row

Present the state view using rows returned by the query, not values from the last submitted command. Default to a table alone.

- Pass `detailsComponent={AuthorDetails}` when users should inspect a selection alongside the table. Import `type { IDetailsComponentProps }` from `@cratis/components/DataPage` and define `const AuthorDetails = ({ item }: IDetailsComponentProps<Author>) => <h2>{item.name}</h2>;`. If loading related records, use `item.id`, not `item.name`.
- Choose navigation, as below, when details need their own screen or won't fit in a pane. Keep Add independent of selection; do not set `disableOnUnselected` on it.

1. In `Features/Authors/Listing/Authors.tsx`, import `Author` and `AllAuthors` from the generated proxy tree (`cratis-arc-generate-proxies`). Use the generated tree's actual import path, even if the screen and proxy share a filename; never import the query from the screen itself. Render the page under `Arc` and `CratisComponentsProvider`.
2. Pass the query constructor and a stable `dataKey`. Each column's `field` names a property of `Author`.
3. Check `selectionMode` and `selectedItem` before invoking a row action. Pass the selected row's key to the callback that opens its details, not its display label.

```tsx
import { Column, DataPage } from '@cratis/components/DataPage';
import { AllAuthors, type Author } from '../../../generated/Features/Authors/Listing/Author';

export const Authors = ({ onOpen }: { onOpen: (id: Author['id']) => void }) => (
    <DataPage query={AllAuthors} title="Authors" dataKey="id" emptyMessage="No authors">
        <DataPage.Columns><Column field="name" header="Name" sortable /></DataPage.Columns>
        <DataPage.MenuItems>
            <DataPage.MenuItem<Author> label="Open" disableOnUnselected command={selection => {
                if (selection.selectionMode === 'single' && selection.selectedItem) onOpen(selection.selectedItem.id);
            }} />
        </DataPage.MenuItems>
    </DataPage>
);
```

`emptyMessage` describes a successful query with no rows. Use `loadingMessage`, `unauthorizedMessage` and `failureMessage` to customize the other states; don't convert a failed query to an empty array. For a one-off check in the existing story, switch between two rows with the same name and confirm that inspection follows the selected ID. If the TypeScript Specifications profile is installed, use `cratis-specifications-observe-ui`.

## Avoid

- Don't call `AllAuthors.use()` separately; `DataPage` already subscribes.
- Don't identify an author by name or row position. Names can repeat and sorting changes positions.

## When it goes off the usual path

- **A row action runs asynchronously:** handle failure in the caller and prevent repeated submission while it is pending. Don't rely on the menu to await it.

## Related skills

- [Explore data](../cratis-components-explore-data/SKILL.md) when readers need to group records by category or browse dated versions of one record.

- [Confirm a row action](../cratis-components-coordinate-feedback/SKILL.md)
