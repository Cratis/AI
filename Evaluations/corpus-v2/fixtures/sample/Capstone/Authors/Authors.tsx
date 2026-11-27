// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// #region docs:authors-screen
import { useDialog } from '@cratis/arc.react/dialogs';
import { AllAuthors } from './Author';
import { AddAuthor } from './AddAuthor';

export const Authors = () => {
    const [AddAuthorDialog, showAddAuthor] = useDialog(AddAuthor);
    const [authors] = AllAuthors.use();

    return (
        <main>
            <h1>Authors</h1>
            <button type="button" onClick={() => { void showAddAuthor(); }}>Add author</button>
            <ul>
                {authors.data.map(a => <li key={String(a.id)}>{a.name}</li>)}
            </ul>
            <AddAuthorDialog />
        </main>
    );
};
// #endregion docs:authors-screen
