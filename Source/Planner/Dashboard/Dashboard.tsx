// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Tag } from 'primereact/tag';
import { Page } from '@cratis/components/Common';
import { OpenIssues } from '../Issues/Listing/Listing';
import { IssueStatus } from '../Issues/IssueStatus';
import { statusLabel } from '../Issues/IssueDetails';
import { OpenPullRequests } from '../PullRequests/Listing/Listing';
import { ActiveAlerts } from '../Alerts/Listing/Listing';
import { AlertStatus } from '../Alerts/AlertStatus';
import { alertStatusLabel, alertStatusSeverity } from '../Alerts/AlertDetails';
import { ActiveWork } from '../Work/Listing/Listing';
import { WorkStatus } from '../Work/WorkStatus';
import { workPurposeLabel, workStatusLabel, workStatusSeverity } from '../Work/WorkDetails';
import { FailedBuilds } from '../Builds/Listing/Listing';

/** One summary card: a count, a label, where it links to, and the severity it is shown with. */
interface Card {
    key: string;
    count: number;
    label: string;
    to: string;
    severity: 'info' | 'warning' | 'success' | 'danger' | 'secondary';
}

const severityBorderClass: Record<Card['severity'], string> = {
    info: 'border-l-[var(--blue-500)]',
    warning: 'border-l-[var(--yellow-500)]',
    success: 'border-l-[var(--green-500)]',
    danger: 'border-l-[var(--red-500)]',
    secondary: 'border-l-[var(--surface-border)]',
};

/**
 * The landing dashboard - what needs a person's attention, what the agent is doing right now, and
 * counts to jump from into the pages that carry the detail. Everything here is derived from the
 * same open/active queries the other pages already use, so a row that disappears there disappears
 * here too.
 */
export const Dashboard = () => {
    const [issuesResult] = OpenIssues.use();
    const [pullRequestsResult] = OpenPullRequests.use();
    const [alertsResult] = ActiveAlerts.use();
    const [workResult] = ActiveWork.use();
    const [failedBuildsResult] = FailedBuilds.use();

    const issues = issuesResult.data ?? [];
    const pullRequests = pullRequestsResult.data ?? [];
    const alerts = alertsResult.data ?? [];
    const work = workResult.data ?? [];
    const failedBuilds = failedBuildsResult.data ?? [];

    const forReview = useMemo(() => issues.filter((issue) => issue.status === IssueStatus.forReview), [issues]);
    const readyForDevelopment = useMemo(() => issues.filter((issue) => issue.status === IssueStatus.readyForDevelopment), [issues]);
    const needsAttention = useMemo(() => alerts.filter((alert) => alert.status === AlertStatus.needsAttention), [alerts]);
    const running = useMemo(() => work.filter((item) => item.status === WorkStatus.running), [work]);

    const cards: Card[] = [
        { key: 'for-review', count: forReview.length, label: 'For review', to: '/issues', severity: forReview.length > 0 ? 'success' : 'secondary' },
        { key: 'needs-attention', count: needsAttention.length, label: 'Alerts needing attention', to: '/alerts', severity: needsAttention.length > 0 ? 'danger' : 'secondary' },
        { key: 'failed-builds', count: failedBuilds.length, label: 'Failed builds', to: '/failed-builds', severity: failedBuilds.length > 0 ? 'danger' : 'secondary' },
        { key: 'running', count: running.length, label: 'Agent running now', to: '/work', severity: running.length > 0 ? 'warning' : 'secondary' },
        { key: 'ready', count: readyForDevelopment.length, label: 'Ready for development', to: '/issues', severity: 'info' },
        { key: 'open-prs', count: pullRequests.length, label: 'Open pull requests', to: '/pull-requests', severity: 'info' },
        { key: 'open-issues', count: issues.length, label: 'Open issues', to: '/issues', severity: 'secondary' },
    ];

    return (
        <Page title='Dashboard'>
            <div className='flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4'>
                <div className='grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6'>
                    {cards.map((card) => (
                        <Link
                            key={card.key}
                            to={card.to}
                            className={`flex flex-col gap-1 rounded border border-l-4 border-[var(--surface-border)] bg-[var(--surface-card)] p-4 no-underline transition-colors hover:bg-[var(--surface-hover)] ${severityBorderClass[card.severity]}`}>
                            <span className='text-3xl font-semibold text-[var(--text-color)]'>{card.count}</span>
                            <span className='text-sm text-[var(--text-color-secondary)]'>{card.label}</span>
                        </Link>
                    ))}
                </div>

                <section className='flex flex-col gap-2'>
                    <h3 className='m-0 text-base font-semibold'>What needs you</h3>
                    {forReview.length === 0 && needsAttention.length === 0 &&
                        <p className='m-0 text-sm text-[var(--text-color-secondary)]'>Nothing is waiting on you right now.</p>}
                    <ul className='m-0 flex list-none flex-col gap-1 p-0'>
                        {forReview.map((issue) => (
                            <li key={issue.id}>
                                <Link to='/issues' className='flex items-center gap-2 no-underline'>
                                    <Tag value={statusLabel(issue.status)} severity='success' />
                                    <span className='text-[var(--text-color)]'>{issue.owner}/{issue.repository}#{issue.number} {issue.title}</span>
                                </Link>
                            </li>
                        ))}
                        {needsAttention.map((alert) => (
                            <li key={alert.id}>
                                <Link to='/alerts' className='flex items-center gap-2 no-underline'>
                                    <Tag value={alertStatusLabel(alert.status)} severity={alertStatusSeverity(alert.status)} />
                                    <span className='text-[var(--text-color)]'>{alert.title}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>

                <section className='flex flex-col gap-2'>
                    <h3 className='m-0 text-base font-semibold'>What the agent is doing</h3>
                    {running.length === 0 &&
                        <p className='m-0 text-sm text-[var(--text-color-secondary)]'>No agent is running right now.</p>}
                    <ul className='m-0 flex list-none flex-col gap-1 p-0'>
                        {running.map((item) => (
                            <li key={item.id.toString()}>
                                <Link to='/work' className='flex items-center gap-2 no-underline'>
                                    <Tag value={workPurposeLabel(item.purpose)} />
                                    <Tag value={workStatusLabel(item.status)} severity={workStatusSeverity(item.status)} />
                                    <span className='text-[var(--text-color)]'>{item.prompt || item.issues?.join(', ') || item.alert || 'Work'}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </Page>
    );
};
