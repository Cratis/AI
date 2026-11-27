import { useState } from 'react';
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
export const View = () => {
    const [opened, setOpened] = useState<Author>();
    return opened ? <h2>{opened.name}</h2> : <Authors onOpen={setOpened} />;
};
