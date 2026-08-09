// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useMemo, useState } from 'react';
import { Column } from 'primereact/column';
import { TabPanel, TabView } from 'primereact/tabview';
import { Page } from '@cratis/components/Common';
import { DataPage, MenuItem } from '@cratis/components/DataPage';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { InputTextField, MultiSelectField } from '@cratis/components/CommandForm/fields';
import { AllOrganizations, Organization } from './Organizations/Listing/Listing';
import { AllRepositories, Repository } from './Listing/Listing';
import { AddOrganization } from './Organizations/Adding/Adding';
import { AddRepository } from './Adding/Adding';
import { RemoveRepository } from './Removing/Removing';
import { MapCodeRepository } from './MappingCodeRepository/MappingCodeRepository';
import { AllRepositoryGroups, RepositoryGroup } from './Groups/Listing/Listing';
import { CreateRepositoryGroup } from './Groups/Creating/Creating';
import { ChangeRepositoryGroup } from './Groups/Changing/Changing';
import { DeleteRepositoryGroup } from './Groups/Deleting/Deleting';

/**
 * The repositories settings page - three tabs managing the organizations, the tracked
 * repositories (with code repository mapping) and the named repository groups.
 */
export const Repositories = () => {
    const [repositoriesResult] = AllRepositories.use();
    const [selectedOrganization, setSelectedOrganization] = useState<Organization | undefined>(undefined);
    const [selectedRepository, setSelectedRepository] = useState<Repository | undefined>(undefined);
    const [selectedGroup, setSelectedGroup] = useState<RepositoryGroup | undefined>(undefined);
    const [addOrganizationVisible, setAddOrganizationVisible] = useState(false);
    const [addRepositoryVisible, setAddRepositoryVisible] = useState(false);
    const [createGroupVisible, setCreateGroupVisible] = useState(false);
    const [mapCodeFor, setMapCodeFor] = useState<Repository | undefined>(undefined);
    const [changeGroupFor, setChangeGroupFor] = useState<RepositoryGroup | undefined>(undefined);

    const repositoryOptions = useMemo(() =>
        (repositoriesResult.data ?? []).map((repository) => ({
            label: `${repository.owner}/${repository.name}`,
            value: repository.id,
        })),
        [repositoriesResult.data]);

    const removeRepository = async (repository: Repository) => {
        const command = new RemoveRepository();
        command.repository = repository.id;
        await command.execute();
    };

    const deleteGroup = async (group: RepositoryGroup) => {
        const command = new DeleteRepositoryGroup();
        command.group = group.id;
        await command.execute();
    };

    return (
        <Page title='Repositories' showTitle={false}>
            <TabView
                className='flex min-h-0 flex-1 flex-col px-4 pt-2'
                panelContainerClassName='flex min-h-0 flex-1 flex-col'>
                <TabPanel header='Organizations' leftIcon='pi pi-building mr-2' contentClassName='flex min-h-0 flex-1 flex-col'>
                    <DataPage
                        title='Organizations'
                        query={AllOrganizations}
                        emptyMessage='No organizations added'
                        dataKey='id'
                        selection={selectedOrganization}
                        onSelectionChange={(event) => setSelectedOrganization(event.value as Organization)}>
                        <DataPage.MenuItems>
                            <MenuItem label='Add' icon={() => <i className='pi pi-plus' />} disableOnUnselected={false} command={() => setAddOrganizationVisible(true)} />
                        </DataPage.MenuItems>
                        <DataPage.Columns>
                            <Column field='name' header='Name' />
                        </DataPage.Columns>
                    </DataPage>
                </TabPanel>
                <TabPanel header='Repositories' leftIcon='pi pi-database mr-2' contentClassName='flex min-h-0 flex-1 flex-col'>
                    <DataPage
                        title='Repositories'
                        query={AllRepositories}
                        emptyMessage='No repositories tracked'
                        dataKey='id'
                        selection={selectedRepository}
                        onSelectionChange={(event) => setSelectedRepository(event.value as Repository)}>
                        <DataPage.MenuItems>
                            <MenuItem label='Add' icon={() => <i className='pi pi-plus' />} disableOnUnselected={false} command={() => setAddRepositoryVisible(true)} />
                            <MenuItem label='Map code repository' icon={() => <i className='pi pi-code' />} disableOnUnselected command={() => selectedRepository && setMapCodeFor(selectedRepository)} />
                            <MenuItem label='Remove' icon={() => <i className='pi pi-trash' />} disableOnUnselected command={() => selectedRepository && removeRepository(selectedRepository)} />
                        </DataPage.MenuItems>
                        <DataPage.Columns>
                            <Column header='Repository' body={(repository: Repository) => `${repository.owner}/${repository.name}`} />
                            <Column
                                header='Code repository'
                                body={(repository: Repository) =>
                                    repository.codeOwner ? `${repository.codeOwner}/${repository.codeName}` : '-'} />
                        </DataPage.Columns>
                    </DataPage>
                </TabPanel>
                <TabPanel header='Repository groups' leftIcon='pi pi-objects-column mr-2' contentClassName='flex min-h-0 flex-1 flex-col'>
                    <DataPage
                        title='Repository groups'
                        query={AllRepositoryGroups}
                        emptyMessage='No repository groups'
                        dataKey='id'
                        selection={selectedGroup}
                        onSelectionChange={(event) => setSelectedGroup(event.value as RepositoryGroup)}>
                        <DataPage.MenuItems>
                            <MenuItem label='Create' icon={() => <i className='pi pi-plus' />} disableOnUnselected={false} command={() => setCreateGroupVisible(true)} />
                            <MenuItem label='Change members' icon={() => <i className='pi pi-pencil' />} disableOnUnselected command={() => selectedGroup && setChangeGroupFor(selectedGroup)} />
                            <MenuItem label='Delete' icon={() => <i className='pi pi-trash' />} disableOnUnselected command={() => selectedGroup && deleteGroup(selectedGroup)} />
                        </DataPage.MenuItems>
                        <DataPage.Columns>
                            <Column field='name' header='Name' style={{ width: '16rem' }} />
                            <Column header='Repositories' body={(group: RepositoryGroup) => group.repositories.join(', ')} />
                        </DataPage.Columns>
                    </DataPage>
                </TabPanel>
            </TabView>

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

            {createGroupVisible &&
                <CommandDialog<CreateRepositoryGroup>
                    command={CreateRepositoryGroup}
                    visible
                    title='Create repository group'
                    width='34rem'
                    okLabel='Create'
                    cancelLabel='Cancel'
                    initialValues={{ repositories: [] }}
                    onConfirm={() => setCreateGroupVisible(false)}
                    onCancel={() => setCreateGroupVisible(false)}>
                    <InputTextField<CreateRepositoryGroup> value={(instance) => instance.name} title='Name' placeholder='Name of the group' />
                    <MultiSelectField<CreateRepositoryGroup>
                        value={(instance) => instance.repositories}
                        title='Repositories'
                        options={repositoryOptions}
                        optionValue='value'
                        optionLabel='label' />
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

            {changeGroupFor &&
                <CommandDialog<ChangeRepositoryGroup>
                    command={ChangeRepositoryGroup}
                    visible
                    title={`Members of ${changeGroupFor.name}`}
                    width='34rem'
                    okLabel='Save'
                    cancelLabel='Cancel'
                    initialValues={{ group: changeGroupFor.id, repositories: [...changeGroupFor.repositories] }}
                    onConfirm={() => setChangeGroupFor(undefined)}
                    onCancel={() => setChangeGroupFor(undefined)}>
                    <MultiSelectField<ChangeRepositoryGroup>
                        value={(instance) => instance.repositories}
                        title='Repositories'
                        options={repositoryOptions}
                        optionValue='value'
                        optionLabel='label' />
                </CommandDialog>}
        </Page>
    );
};
