import { DialogComponents } from '@cratis/arc.react/dialogs';
import { BusyIndicatorDialog, ConfirmationDialog } from '@cratis/components/Dialogs';
import { useState } from 'react';
import { Authors } from './Features/Authors/Listing/Authors';
import type { Author } from './generated/Features/Authors/Listing/Author';

export function App() {
    const [opened, open] = useState<Author>();
    return <DialogComponents confirmation={ConfirmationDialog} busyIndicator={BusyIndicatorDialog}>
        <Authors onOpen={open} />
        {opened && <section aria-label="Author details"><h2>{opened.name}</h2></section>}
    </DialogComponents>;
}
