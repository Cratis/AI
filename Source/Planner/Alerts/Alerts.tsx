// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useState } from 'react';
import { Column } from 'primereact/column';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import { DataPage, MenuItem } from '@cratis/components/DataPage';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { TextAreaField } from '@cratis/components/CommandForm/fields';
import { AllAlerts, Alert } from './Listing/Listing';
import { AlertStatus } from './AlertStatus';
import { AlertDetails, alertSeverityLabel, alertSeveritySeverity, alertStatusLabel, alertStatusSeverity } from './AlertDetails';
import { ConvertToIssueDialog } from './ConvertToIssueDialog';
import { AddAlertNote } from './AddingNote/AddingNote';
import { ResolveAlert } from './Resolving/Resolving';
import { DeleteAlert } from './Deleting/Deleting';
import { ScheduleAlertInvestigation } from '../Work/SchedulingAlertInvestigation/SchedulingAlertInvestigation';
import { Current as GetOperationsSettings } from '../Operations/OperationsSettings';
import { commandFailureMessage } from './commandFeedback';

/**
 * The alerts page - what running systems have reported, what agents made of it, and the actions a
 * person takes from there.
 */
export const Alerts = () => {
    const [operationsResult] = GetOperationsSettings.use();
    const [selected, setSelected] = useState<Alert | undefined>(undefined);
    const [noteFor, setNoteFor] = useState<Alert | undefined>(undefined);
    const [resolveFor, setResolveFor] = useState<Alert | undefined>(undefined);
    const [convertFor, setConvertFor] = useState<Alert | undefined>(undefined);
    const [problem, setProblem] = useState<string | undefined>(undefined);

    const operations = operationsResult.data;
    const hasOperationalAccess = !!operations &&
        (operations.hasKubernetes || operations.hasDocker || operations.hasLogs || operations.hasDashboards);

    const investigate = async (alert: Alert) => {
        const command = new ScheduleAlertInvestigation();
        command.alert = alert.id;
        const result = await command.execute();
        setProblem(commandFailureMessage(result));
    };

    const remove = async (alert: Alert) => {
        const command = new DeleteAlert();
        command.alert = alert.id;
        const result = await command.execute();
        const failure = commandFailureMessage(result);
        setProblem(failure);
        if (!failure) {
            setSelected(undefined);
        }
    };

    return (
        <>
            {!hasOperationalAccess &&
                <div className='flex shrink-0 items-center px-4 py-2'>
                    <Message
                        className='w-full justify-start'
                        severity='warn'
                        text='No operational access is configured, so an agent investigating an alert can only reason from the alert itself - it cannot look at the running system. Set Planner:Operations to give it a cluster, a container runtime or logs.' />
                </div>}
            {problem &&
                <div className='flex shrink-0 items-center px-4 py-2'>
                    <Message className='w-full justify-start' severity='error' text={problem} />
                </div>}
            <DataPage
                title='Alerts'
                query={AllAlerts}
                emptyMessage='Nothing has been reported'
                dataKey='id'
                selection={selected}
                onSelectionChange={(event) => setSelected(event.value as Alert)}
                detailsComponent={AlertDetails}>
                <DataPage.MenuItems>
                    <MenuItem
                        label='Investigate'
                        icon={() => <i className='pi pi-search' />}
                        disableOnUnselected
                        command={() => selected && investigate(selected)} />
                    <MenuItem
                        label='Add note'
                        icon={() => <i className='pi pi-comment' />}
                        disableOnUnselected
                        command={() => setNoteFor(selected)} />
                    <MenuItem
                        label='Create issue'
                        icon={() => <i className='pi pi-github' />}
                        disableOnUnselected
                        command={() => setConvertFor(selected)} />
                    <MenuItem
                        label='Resolve'
                        icon={() => <i className='pi pi-check' />}
                        disableOnUnselected
                        command={() => setResolveFor(selected)} />
                    <MenuItem
                        label='Delete'
                        icon={() => <i className='pi pi-trash' />}
                        disableOnUnselected
                        command={() => selected && remove(selected)} />
                </DataPage.MenuItems>
                <DataPage.Columns>
                    <Column
                        header='Severity'
                        body={(alert: Alert) => <Tag value={alertSeverityLabel(alert.severity)} severity={alertSeveritySeverity(alert.severity)} />}
                        style={{ width: '8rem' }} />
                    <Column field='source' header='Source' style={{ width: '12rem' }} />
                    <Column field='title' header='Alert' />
                    <Column
                        header='Status'
                        body={(alert: Alert) => <Tag value={alertStatusLabel(alert.status)} severity={alertStatusSeverity(alert.status)} />}
                        style={{ width: '12rem' }} />
                    <Column
                        header='Issue'
                        body={(alert: Alert) => alert.issue
                            ? <a href={alert.issueUrl} target='_blank' rel='noreferrer'>#{alert.issue}</a>
                            : <span className='text-[var(--text-color-secondary)]'>-</span>}
                        style={{ width: '6rem' }} />
                    <Column field='occurrences' header='Seen' style={{ width: '5rem' }} />
                    <Column
                        header='Last seen'
                        body={(alert: Alert) => alert.lastObservedAt ? new Date(alert.lastObservedAt).toLocaleString() : '-'}
                        style={{ width: '14rem' }} />
                </DataPage.Columns>
            </DataPage>

            {noteFor &&
                <CommandDialog<AddAlertNote>
                    command={AddAlertNote}
                    visible
                    title={`Add a note to ${noteFor.title}`}
                    width='36rem'
                    okLabel='Add'
                    cancelLabel='Cancel'
                    initialValues={{ alert: noteFor.id, text: '' }}
                    onConfirm={() => setNoteFor(undefined)}
                    onCancel={() => setNoteFor(undefined)}>
                    <TextAreaField<AddAlertNote>
                        value={(instance) => instance.text}
                        title='Note'
                        rows={6}
                        placeholder='What you found out, or what you did' />
                </CommandDialog>}

            {resolveFor &&
                <CommandDialog<ResolveAlert>
                    command={ResolveAlert}
                    visible
                    title={`Resolve ${resolveFor.title}`}
                    width='36rem'
                    okLabel='Resolve'
                    cancelLabel='Cancel'
                    initialValues={{
                        alert: resolveFor.id,
                        resolution: resolveFor.status === AlertStatus.needsAttention ? (resolveFor.findings ?? '') : '',
                    }}
                    onConfirm={() => setResolveFor(undefined)}
                    onCancel={() => setResolveFor(undefined)}>
                    <TextAreaField<ResolveAlert>
                        value={(instance) => instance.resolution}
                        title='Resolution'
                        rows={6}
                        placeholder='How the alert was resolved' />
                </CommandDialog>}

            {convertFor && <ConvertToIssueDialog alert={convertFor} onClose={() => setConvertFor(undefined)} />}
        </>
    );
};
