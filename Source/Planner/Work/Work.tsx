// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Tag } from 'primereact/tag';
import { AllWork, WorkItem } from './Listing/Listing';
import { WorkPurpose } from './WorkPurpose';
import { WorkStatus } from './WorkStatus';

const statusSeverity = (status: WorkStatus) => {
    switch (status) {
        case WorkStatus.running: return 'warning';
        case WorkStatus.completed: return 'success';
        case WorkStatus.failed: return 'danger';
        default: return 'info';
    }
};

const statusLabel = (status: WorkStatus) => {
    switch (status) {
        case WorkStatus.running: return 'Running';
        case WorkStatus.completed: return 'Completed';
        case WorkStatus.failed: return 'Failed';
        default: return 'Scheduled';
    }
};

/**
 * The work page - shows scheduled, running and finished agent work with its outcome.
 */
export const Work = () => {
    const [workResult] = AllWork.use();

    const items = [...(workResult.data ?? [])].sort((left, right) => {
        const leftTime = left.startedAt ? new Date(left.startedAt).getTime() : Number.MAX_SAFE_INTEGER;
        const rightTime = right.startedAt ? new Date(right.startedAt).getTime() : Number.MAX_SAFE_INTEGER;
        return rightTime - leftTime;
    });

    return (
        <div className='flex h-full flex-col'>
            <div className='border-b border-[var(--surface-border)] px-4 py-3'>
                <h1 className='m-0 text-lg font-semibold'>Work</h1>
            </div>
            <div className='min-h-0 flex-1'>
                <DataTable
                    value={items}
                    dataKey='id'
                    scrollable
                    scrollHeight='flex'
                    size='small'
                    emptyMessage='No work has been scheduled yet'
                    style={{ height: '100%' }}>
                    <Column
                        header='Purpose'
                        body={(work: WorkItem) => work.purpose === WorkPurpose.investigation ? 'Investigation' : 'Implementation'}
                        style={{ width: '10rem' }} />
                    <Column
                        header='Issues'
                        body={(work: WorkItem) => work.issues.join(', ')} />
                    <Column field='model' header='Model' style={{ width: '8rem' }} />
                    <Column
                        header='Status'
                        body={(work: WorkItem) => <Tag value={statusLabel(work.status)} severity={statusSeverity(work.status)} />}
                        style={{ width: '9rem' }} />
                    <Column
                        header='Started'
                        body={(work: WorkItem) => work.startedAt ? new Date(work.startedAt).toLocaleString() : '-'}
                        style={{ width: '12rem' }} />
                    <Column
                        header='Outcome'
                        body={(work: WorkItem) => work.reason ?? work.summary ?? work.findings ?? '-'} />
                </DataTable>
            </div>
        </div>
    );
};
