// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useMemo, useState } from 'react';
import { Allotment } from 'allotment';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Menubar } from 'primereact/menubar';
import { Tag } from 'primereact/tag';
import { Page } from '@cratis/components/Common';
import { AllWork, WorkItem } from './Listing/Listing';
import { WorkPurpose } from './WorkPurpose';
import { WorkStatus } from './WorkStatus';
import { StopWork } from './Stopping/Stopping';
import { AllIssues } from '../Issues/Listing/Listing';
import { AllGroups } from '../Issues/Grouping/Listing/Listing';
import { AdHocWorkDialog } from './AdHocWorkDialog';
import { WorkDetails, workPurposeLabel, workStatusLabel, workStatusSeverity } from './WorkDetails';

interface WorkRow {
    key: string;
    workId: string;
    work: WorkItem;
    organization: string;
    repository: string;
    number: string;
    title: string;
}

/**
 * The work page - scheduled, running and finished agent work, grouped per unit of work with the
 * issues (or repositories) it covers, a live console with steering, and ad-hoc scheduling.
 */
export const Work = () => {
    const [workResult] = AllWork.use();
    const [issuesResult] = AllIssues.use();
    const [groupsResult] = AllGroups.use();
    const [selected, setSelected] = useState<WorkRow | undefined>(undefined);
    const [adHocVisible, setAdHocVisible] = useState(false);

    const issuesById = useMemo(() => {
        const map = new Map<string, { owner: string; repository: string; number: number; title: string; group?: string }>();
        issuesResult.data?.forEach((issue) => map.set(issue.id, issue));
        return map;
    }, [issuesResult.data]);

    const groupNamesById = useMemo(() => {
        const map = new Map<string, string>();
        groupsResult.data?.forEach((group) => map.set(group.id, group.name));
        return map;
    }, [groupsResult.data]);

    const rows = useMemo(() => {
        const items = [...(workResult.data ?? [])].sort((left, right) => {
            const leftTime = left.startedAt ? new Date(left.startedAt).getTime() : Number.MAX_SAFE_INTEGER;
            const rightTime = right.startedAt ? new Date(right.startedAt).getTime() : Number.MAX_SAFE_INTEGER;
            return rightTime - leftTime;
        });

        const result: WorkRow[] = [];
        for (const work of items) {
            const issues = work.issues ?? [];
            if (work.purpose === WorkPurpose.adHoc) {
                for (const repository of work.repositories ?? []) {
                    const parts = repository.split('-');
                    result.push({
                        key: `${work.id}-${repository}`,
                        workId: work.id.toString(),
                        work,
                        organization: parts[0] ?? repository,
                        repository: parts.slice(1).join('-'),
                        number: '-',
                        title: work.prompt ?? 'Ad-hoc work',
                    });
                }
                continue;
            }

            for (const issueId of issues) {
                const issue = issuesById.get(issueId);
                result.push({
                    key: `${work.id}-${issueId}`,
                    workId: work.id.toString(),
                    work,
                    organization: issue?.owner ?? issueId.split('-')[0] ?? '',
                    repository: issue?.repository ?? '',
                    number: issue ? `#${issue.number}` : issueId,
                    title: issue?.title ?? issueId,
                });
            }
        }

        return result;
    }, [workResult.data, issuesById]);

    const stop = async (work: WorkItem) => {
        const command = new StopWork();
        command.work = work.id;
        await command.execute();
    };

    const groupOf = (work: WorkItem) => {
        const groups = [...new Set((work.issues ?? [])
            .map((issueId) => issuesById.get(issueId)?.group)
            .filter((group) => group && group !== ''))];
        return groups.length === 1 ? groupNamesById.get(groups[0]!) : undefined;
    };

    const workHeaderTemplate = (row: WorkRow) => {
        const work = row.work;
        const groupName = groupOf(work);
        return (
            <div className='flex flex-wrap items-center gap-2'>
                <Tag value={workPurposeLabel(work.purpose)} />
                <Tag value={workStatusLabel(work.status)} severity={workStatusSeverity(work.status)} />
                {groupName && <Tag value={groupName} icon='pi pi-objects-column' severity='secondary' />}
                <span className='text-sm text-[var(--text-color-secondary)]'>
                    {work.model || 'auto'}
                    {work.requestedBy ? ` · ${work.requestedBy}` : ' · automation'}
                    {work.startedAt ? ` · ${new Date(work.startedAt).toLocaleString()}` : ''}
                </span>
                {(work.status === WorkStatus.scheduled || work.status === WorkStatus.running) &&
                    <Button icon='pi pi-stop-circle' rounded text size='small' severity='danger' tooltip='Stop' onClick={() => stop(work)} />}
            </div>
        );
    };

    const menuItems = [
        { label: 'Ad-hoc work', icon: 'pi pi-bolt', command: () => setAdHocVisible(true) },
        {
            label: 'Stop',
            icon: 'pi pi-stop-circle',
            disabled: !selected || (selected.work.status !== WorkStatus.scheduled && selected.work.status !== WorkStatus.running),
            command: () => selected && stop(selected.work),
        },
    ];

    return (
        <Page title='Work'>
            <div className='px-4 py-2'>
                <Menubar model={menuItems} />
            </div>
            <div className='min-h-0 flex-1 overflow-hidden px-4 pb-4'>
                <Allotment className='h-full' proportionalLayout={false}>
                    <Allotment.Pane>
                        <DataTable
                            value={rows}
                            dataKey='key'
                            selectionMode='single'
                            selection={selected}
                            onSelectionChange={(e) => setSelected(e.value as WorkRow)}
                            rowGroupMode='subheader'
                            groupRowsBy='workId'
                            rowGroupHeaderTemplate={workHeaderTemplate}
                            scrollable
                            scrollHeight='flex'
                            size='small'
                            emptyMessage='No work has been scheduled yet'
                            style={{ height: '100%' }}>
                            <Column field='organization' header='Organization' style={{ width: '10rem' }} />
                            <Column field='repository' header='Repository' style={{ width: '12rem' }} />
                            <Column field='number' header='Issue' style={{ width: '6rem' }} />
                            <Column field='title' header='Title' />
                        </DataTable>
                    </Allotment.Pane>
                    {selected &&
                        <Allotment.Pane preferredSize='550px'>
                            <WorkDetails work={(workResult.data ?? []).find((work) => work.id.toString() === selected.workId) ?? selected.work} />
                        </Allotment.Pane>}
                </Allotment>
            </div>

            {adHocVisible && <AdHocWorkDialog onClose={() => setAdHocVisible(false)} />}
        </Page>
    );
};
