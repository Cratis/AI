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
