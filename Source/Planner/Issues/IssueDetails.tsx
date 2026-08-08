// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Tag } from 'primereact/tag';
import { Issue } from './Listing/Listing';
import { IssueStatus } from './IssueStatus';
import { ChangeIssueStatus } from './ChangingStatus/ChangingStatus';
import { AcceptPullRequest } from './AcceptingPullRequest/AcceptingPullRequest';
import { ScheduleWork } from '../Work/Scheduling/Scheduling';
import { WorkPurpose } from '../Work/WorkPurpose';

/**
 * Props for the {@link IssueDetails} component.
 */
export interface IssueDetailsProps {
    /**
     * The issue to show details for.
     */
    issue: Issue;
}

const statusOptions = [
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

export const statusLabel = (status: IssueStatus) =>
    statusOptions.find((option) => option.value === status)?.label ?? 'None';

export const IssueDetails = ({ issue }: IssueDetailsProps) => {
    const issueUrl = `https://github.com/${issue.owner}/${issue.repository}/issues/${issue.number}`;

    const changeStatus = async (status: IssueStatus) => {
        const command = new ChangeIssueStatus();
        command.issue = issue.id;
        command.status = status;
        await command.execute();
    };

    const scheduleWork = async (purpose: WorkPurpose) => {
        const command = new ScheduleWork();
        command.purpose = purpose;
        command.issues = [issue.id];
        await command.execute();
    };

    const acceptPullRequest = async () => {
        const command = new AcceptPullRequest();
        command.issue = issue.id;
        await command.execute();
    };

    const properties = [
        { label: 'Repository', value: `${issue.owner}/${issue.repository}` },
        { label: 'Number', value: `#${issue.number}` },
        { label: 'Type', value: issue.type || '-' },
        { label: 'Created by', value: issue.createdBy },
        { label: 'Created', value: new Date(issue.createdAt).toLocaleString() },
        { label: 'State', value: issue.isOpen ? 'Open' : 'Closed' },
        { label: 'Suggested model', value: issue.suggestedModel || '-' },
    ];

    return (
        <div className='flex h-full flex-col gap-4 overflow-auto p-4'>
            <h2 className='m-0 text-lg font-semibold'>{issue.title}</h2>
            <div className='flex items-center gap-2'>
                <Tag value={statusLabel(issue.status)} severity={statusSeverity(issue.status)} />
                {!issue.isOpen && <Tag value='Closed' severity='danger' />}
            </div>

            <dl className='m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1'>
                {properties.map((property) => (
                    <div key={property.label} className='contents'>
                        <dt className='font-medium text-[var(--text-color-secondary)]'>{property.label}</dt>
                        <dd className='m-0'>{property.value}</dd>
                    </div>
                ))}
            </dl>

            <div className='flex flex-col gap-2'>
                <label className='font-medium' htmlFor='issue-status'>Status</label>
                <Dropdown
                    id='issue-status'
                    value={issue.status}
                    options={statusOptions}
                    onChange={(e) => changeStatus(e.value as IssueStatus)} />
            </div>

            <div className='flex flex-wrap gap-2'>
                <Button
                    label='Open on GitHub'
                    icon='pi pi-external-link'
                    outlined
                    onClick={() => window.open(issueUrl, '_blank')} />
                <Button
                    label='Start investigation'
                    icon='pi pi-search'
                    outlined
                    onClick={() => scheduleWork(WorkPurpose.investigation)} />
                <Button
                    label='Schedule implementation'
                    icon='pi pi-bolt'
                    outlined
                    onClick={() => scheduleWork(WorkPurpose.implementation)} />
            </div>

            {issue.pullRequestUrl &&
                <div className='flex flex-col gap-2 rounded border border-[var(--surface-border)] p-3'>
                    <div className='font-medium'>Pull request #{issue.pullRequest}</div>
                    <div className='flex gap-2'>
                        <Button
                            label='View pull request'
                            icon='pi pi-external-link'
                            outlined
                            onClick={() => window.open(issue.pullRequestUrl, '_blank')} />
                        <Button
                            label='Accept'
                            icon='pi pi-check'
                            severity='success'
                            onClick={acceptPullRequest} />
                    </div>
                </div>}

            {issue.investigation &&
                <div className='flex flex-col gap-2'>
                    <div className='font-medium'>Investigation</div>
                    <pre className='m-0 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-[var(--surface-card)] p-3 text-sm'>
                        {issue.investigation}
                    </pre>
                </div>}
        </div>
    );
};
