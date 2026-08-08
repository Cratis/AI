// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useState } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { AllOrganizations } from './Organizations/Listing/Listing';
import { AllRepositories, Repository } from './Listing/Listing';
import { AddOrganization } from './Organizations/Adding/Adding';
import { AddRepository } from './Adding/Adding';
import { RemoveRepository } from './Removing/Removing';
import { MapCodeRepository } from './MappingCodeRepository/MappingCodeRepository';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { InputTextField } from '@cratis/components/CommandForm/fields';

/**
 * The repositories settings page - manage the organizations and repositories the Planner tracks
 * and map issues repositories to the code repositories work happens in.
 */
export const Repositories = () => {
    const [organizationsResult] = AllOrganizations.use();
    const [repositoriesResult] = AllRepositories.use();
    const [addOrganizationVisible, setAddOrganizationVisible] = useState(false);
    const [addRepositoryVisible, setAddRepositoryVisible] = useState(false);
    const [mapCodeFor, setMapCodeFor] = useState<Repository | undefined>(undefined);

    const removeRepository = async (repository: Repository) => {
        const command = new RemoveRepository();
        command.repository = repository.id;
        await command.execute();
    };

    return (
        <div className='flex h-full flex-col gap-4 overflow-auto p-4'>
            <div className='flex items-center gap-2'>
                <h1 className='m-0 flex-1 text-lg font-semibold'>Repositories</h1>
                <Button label='Add organization' icon='pi pi-building' outlined onClick={() => setAddOrganizationVisible(true)} />
                <Button label='Add repository' icon='pi pi-plus' outlined onClick={() => setAddRepositoryVisible(true)} />
            </div>

            <div>
                <h2 className='mb-2 text-base font-medium'>Organizations</h2>
                <DataTable value={organizationsResult.data ?? []} dataKey='id' size='small' emptyMessage='No organizations added'>
                    <Column field='name' header='Name' />
                </DataTable>
            </div>

            <div>
                <h2 className='mb-2 text-base font-medium'>Tracked repositories</h2>
                <DataTable value={repositoriesResult.data ?? []} dataKey='id' size='small' emptyMessage='No repositories tracked'>
                    <Column header='Repository' body={(repository: Repository) => `${repository.owner}/${repository.name}`} />
                    <Column
                        header='Code repository'
                        body={(repository: Repository) =>
                            repository.codeOwner ? `${repository.codeOwner}/${repository.codeName}` : '-'} />
                    <Column
                        style={{ width: '10rem' }}
                        body={(repository: Repository) => (
                            <div className='flex gap-1'>
                                <Button
                                    icon='pi pi-code'
                                    rounded
                                    text
                                    tooltip='Map code repository'
                                    onClick={() => setMapCodeFor(repository)} />
                                <Button
                                    icon='pi pi-trash'
                                    rounded
                                    text
                                    severity='danger'
                                    tooltip='Remove'
                                    onClick={() => removeRepository(repository)} />
                            </div>
                        )} />
                </DataTable>
            </div>

            {addOrganizationVisible &&
                <CommandDialog<AddOrganization>
                    command={AddOrganization}
                    visible
                    title='Add organization'
                    width='30rem'
                    okLabel='Add'
                    cancelLabel='Cancel'
                    onConfirm={() => setAddOrganizationVisible(false)}
                    onCancel={() => setAddOrganizationVisible(false)}>
                    <InputTextField<AddOrganization> value={(instance) => instance.name} title='Name' placeholder='The GitHub organization name' />
                </CommandDialog>}

            {addRepositoryVisible &&
                <CommandDialog<AddRepository>
                    command={AddRepository}
                    visible
                    title='Add repository'
                    width='30rem'
                    okLabel='Add'
                    cancelLabel='Cancel'
                    onConfirm={() => setAddRepositoryVisible(false)}
                    onCancel={() => setAddRepositoryVisible(false)}>
                    <InputTextField<AddRepository> value={(instance) => instance.owner} title='Owner' placeholder='The organization owning the repository' />
                    <InputTextField<AddRepository> value={(instance) => instance.name} title='Name' placeholder='The repository name' />
                </CommandDialog>}

            {mapCodeFor &&
                <CommandDialog<MapCodeRepository>
                    command={MapCodeRepository}
                    visible
                    title={`Map code repository for ${mapCodeFor.owner}/${mapCodeFor.name}`}
                    width='30rem'
                    okLabel='Map'
                    cancelLabel='Cancel'
                    initialValues={{ repository: mapCodeFor.id }}
                    onConfirm={() => setMapCodeFor(undefined)}
                    onCancel={() => setMapCodeFor(undefined)}>
                    <InputTextField<MapCodeRepository> value={(instance) => instance.codeOwner} title='Code owner' placeholder='The organization owning the code repository' />
                    <InputTextField<MapCodeRepository> value={(instance) => instance.codeName} title='Code repository' placeholder='The code repository name' />
                </CommandDialog>}
        </div>
    );
};
