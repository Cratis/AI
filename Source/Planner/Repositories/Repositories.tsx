// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useMemo, useState } from 'react';
import { Column } from 'primereact/column';
import { DataTable, DataTableExpandedRows, DataTableValueArray } from 'primereact/datatable';
import { Menubar } from 'primereact/menubar';
import { Message } from 'primereact/message';
import { TabPanel, TabView } from 'primereact/tabview';
import { Tag } from 'primereact/tag';
import { Page } from '@cratis/components/Common';
import { DataPage, MenuItem } from '@cratis/components/DataPage';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { InputTextField, MultiSelectField } from '@cratis/components/CommandForm/fields';
import { Current as GetGitHubAppStatus } from '../GitHub/App/GitHubAppStatus';
import { AllOrganizations, Organization } from './Organizations/Listing/Listing';
import { RepositoryDiscoveryStatus } from './Organizations/RepositoryDiscoveryStatus';
import { AllRepositories, Repository } from './Listing/Listing';
import { IssueSynchronizationStatus } from './IssueSynchronizationStatus';
import { AddOrganization } from './Organizations/Adding/Adding';
import { AddRepository } from './Adding/Adding';
import { RemoveRepository } from './Removing/Removing';
import { MapCodeRepository } from './MappingCodeRepository/MappingCodeRepository';
import { AllRepositoryGroups, RepositoryGroup } from './Groups/Listing/Listing';
import { CreateRepositoryGroup } from './Groups/Creating/Creating';
import { ChangeRepositoryGroup } from './Groups/Changing/Changing';
import { DeleteRepositoryGroup } from './Groups/Deleting/Deleting';
import { commandFailureMessage } from '../Common';

/** One row per (group, repository) pair - the shape a subheader-grouped, expandable DataTable needs. */
type GroupMemberRow = {
    key: string;
    groupId: string;
    group: RepositoryGroup;
    repositoryId: string;
    repositoryLabel: string;
};

/**
 * How discovering an organization's repositories went. Nothing about an organization is visible until
 * its repositories load, so an organization that never got them has to say so on its own row.
 */
const discoveryTag = (organization: Organization) => {
    switch (organization.discoveryStatus) {
        case RepositoryDiscoveryStatus.discovered:
            return <Tag value={`${organization.repositoryCount} repositories`} severity='success' />;
        case RepositoryDiscoveryStatus.failed:
            return <Tag value='Discovery failed' severity='danger' />;
        default:
            return <Tag value='Discovering…' severity='info' />;
    }
};

/** How mirroring a repository's issues went - the same story one level down. */
const synchronizationTag = (repository: Repository) => {
    switch (repository.synchronizationStatus) {
        case IssueSynchronizationStatus.synchronized:
            return <Tag value='Issues loaded' severity='success' />;
        case IssueSynchronizationStatus.failed:
            return <Tag value='Issue load failed' severity='danger' />;
        default:
            return <Tag value='Loading issues…' severity='info' />;
    }
};

/**
 * The repositories settings page - three tabs managing the organizations, the tracked
 * repositories (with code repository mapping) and the named repository groups.
 */
export const Repositories = () => {
    const [repositoriesResult] = AllRepositories.use();
    const [groupsResult] = AllRepositoryGroups.use();
    const [gitHubAppStatusResult] = GetGitHubAppStatus.use();
    const [selectedOrganization, setSelectedOrganization] = useState<Organization | undefined>(undefined);
    const [selectedRepository, setSelectedRepository] = useState<Repository | undefined>(undefined);
    const [selectedGroupRow, setSelectedGroupRow] = useState<GroupMemberRow | undefined>(undefined);
    const [expandedGroupRows, setExpandedGroupRows] = useState<DataTableValueArray | DataTableExpandedRows | undefined>(undefined);
    const [addOrganizationVisible, setAddOrganizationVisible] = useState(false);
    const [addRepositoryVisible, setAddRepositoryVisible] = useState(false);
    const [createGroupVisible, setCreateGroupVisible] = useState(false);
    const [mapCodeFor, setMapCodeFor] = useState<Repository | undefined>(undefined);
    const [changeGroupFor, setChangeGroupFor] = useState<RepositoryGroup | undefined>(undefined);
    const [problem, setProblem] = useState<string | undefined>(undefined);

    const selectedGroup = selectedGroupRow?.group;

    const repositoryOptions = useMemo(() =>
        (repositoriesResult.data ?? []).map((repository) => ({
            label: `${repository.owner}/${repository.name}`,
            value: repository.id,
        })),
        [repositoriesResult.data]);

    const repositoriesById = useMemo(() => {
        const map = new Map<string, Repository>();
        (repositoriesResult.data ?? []).forEach((repository) => map.set(repository.id, repository));
        return map;
    }, [repositoriesResult.data]);

    const groupRows = useMemo(() =>
        (groupsResult.data ?? []).flatMap((group) =>
            group.repositories.map((repositoryId): GroupMemberRow => {
                const repository = repositoriesById.get(repositoryId);
                return {
                    key: `${group.id}-${repositoryId}`,
                    groupId: group.id.toString(),
                    group,
                    repositoryId,
                    repositoryLabel: repository ? `${repository.owner}/${repository.name}` : repositoryId,
                };
            })),
        [groupsResult.data, repositoriesById]);

    const groupHeaderTemplate = (row: GroupMemberRow) => (
        <span className='font-semibold'>{row.group.name}</span>
    );

    const removeRepository = async (repository: Repository) => {
        const command = new RemoveRepository();
        command.repository = repository.id;
        const result = await command.execute();
        setProblem(commandFailureMessage(result));
    };

    // Adding an organization is what triggers discovery, so adding one that is already there is the
    // retry - the same fact appended again, putting the row back to discovering.
    const retryDiscovery = async (organization: Organization) => {
        const command = new AddOrganization();
        command.name = organization.name;
        const result = await command.execute();
        setProblem(commandFailureMessage(result));
    };

    const deleteGroup = async (group: RepositoryGroup) => {
        const command = new DeleteRepositoryGroup();
        command.group = group.id;
        const result = await command.execute();
        const failure = commandFailureMessage(result);
        setProblem(failure);
        if (!failure) {
            setSelectedGroupRow(undefined);
        }
    };

    return (
        <Page title='Repositories'>
            {gitHubAppStatusResult.data && !gitHubAppStatusResult.data.isConfigured &&
                <div className='flex shrink-0 items-center px-4 py-2'>
                    <Message
                        className='w-full justify-start'
                        severity='warn'
                        text='No GitHub App is configured, so nothing can be read from GitHub. Organizations and repositories added now will be recorded, but their repositories and issues will not load until an App is connected under Settings - GitHub.' />
                </div>}
            {problem &&
                <div className='flex shrink-0 items-center px-4 py-2'>
                    <Message className='w-full justify-start' severity='error' text={problem} />
                </div>}
            <TabView
                className='flex min-h-0 flex-1 flex-col'
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
                            <MenuItem label='Retry discovery' icon={() => <i className='pi pi-refresh' />} disableOnUnselected command={() => selectedOrganization && retryDiscovery(selectedOrganization)} />
                        </DataPage.MenuItems>
                        <DataPage.Columns>
                            <Column field='name' header='Name' style={{ width: '16rem' }} />
                            <Column header='Repositories' body={discoveryTag} style={{ width: '12rem' }} />
                            <Column
                                header='Detail'
                                body={(organization: Organization) =>
                                    <span className='text-[var(--text-color-secondary)]'>{organization.discoveryFailure}</span>} />
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
                            <Column header='Repository' body={(repository: Repository) => `${repository.owner}/${repository.name}`} style={{ width: '20rem' }} />
                            <Column
                                header='Code repository'
                                body={(repository: Repository) =>
                                    repository.codeOwner ? `${repository.codeOwner}/${repository.codeName}` : '-'}
                                style={{ width: '20rem' }} />
                            <Column header='Issues' body={synchronizationTag} style={{ width: '12rem' }} />
                            <Column
                                header='Detail'
                                body={(repository: Repository) =>
                                    <span className='text-[var(--text-color-secondary)]'>{repository.synchronizationFailure}</span>} />
                        </DataPage.Columns>
                    </DataPage>
                </TabPanel>
                <TabPanel header='Repository groups' leftIcon='pi pi-objects-column mr-2' contentClassName='flex min-h-0 flex-1 flex-col'>
                    <div className='flex shrink-0 items-center justify-between px-4 py-2'>
                        <Menubar
                            model={[
                                { label: 'Create', icon: 'pi pi-plus', command: () => setCreateGroupVisible(true) },
                                { label: 'Change members', icon: 'pi pi-pencil', disabled: !selectedGroup, command: () => selectedGroup && setChangeGroupFor(selectedGroup) },
                                { label: 'Delete', icon: 'pi pi-trash', disabled: !selectedGroup, command: () => selectedGroup && deleteGroup(selectedGroup) },
                            ]} />
                    </div>
                    <DataTable
                        value={groupRows}
                        dataKey='key'
                        selectionMode='single'
                        selection={selectedGroupRow}
                        onSelectionChange={(event) => setSelectedGroupRow(event.value as GroupMemberRow)}
                        rowGroupMode='subheader'
                        groupRowsBy='groupId'
                        sortMode='single'
                        sortField='groupId'
                        sortOrder={1}
                        rowGroupHeaderTemplate={groupHeaderTemplate}
                        expandableRowGroups
                        expandedRows={expandedGroupRows}
                        onRowToggle={(event) => setExpandedGroupRows(event.data)}
                        scrollable
                        scrollHeight='flex'
                        emptyMessage='No repository groups'
                        style={{ height: '100%' }}>
                        <Column field='repositoryLabel' header='Repository' />
                    </DataTable>
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
