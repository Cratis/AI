// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// #region docs:add-author
import { CommandDialog } from '@cratis/components/CommandDialog';
import { InputTextField } from '@cratis/components/CommandForm';
import { RegisterAuthor } from './RegisterAuthor';
import { Guid } from '@cratis/fundamentals';

export const AddAuthor = () => (
    <CommandDialog<RegisterAuthor>
        command={RegisterAuthor}
        title="Add author"
        okLabel="Add"
        initialValues={{ id: Guid.create() }}>
        <InputTextField<RegisterAuthor> value={i => i.name} title="Name" />
    </CommandDialog>
);
// #endregion docs:add-author
