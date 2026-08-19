// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useState } from 'react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { DataPage, MenuItem } from '@cratis/components/DataPage';
import { MarkdownEditorField } from '../Common/MarkdownEditorField';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { AllWeeklyDigests, WeeklyDigest } from './Listing/Listing';
import { WeeklyDigestStatus } from './WeeklyDigestStatus';
import { SetWeeklyDigestDescription } from './GeneratingDescription/GeneratingDescription';
import { PublishWeeklyDigest } from './Publishing/Publishing';

const statusLabel = (status: WeeklyDigestStatus) => {
    switch (status) {
        case WeeklyDigestStatus.unpublished: return 'Unpublished';
        case WeeklyDigestStatus.published: return 'Published';
        default: return 'Received';
    }
};

const statusSeverity = (status: WeeklyDigestStatus) => {
    switch (status) {
        case WeeklyDigestStatus.unpublished: return 'info';
        case WeeklyDigestStatus.published: return 'success';
        default: return 'secondary';
    }
};

/**
 * The weekly digest page - what a weekly digest job has posted, what the language model made of
 * it (themes and a suggested description), and publishing it once it reads right.
 */
export const WeeklyDigests = () => {
    const [selected, setSelected] = useState<WeeklyDigest | undefined>(undefined);
    const [editFor, setEditFor] = useState<WeeklyDigest | undefined>(undefined);

    const publish = async (digest: WeeklyDigest) => {
        const command = new PublishWeeklyDigest();
        command.weeklyDigest = digest.id;
        await command.execute();
    };

    return (
        <>
            <DataPage
                title='Weekly digest'
                query={AllWeeklyDigests}
                emptyMessage='No weekly digest has been received yet'
                dataKey='id'
                selection={selected}
                onSelectionChange={(event) => setSelected(event.value as WeeklyDigest)}>
                <DataPage.MenuItems>
                    <MenuItem
                        label='Edit description'
                        icon={() => <i className='pi pi-pencil' />}
                        disableOnUnselected
                        command={() => selected && setEditFor(selected)} />
                    <MenuItem
                        label='Publish'
                        icon={() => <i className='pi pi-send' />}
                        disableOnUnselected
                        command={() => selected && publish(selected)} />
                </DataPage.MenuItems>
                <DataPage.Columns>
                    <Column
                        header='Received'
                        body={(digest: WeeklyDigest) => digest.receivedAt ? new Date(digest.receivedAt).toLocaleString() : '-'}
                        style={{ width: '14rem' }} />
                    <Column
                        header='Themes'
                        body={(digest: WeeklyDigest) => (
                            <div className='flex flex-wrap gap-1'>
                                {(digest.themes ?? []).map((theme) => <Tag key={theme} value={theme} severity='secondary' />)}
                            </div>
                        )} />
                    <Column
                        header='Description'
                        body={(digest: WeeklyDigest) => (
                            <div className='max-w-md truncate' data-color-mode='dark'>
                                <MarkdownPreview source={digest.description || '_Not analyzed yet_'} style={{ background: 'transparent' }} />
                            </div>
                        )} />
                    <Column
                        header='Status'
                        body={(digest: WeeklyDigest) => <Tag value={statusLabel(digest.status)} severity={statusSeverity(digest.status)} />}
                        style={{ width: '10rem' }} />
                    <Column
                        header='Published to'
                        body={(digest: WeeklyDigest) => (digest.publishedTo ?? []).join(', ') || '-'}
                        style={{ width: '10rem' }} />
                    <Column
                        style={{ width: '3rem' }}
                        body={(digest: WeeklyDigest) => digest.status !== WeeklyDigestStatus.published &&
                            <Button icon='pi pi-send' rounded text size='small' tooltip='Publish' onClick={() => publish(digest)} />} />
                </DataPage.Columns>
            </DataPage>

            {editFor &&
                <CommandDialog<SetWeeklyDigestDescription>
                    command={SetWeeklyDigestDescription}
                    visible
                    title={`Edit description for ${editFor.receivedAt ? new Date(editFor.receivedAt).toLocaleDateString() : 'this digest'}`}
                    width='40rem'
                    okLabel='Save'
                    cancelLabel='Cancel'
                    initialValues={{ weeklyDigest: editFor.id, description: editFor.description ?? '' }}
                    onConfirm={() => setEditFor(undefined)}
                    onCancel={() => setEditFor(undefined)}>
                    <MarkdownEditorField<SetWeeklyDigestDescription>
                        value={(instance) => instance.description}
                        title='Description'
                        rows={8} />
                </CommandDialog>}
        </>
    );
};
