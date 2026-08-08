// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useMemo, useState } from 'react';
import { Allotment } from 'allotment';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable, DataTableRowReorderEvent } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { AllIssues, Issue } from './Listing/Listing';
import { AllGroups } from './Grouping/Listing/Listing';
import { IssueStatus } from './IssueStatus';
import { ReorderIssue } from './Reordering/Reordering';
import { CreateGroup } from './Grouping/Creating/Creating';
import { AddIssueToGroup } from './Grouping/AddingIssue/AddingIssue';
import { RemoveIssueFromGroup } from './Grouping/RemovingIssue/RemovingIssue';
import { DeleteGroup } from './Grouping/Deleting/Deleting';
import { IssueDetails, statusLabel } from './IssueDetails';
import { computeNewOrder, sortIssues } from './issueOrdering';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { InputTextField } from '@cratis/components/CommandForm/fields';

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

/**
 * The issues page - lists issues across all configured repositories with filtering, manual
 * ordering, grouping and a resizable detail pane, like the Chronicle workbench's observer view.
 */
export const Issues = () => {
    const [issuesResult] = AllIssues.use();
    const [groupsResult] = AllGroups.use();
    const [selected, setSelected] = useState<Issue | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<Issue[]>([]);
    const [search, setSearch] = useState('');
    const [userFilter, setUserFilter] = useState<string | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState<IssueStatus | undefined>(undefined);
    const [groupDialogVisible, setGroupDialogVisible] = useState(false);

    const groupsById = useMemo(() => {
        const map = new Map<string, string>();
        groupsResult.data?.forEach((group) => map.set(group.id, group.name));
        return map;
    }, [groupsResult.data]);

    const issues = useMemo(
        () => sortIssues(issuesResult.data ?? [], (issue) => new Date(issue.createdAt).getTime()),
        [issuesResult.data]);

    const users = useMemo(() =>
        [...new Set((issuesResult.data ?? []).map((issue) => issue.createdBy))].sort().map((user) => ({ label: user, value: user })),
        [issuesResult.data]);

    const filtered = useMemo(() => issues.filter((issue) => {
        if (userFilter && issue.createdBy !== userFilter) return false;
        if (statusFilter !== undefined && issue.status !== statusFilter) return false;
        if (search && !`${issue.owner}/${issue.repository}#${issue.number} ${issue.title}`.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    }), [issues, search, userFilter, statusFilter]);

    const onRowReorder = async (event: DataTableRowReorderEvent<Issue[]>) => {
        const moved = event.value[event.dropIndex];
        if (!moved) return;

        const command = new ReorderIssue();
        command.issue = moved.id;
        command.order = computeNewOrder(event.value, event.dropIndex);
        await command.execute();
    };

    const addToGroup = async (groupId: string) => {
        for (const issue of selectedRows) {
            const command = new AddIssueToGroup();
            command.group = groupId;
            command.issue = issue.id;
            await command.execute();
        }
    };

    const removeFromGroup = async () => {
        for (const issue of selectedRows.filter((candidate) => candidate.group)) {
            const command = new RemoveIssueFromGroup();
            command.issue = issue.id;
            await command.execute();
        }
    };

    const deleteGroup = async (groupId: string) => {
        const command = new DeleteGroup();
        command.group = groupId;
        command.issues = (issuesResult.data ?? []).filter((issue) => issue.group === groupId).map((issue) => issue.id);
        await command.execute();
    };

    const groupOptions = [...groupsById.entries()].map(([id, name]) => ({ label: name, value: id }));

    return (
        <div className='flex h-full flex-col'>
            <div className='flex flex-wrap items-center gap-2 border-b border-[var(--surface-border)] px-4 py-2'>
                <span className='p-input-icon-left'>
                    <InputText
                        placeholder='Search issues'
                        value={search}
                        onChange={(e) => setSearch(e.target.value)} />
                </span>
                <Dropdown
                    placeholder='Reported by'
                    showClear
                    value={userFilter}
                    options={users}
                    onChange={(e) => setUserFilter(e.value as string | undefined)} />
                <Dropdown
                    placeholder='Status'
                    value={statusFilter}
                    options={statusFilterOptions}
                    onChange={(e) => setStatusFilter(e.value as IssueStatus | undefined)} />
                <div className='flex-1' />
                <Button
                    label='Group selected'
                    icon='pi pi-objects-column'
                    outlined
                    disabled={selectedRows.length < 1}
                    onClick={() => setGroupDialogVisible(true)} />
                <Dropdown
                    placeholder='Add to group'
                    disabled={selectedRows.length < 1 || groupOptions.length === 0}
                    options={groupOptions}
                    onChange={(e) => addToGroup(e.value as string)} />
                <Button
                    label='Remove from group'
                    icon='pi pi-minus-circle'
                    outlined
                    disabled={!selectedRows.some((issue) => issue.group)}
                    onClick={removeFromGroup} />
            </div>

            <div className='min-h-0 flex-1 overflow-hidden'>
                <Allotment className='h-full' proportionalLayout={false}>
                    <Allotment.Pane>
                        <DataTable
                            value={filtered}
                            dataKey='id'
                            selection={selectedRows}
                            selectionMode='checkbox'
                            onSelectionChange={(e) => setSelectedRows(e.value as Issue[])}
                            onRowClick={(e) => setSelected(e.data as Issue)}
                            reorderableRows
                            onRowReorder={onRowReorder}
                            scrollable
                            scrollHeight='flex'
                            size='small'
                            emptyMessage='No issues - add an organization or repository under settings'
                            style={{ height: '100%' }}>
                            <Column rowReorder style={{ width: '3rem' }} />
                            <Column selectionMode='multiple' style={{ width: '3rem' }} />
                            <Column
                                header='Issue'
                                body={(issue: Issue) => `${issue.owner}/${issue.repository}#${issue.number}`}
                                style={{ width: '16rem' }} />
                            <Column field='title' header='Title' />
                            <Column
                                header='Group'
                                body={(issue: Issue) => issue.group ? (
                                    <div className='flex items-center gap-1'>
                                        <Tag value={groupsById.get(issue.group) ?? 'Group'} />
                                        <Button
                                            icon='pi pi-times'
                                            rounded
                                            text
                                            size='small'
                                            tooltip='Delete group'
                                            onClick={() => deleteGroup(issue.group!)} />
                                    </div>
                                ) : undefined}
                                style={{ width: '11rem' }} />
                            <Column field='type' header='Type' style={{ width: '7rem' }} />
                            <Column field='createdBy' header='By' style={{ width: '9rem' }} />
                            <Column
                                header='Created'
                                body={(issue: Issue) => new Date(issue.createdAt).toLocaleDateString()}
                                style={{ width: '8rem' }} />
                            <Column
                                header='Status'
                                body={(issue: Issue) => <Tag value={statusLabel(issue.status)} severity={statusSeverity(issue.status)} />}
                                style={{ width: '11rem' }} />
                        </DataTable>
                    </Allotment.Pane>
                    {selected &&
                        <Allotment.Pane preferredSize='450px'>
                            <IssueDetails issue={(issuesResult.data ?? []).find((issue) => issue.id === selected.id) ?? selected} />
                        </Allotment.Pane>}
                </Allotment>
            </div>

            {groupDialogVisible &&
                <CommandDialog<CreateGroup>
                    command={CreateGroup}
                    visible
                    title='Create group'
                    width='30rem'
                    okLabel='Create'
                    cancelLabel='Cancel'
                    initialValues={{ issues: selectedRows.map((issue) => issue.id) }}
                    onConfirm={() => setGroupDialogVisible(false)}
                    onCancel={() => setGroupDialogVisible(false)}>
                    <InputTextField<CreateGroup> value={(instance) => instance.name} title='Name' placeholder='Name of the group' />
                </CommandDialog>}
        </div>
    );
};
