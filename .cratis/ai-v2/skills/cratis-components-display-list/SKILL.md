---
name: cratis-components-display-list
compatibility: Requires React and Cratis Components.
description: Use when building a DataPage or DataTable with query-backed rows, columns, selection or details. Not for server-side paging logic (cratis-arc-page-query).
---

# Render a selectable query-backed list

Use DataPage for a complete list screen. The generated query supplies rows; the compound columns and menu items describe how to read or act on them.

Use the generated query's row type for the table, its columns and the selected-row callback.

1. Identify the stable key and define the empty state separately from a failed or loading query. **Done:** A successful empty result shows No authors.
2. Use the selected row from the menu callback rather than an array index. **Done:** The action is unavailable before selection and selection survives duplicate display labels by identity.
3. Feed a populated result and choose a non-default row. **Done:** The Name column displays both rows and Inspect targets Fern, not its neighbor.

## Example

The imports below assume the generated directory is beside the view. Mount this view inside the configured application host.

```tsx
import { useState } from 'react';
import { DataPage, MenuItem } from '@cratis/components/DataPage';
import { Column } from '@cratis/components/DataTables';
import { AllAuthors, type Author } from './generated/Authors/Author';

export function View() {
    const [opened, open] = useState('');
    return <><DataPage query={AllAuthors} title="Authors" dataKey="id" emptyMessage="No authors">
        <DataPage.Columns><Column field="name" header="Name"/></DataPage.Columns>
        <DataPage.MenuItems><MenuItem<Author> label="Inspect" disableOnUnselected command={selection => {
            if (selection.selectionMode === 'single' && selection.selectedItem) open(selection.selectedItem.name);
        }}/></DataPage.MenuItems>
    </DataPage><output>{opened}</output></>;
}
```

If a click targets the wrong record after a refresh, compare dataKey with the identity in the generated row. A displayed name or table index is not a durable identity.

Read references/standalone-table.md when a parent already owns the page layout.

Read references/filters.md when search needs to cover unloaded rows.

## Verify

Run `npx tsc --noEmit` in the frontend, then select the second of two rows and invoke its action. The displayed detail belongs to that row, even when both labels match.
