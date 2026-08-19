// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import MarkdownPreview from '@uiw/react-markdown-preview';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Dropdown } from '@cratis/components/Dropdown';
import { Issue, IssueComment } from './Listing/Listing';
import { IssueStatus } from './IssueStatus';
import { ChangeIssueStatus } from './ChangingStatus/ChangingStatus';
import { AcceptPullRequest } from './AcceptingPullRequest/AcceptingPullRequest';
import { SetIssueModel } from './SettingModel/SettingModel';
import { Priority } from './Priority';
import { SetIssuePriority } from './SettingPriority/SettingPriority';
import { priorityLabel, prioritySeverity } from './Issues';
import { ScheduleWork } from '../Work/Scheduling/Scheduling';
import { WorkPurpose } from '../Work/WorkPurpose';

const priorityOptions = [
    { label: 'Not set', value: Priority.notSet },
    { label: 'Critical', value: Priority.critical },
    { label: 'High', value: Priority.high },
    { label: 'Normal', value: Priority.normal },
    { label: 'Low', value: Priority.low },
];

const modelOptions = [
    { label: 'Automatic', value: '' },
    { label: 'Opus', value: 'opus' },
    { label: 'Sonnet', value: 'sonnet' },
    { label: 'Haiku', value: 'haiku' },
];

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

    const setModel = async (model: string) => {
        const command = new SetIssueModel();
        command.issue = issue.id;
        command.model = model;
        await command.execute();
    };

    const setPriority = async (priority: Priority) => {
        const command = new SetIssuePriority();
        command.issue = issue.id;
        command.priority = priority;
        await command.execute();
    };

    const comments = [...(issue.comments ?? [])].sort(
        (left, right) => new Date(left.commentedAt).getTime() - new Date(right.commentedAt).getTime());

    return (
        <div className='flex h-full flex-col gap-4 overflow-auto p-4' data-color-mode='dark'>
            <h2 className='m-0 text-lg font-semibold'>{issue.title}</h2>
            <div className='flex flex-wrap items-center gap-2'>
                <Tag value={statusLabel(issue.status)} severity={statusSeverity(issue.status)} />
                {issue.priority !== Priority.notSet && <Tag value={priorityLabel(issue.priority)} severity={prioritySeverity(issue.priority)} />}
                {!issue.isOpen && <Tag value='Closed' severity='danger' />}
                {(issue.labels ?? []).map((label) => <Tag key={label} value={label} severity='secondary' />)}
            </div>

            <div className='text-sm text-[var(--text-color-secondary)]'>
                {issue.owner}/{issue.repository}#{issue.number}
                {' · '}{issue.type || 'No type'}
                {' · '}opened by {issue.createdBy} on {new Date(issue.createdAt).toLocaleDateString()}
                {issue.suggestedModel ? ` · suggested model: ${issue.suggestedModel}` : ''}
                {issue.milestone ? ` · milestone: ${issue.milestone}` : ''}
                {(issue.assignees ?? []).length > 0 ? ` · assigned to ${(issue.assignees ?? []).join(', ')}` : ''}
            </div>

            <div className='flex flex-wrap items-center gap-2'>
                <Dropdown
                    value={issue.status}
                    options={statusOptions}
                    onChange={(e) => changeStatus(e.value as IssueStatus)} />
                <Dropdown
                    value={issue.overriddenModel ?? ''}
                    options={modelOptions}
                    placeholder='Model'
                    onChange={(e) => setModel(e.value as string)} />
                <Dropdown
                    value={issue.priority}
                    options={priorityOptions}
                    placeholder='Priority'
                    onChange={(e) => setPriority(e.value as Priority)} />
                <Button label='Open on GitHub' icon='pi pi-external-link' outlined onClick={() => window.open(issueUrl, '_blank')} />
                <Button label='Investigate' icon='pi pi-search' outlined onClick={() => scheduleWork(WorkPurpose.investigation)} />
                <Button label='Implement' icon='pi pi-bolt' outlined onClick={() => scheduleWork(WorkPurpose.implementation)} />
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
                        <Button label='Accept' icon='pi pi-check' severity='success' onClick={acceptPullRequest} />
                    </div>
                </div>}

            {issue.body &&
                <div className='rounded border border-[var(--surface-border)] p-3'>
                    <MarkdownPreview source={issue.body} style={{ background: 'transparent' }} />
                </div>}

            {issue.investigation &&
                <div className='flex flex-col gap-2'>
                    <div className='font-medium'>Investigation</div>
                    <div className='max-h-96 overflow-auto rounded border border-[var(--surface-border)] p-3'>
                        <MarkdownPreview source={issue.investigation} style={{ background: 'transparent' }} />
                    </div>
                </div>}

            {issue.prompt &&
                <div className='flex flex-col gap-2'>
                    <div className='font-medium'>Instructions for the agent</div>
                    <div className='rounded border border-[var(--surface-border)] p-3 text-sm'>{issue.prompt}</div>
                </div>}

            <div className='flex flex-col gap-3'>
                <div className='font-medium'>Comments ({comments.length})</div>
                {comments.map((comment: IssueComment) => (
                    <div key={comment.id} className='rounded border border-[var(--surface-border)]'>
                        <div className='border-b border-[var(--surface-border)] bg-[var(--surface-card)] px-3 py-1 text-sm'>
                            <span className='font-medium'>{comment.author}</span>
                            <span className='text-[var(--text-color-secondary)]'> · {new Date(comment.commentedAt).toLocaleString()}</span>
                        </div>
                        <div className='p-3'>
                            <MarkdownPreview source={comment.body} style={{ background: 'transparent' }} />
                        </div>
                    </div>
                ))}
                {comments.length === 0 && <div className='text-sm text-[var(--text-color-secondary)]'>No comments</div>}
            </div>
        </div>
    );
};
