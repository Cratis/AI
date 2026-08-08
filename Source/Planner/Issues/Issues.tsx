// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { DragEvent, useMemo, useState } from 'react';
import { Allotment } from 'allotment';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable, DataTableRowReorderEvent } from 'primereact/datatable';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { Dropdown } from '@cratis/components/Dropdown';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { InputTextField, TextAreaField } from '@cratis/components/CommandForm/fields';
import { AllIssues, Issue } from './Listing/Listing';
import { AllGroups, Group } from './Grouping/Listing/Listing';
import { IssueStatus } from './IssueStatus';
import { ReorderIssue } from './Reordering/Reordering';
import { CreateGroup } from './Grouping/Creating/Creating';
import { AddIssueToGroup } from './Grouping/AddingIssue/AddingIssue';
import { RemoveIssueFromGroup } from './Grouping/RemovingIssue/RemovingIssue';
import { DeleteGroup } from './Grouping/Deleting/Deleting';
import { RenameGroup } from './Grouping/Renaming/Renaming';
import { SetGroupPrompt } from './Grouping/SettingPrompt/SettingPrompt';
import { IssueDetails, statusLabel } from './IssueDetails';
import { computeNewOrder, sortIssues } from './issueOrdering';

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
 * The issues page - open issues across all configured repositories with filtering, manual
 * ordering, drag-onto-row grouping and a resizable detail pane rendering the full issue.
 */
export const Issues = () => {
    const [issuesResult] = AllIssues.use();
    const [groupsResult] = AllGroups.use();
    const [selected, setSelected] = useState<Issue | undefined>(undefined);
    const [search, setSearch] = useState('');
    const [userFilter, setUserFilter] = useState<string | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState<IssueStatus | undefined>(undefined);
    const [renameFor, setRenameFor] = useState<Group | undefined>(undefined);
    const [promptFor, setPromptFor] = useState<Group | undefined>(undefined);
    const [dragged, setDragged] = useState<Issue | undefined>(undefined);

    const groupsById = useMemo(() => {
        const map = new Map<string, Group>();
        groupsResult.data?.forEach((group) => map.set(group.id, group));
        return map;
    }, [groupsResult.data]);

    const rows = useMemo(() => {
        const open = (issuesResult.data ?? []).filter((issue) => issue.isOpen);
        const filtered = open.filter((issue) => {
            if (userFilter && issue.createdBy !== userFilter) return false;
            if (statusFilter !== undefined && issue.status !== statusFilter) return false;
            if (search && !`${issue.owner}/${issue.repository}#${issue.number} ${issue.title}`.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
        const sorted = sortIssues(filtered, (issue) => new Date(issue.createdAt).getTime());

        // Grouped issues cluster under their group's subheader; ungrouped issues trail in one
        // block, keeping their manual/newest-first order.
        const grouped: IssueRow[] = [];
        const seenGroups: string[] = [];
        for (const issue of sorted) {
            const key = issue.group && issue.group !== '' ? issue.group : ungrouped;
            if (key !== ungrouped && !seenGroups.includes(key)) seenGroups.push(key);
            grouped.push(Object.assign({}, issue, { groupKey: key }) as IssueRow);
        }

        return grouped.sort((left, right) => {
            const leftKey = left.groupKey === ungrouped ? Number.MAX_SAFE_INTEGER : seenGroups.indexOf(left.groupKey);
            const rightKey = right.groupKey === ungrouped ? Number.MAX_SAFE_INTEGER : seenGroups.indexOf(right.groupKey);
            return leftKey - rightKey;
        });
    }, [issuesResult.data, search, userFilter, statusFilter]);

    const users = useMemo(() =>
        [...new Set((issuesResult.data ?? []).filter((issue) => issue.isOpen).map((issue) => issue.createdBy))]
            .sort()
            .map((user) => ({ label: user, value: user })),
        [issuesResult.data]);

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
        command.issues = (issuesResult.data ?? []).filter((issue) => issue.group === group.id).map((issue) => issue.id);
        await command.execute();
    };

    const groupHeaderTemplate = (row: IssueRow) => {
        if (row.groupKey === ungrouped) {
            return <span className='text-sm font-medium text-[var(--text-color-secondary)]'>Ungrouped</span>;
        }

        const group = groupsById.get(row.groupKey);
        return (
            <div className='flex items-center gap-2'>
                <i className='pi pi-objects-column' />
                <span className='font-semibold'>{group?.name ?? 'Group'}</span>
                {group?.prompt && <Tag value='Has instructions' severity='secondary' />}
                {group &&
                    <span className='flex gap-1'>
                        <Button icon='pi pi-pencil' rounded text size='small' tooltip='Rename group' onClick={() => setRenameFor(group)} />
                        <Button icon='pi pi-comment' rounded text size='small' tooltip='Group instructions' onClick={() => setPromptFor(group)} />
                        <Button icon='pi pi-trash' rounded text size='small' severity='danger' tooltip='Delete group' onClick={() => deleteGroup(group)} />
                    </span>}
            </div>
        );
    };

    const dragCell = (issue: IssueRow) => (
        <div
            draggable
            className='flex h-full w-full cursor-grab items-center justify-center'
            onDragStart={(e: DragEvent) => {
                e.dataTransfer.effectAllowed = 'move';
                setDragged(issue);
            }}
            onDragOver={(e: DragEvent) => e.preventDefault()}
            onDrop={() => dropOn(issue)}
            title='Drag onto another issue to group them'>
            <i className='pi pi-th-large text-[var(--text-color-secondary)]' />
        </div>
    );

    const issueCell = (issue: IssueRow) => (
        <div
            className='h-full w-full'
            onDragOver={(e: DragEvent) => e.preventDefault()}
            onDrop={() => dropOn(issue)}>
            {issue.owner}/{issue.repository}#{issue.number}
        </div>
    );

    return (
        <div className='flex h-full flex-col'>
            <div className='flex flex-wrap items-center gap-2 border-b border-[var(--surface-border)] px-4 py-2'>
                <InputText placeholder='Search issues' value={search} onChange={(e) => setSearch(e.target.value)} />
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
            </div>

            <div className='min-h-0 flex-1 overflow-hidden'>
                <Allotment className='h-full' proportionalLayout={false}>
                    <Allotment.Pane>
                        <DataTable
                            value={rows}
                            dataKey='id'
                            selectionMode='single'
                            selection={selected}
                            onSelectionChange={(e) => setSelected(e.value as Issue)}
                            rowGroupMode='subheader'
                            groupRowsBy='groupKey'
                            rowGroupHeaderTemplate={groupHeaderTemplate}
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
                            <IssueDetails issue={(issuesResult.data ?? []).find((issue) => issue.id === selected.id) ?? selected} />
                        </Allotment.Pane>}
                </Allotment>
            </div>

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

            {promptFor &&
                <CommandDialog<SetGroupPrompt>
                    command={SetGroupPrompt}
                    visible
                    title={`Instructions for ${promptFor.name}`}
                    width='36rem'
                    okLabel='Save'
                    cancelLabel='Cancel'
                    initialValues={{ group: promptFor.id, prompt: promptFor.prompt ?? '' }}
                    onConfirm={() => setPromptFor(undefined)}
                    onCancel={() => setPromptFor(undefined)}>
                    <TextAreaField<SetGroupPrompt> value={(instance) => instance.prompt} title='Instructions' placeholder='Extra instructions sent along when an agent works on this group' />
                </CommandDialog>}
        </div>
    );
};
