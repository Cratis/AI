// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { DragEvent, useMemo, useState } from 'react';
import { Allotment } from 'allotment';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable, DataTableExpandedRows, DataTableRowReorderEvent, DataTableValueArray } from 'primereact/datatable';
import { InputText } from 'primereact/inputtext';
import { Menubar } from 'primereact/menubar';
import { Tag } from 'primereact/tag';
import { Page } from '@cratis/components/Common';
import { Dropdown } from '@cratis/components/Dropdown';
import { AllIssues, Issue } from './Listing/Listing';
import { AllGroups, Group } from './Grouping/Listing/Listing';
import { IssueStatus } from './IssueStatus';
import { ReorderIssue } from './Reordering/Reordering';
import { CreateGroup } from './Grouping/Creating/Creating';
import { AddIssueToGroup } from './Grouping/AddingIssue/AddingIssue';
import { RemoveIssueFromGroup } from './Grouping/RemovingIssue/RemovingIssue';
import { DeleteGroup } from './Grouping/Deleting/Deleting';
import { RenameGroup } from './Grouping/Renaming/Renaming';
import { IssueDetails, statusLabel } from './IssueDetails';
import { GroupInstructionsDialog, IssueInstructionsDialog } from './InstructionsDialogs';
import { computeNewOrder, sortIssues } from './issueOrdering';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { InputTextField } from '@cratis/components/CommandForm/fields';

const ungrouped = 'zz-ungrouped';

const statusFilterOptions = [
    { label: 'All statuses', value: undefined },
    { label: 'None', value: IssueStatus.none },
    { label: 'Ready for development', value: IssueStatus.readyForDevelopment },
    { label: 'In progress', value: IssueStatus.inProgress },
    { label: 'For review', value: IssueStatus.forReview },
];

const statusSeverity = (status: IssueStatus) => {
    switch (status) {
        case IssueStatus.readyForDevelopment: return 'info';
        case IssueStatus.inProgress: return 'warning';
        case IssueStatus.forReview: return 'success';
        default: return undefined;
    }
};

type IssueRow = Issue & { groupKey: string };

/**
 * The issues page - open issues across all configured repositories with toolbar filters, manual
 * ordering, drag-onto-row grouping and a resizable detail pane rendering the full issue.
 */
export const Issues = () => {
    const [issuesResult] = AllIssues.use();
    const [groupsResult] = AllGroups.use();
    const [selected, setSelected] = useState<Issue | undefined>(undefined);
    const [search, setSearch] = useState('');
    const [repositoryFilter, setRepositoryFilter] = useState<string | undefined>(undefined);
    const [userFilter, setUserFilter] = useState<string | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState<IssueStatus | undefined>(undefined);
    const [instructionsFor, setInstructionsFor] = useState<Issue | undefined>(undefined);
    const [groupInstructionsFor, setGroupInstructionsFor] = useState<Group | undefined>(undefined);
    const [renameFor, setRenameFor] = useState<Group | undefined>(undefined);
    const [dragged, setDragged] = useState<Issue | undefined>(undefined);
    const [expandedRows, setExpandedRows] = useState<DataTableValueArray | DataTableExpandedRows | undefined>(undefined);

    const groupsById = useMemo(() => {
        const map = new Map<string, Group>();
        groupsResult.data?.forEach((group) => map.set(group.id, group));
        return map;
    }, [groupsResult.data]);

    const openIssues = useMemo(
        () => (issuesResult.data ?? []).filter((issue) => issue.isOpen),
        [issuesResult.data]);

    const rows = useMemo(() => {
        const filtered = openIssues.filter((issue) => {
            if (repositoryFilter && `${issue.owner}/${issue.repository}` !== repositoryFilter) return false;
            if (userFilter && issue.createdBy !== userFilter) return false;
            if (statusFilter !== undefined && issue.status !== statusFilter) return false;
            if (search && !`${issue.owner}/${issue.repository}#${issue.number} ${issue.title}`.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
        const sorted = sortIssues(filtered, (issue) => new Date(issue.createdAt).getTime());
        return sorted.map((issue) =>
            Object.assign({}, issue, { groupKey: issue.group && issue.group !== '' ? issue.group : ungrouped }) as IssueRow);
    }, [openIssues, search, repositoryFilter, userFilter, statusFilter]);

    const repositories = useMemo(() =>
        [...new Set(openIssues.map((issue) => `${issue.owner}/${issue.repository}`))]
            .sort()
            .map((repository) => ({ label: repository, value: repository })),
        [openIssues]);

    const users = useMemo(() =>
        [...new Set(openIssues.map((issue) => issue.createdBy))]
            .sort()
            .map((user) => ({ label: user, value: user })),
        [openIssues]);

    const selectedGroup = selected?.group && selected.group !== '' ? groupsById.get(selected.group) : undefined;

    const onRowReorder = async (event: DataTableRowReorderEvent<IssueRow[]>) => {
        const moved = event.value[event.dropIndex];
        if (!moved) return;

        const command = new ReorderIssue();
        command.issue = moved.id;
        command.order = computeNewOrder(event.value, event.dropIndex);
        await command.execute();
    };

    const dropOn = async (target: Issue) => {
        if (!dragged || dragged.id === target.id) return;
        if (target.group && target.group !== '') {
            const command = new AddIssueToGroup();
            command.group = target.group;
            command.issue = dragged.id;
            await command.execute();
        } else {
            const command = new CreateGroup();
            command.name = 'New group';
            command.issues = [target.id, dragged.id];
            await command.execute();
        }

        setDragged(undefined);
    };

    const removeFromGroup = async (issue: Issue) => {
        const command = new RemoveIssueFromGroup();
        command.issue = issue.id;
        await command.execute();
    };

    const deleteGroup = async (group: Group) => {
        const command = new DeleteGroup();
        command.group = group.id;
        command.issues = openIssues.filter((issue) => issue.group === group.id).map((issue) => issue.id);
        await command.execute();
    };

    const menuItems = [
        {
            label: 'Issue instructions',
            icon: 'pi pi-comment',
            disabled: !selected,
            command: () => selected && setInstructionsFor(selected),
        },
        {
            label: 'Group instructions',
            icon: 'pi pi-comments',
            disabled: !selectedGroup,
            command: () => selectedGroup && setGroupInstructionsFor(selectedGroup),
        },
        {
            label: 'Rename group',
            icon: 'pi pi-pencil',
            disabled: !selectedGroup,
            command: () => selectedGroup && setRenameFor(selectedGroup),
        },
        {
            label: 'Delete group',
            icon: 'pi pi-trash',
            disabled: !selectedGroup,
            command: () => selectedGroup && deleteGroup(selectedGroup),
        },
    ];

    const filters = (
        <div className='flex flex-wrap items-center gap-2'>
            <InputText placeholder='Search issues' value={search} onChange={(event) => setSearch(event.target.value)} />
            <Dropdown
                placeholder='Repository'
                showClear
                value={repositoryFilter}
                options={repositories}
                onChange={(event) => setRepositoryFilter(event.value as string | undefined)} />
            <Dropdown
                placeholder='Reported by'
                showClear
                value={userFilter}
                options={users}
                onChange={(event) => setUserFilter(event.value as string | undefined)} />
            <Dropdown
                placeholder='Status'
                value={statusFilter}
                options={statusFilterOptions}
                onChange={(event) => setStatusFilter(event.value as IssueStatus | undefined)} />
        </div>
    );

    const groupHeaderTemplate = (row: IssueRow) => {
        if (row.groupKey === ungrouped) {
            return <span className='text-sm font-medium text-[var(--text-color-secondary)]'>Ungrouped</span>;
        }

        const group = groupsById.get(row.groupKey);
        return (
            <span className='inline-flex items-center gap-2'>
                <i className='pi pi-objects-column' />
                <span className='font-semibold'>{group?.name ?? 'Group'}</span>
                {group?.prompt && <Tag value='Has instructions' severity='secondary' />}
            </span>
        );
    };

    // These handlers stop propagation so the native drag gesture never bubbles into PrimeReact's
    // own reorderableRows drag handlers bound on the <tr> - without it, every grouping drag also
    // fires a row reorder, racing ReorderIssue against CreateGroup/AddIssueToGroup.
    const dragCell = (issue: IssueRow) => (
        <div
            draggable
            className='flex h-full w-full cursor-grab items-center justify-center'
            onDragStart={(event: DragEvent) => {
                event.stopPropagation();
                event.dataTransfer.effectAllowed = 'move';
                setDragged(issue);
            }}
            onDragOver={(event: DragEvent) => {
                event.preventDefault();
                event.stopPropagation();
            }}
            onDrop={(event: DragEvent) => {
                event.stopPropagation();
                dropOn(issue);
            }}
            title='Drag onto another issue to group them'>
            <i className='pi pi-th-large text-[var(--text-color-secondary)]' />
        </div>
    );

    const issueCell = (issue: IssueRow) => (
        <div
            className='h-full w-full'
            onDragOver={(event: DragEvent) => {
                event.preventDefault();
                event.stopPropagation();
            }}
            onDrop={(event: DragEvent) => {
                event.stopPropagation();
                dropOn(issue);
            }}>
            {issue.owner}/{issue.repository}#{issue.number}
        </div>
    );

    return (
        <Page title='Issues'>
            <div className='px-4 py-2'>
                <Menubar model={menuItems} end={filters} />
            </div>
            <div className='min-h-0 flex-1 overflow-hidden px-4 pb-4'>
                <Allotment className='h-full' proportionalLayout={false}>
                    <Allotment.Pane>
                        <DataTable
                            value={rows}
                            dataKey='id'
                            selectionMode='single'
                            selection={selected}
                            onSelectionChange={(event) => setSelected(event.value as Issue)}
                            rowGroupMode='subheader'
                            groupRowsBy='groupKey'
                            sortMode='single'
                            sortField='groupKey'
                            sortOrder={1}
                            rowGroupHeaderTemplate={groupHeaderTemplate}
                            expandableRowGroups
                            expandedRows={expandedRows}
                            onRowToggle={(event) => setExpandedRows(event.data)}
                            reorderableRows
                            onRowReorder={onRowReorder}
                            scrollable
                            scrollHeight='flex'
                            size='small'
                            emptyMessage='No open issues - add an organization or repository under settings'
                            style={{ height: '100%' }}>
                            <Column rowReorder style={{ width: '3rem' }} />
                            <Column body={dragCell} style={{ width: '3rem' }} />
                            <Column header='Issue' body={issueCell} style={{ width: '14rem' }} />
                            <Column field='title' header='Title' />
                            <Column
                                header='Labels'
                                body={(issue: IssueRow) => (
                                    <div className='flex flex-wrap gap-1'>
                                        {(issue.labels ?? []).map((label) => <Tag key={label} value={label} severity='secondary' />)}
                                    </div>
                                )}
                                style={{ width: '12rem' }} />
                            <Column field='type' header='Type' style={{ width: '6rem' }} />
                            <Column field='createdBy' header='By' style={{ width: '8rem' }} />
                            <Column
                                header='Created'
                                body={(issue: IssueRow) => new Date(issue.createdAt).toLocaleDateString()}
                                style={{ width: '7rem' }} />
                            <Column
                                header='Status'
                                body={(issue: IssueRow) => <Tag value={statusLabel(issue.status)} severity={statusSeverity(issue.status)} />}
                                style={{ width: '10rem' }} />
                            <Column
                                style={{ width: '3rem' }}
                                body={(issue: IssueRow) => issue.group && issue.group !== ''
                                    ? <Button icon='pi pi-minus-circle' rounded text size='small' tooltip='Remove from group' onClick={() => removeFromGroup(issue)} />
                                    : undefined} />
                        </DataTable>
                    </Allotment.Pane>
                    {selected &&
                        <Allotment.Pane preferredSize='520px'>
                            <IssueDetails issue={openIssues.find((issue) => issue.id === selected.id) ?? selected} />
                        </Allotment.Pane>}
                </Allotment>
            </div>

            {instructionsFor && <IssueInstructionsDialog issue={instructionsFor} onClose={() => setInstructionsFor(undefined)} />}
            {groupInstructionsFor && <GroupInstructionsDialog group={groupInstructionsFor} onClose={() => setGroupInstructionsFor(undefined)} />}

            {renameFor &&
                <CommandDialog<RenameGroup>
                    command={RenameGroup}
                    visible
                    title='Rename group'
                    width='30rem'
                    okLabel='Rename'
                    cancelLabel='Cancel'
                    initialValues={{ group: renameFor.id, name: renameFor.name }}
                    onConfirm={() => setRenameFor(undefined)}
                    onCancel={() => setRenameFor(undefined)}>
                    <InputTextField<RenameGroup> value={(instance) => instance.name} title='Name' placeholder='Name of the group' />
                </CommandDialog>}
        </Page>
    );
};
