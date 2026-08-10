// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Tag } from 'primereact/tag';
import { Alert } from './Listing/Listing';
import { AlertSeverity } from './AlertSeverity';
import { AlertStatus } from './AlertStatus';

/** How an alert's status reads on screen. */
export const alertStatusLabel = (status: AlertStatus) => {
    switch (status) {
        case AlertStatus.received: return 'Received';
        case AlertStatus.investigating: return 'Investigating';
        case AlertStatus.needsAttention: return 'Needs attention';
        case AlertStatus.investigationFailed: return 'Investigation failed';
        case AlertStatus.resolved: return 'Resolved';
        default: return 'Unknown';
    }
};

/**
 * The color an alert's status carries. Needing a person is the state the board exists to surface, so
 * it reads as loudly as the failure states rather than as neutral information.
 */
export const alertStatusSeverity = (status: AlertStatus) => {
    switch (status) {
        case AlertStatus.resolved: return 'success' as const;
        case AlertStatus.needsAttention: return 'danger' as const;
        case AlertStatus.investigationFailed: return 'warning' as const;
        case AlertStatus.investigating: return 'info' as const;
        default: return 'secondary' as const;
    }
};

/** How an alert's severity reads on screen. */
export const alertSeverityLabel = (severity: AlertSeverity) => {
    switch (severity) {
        case AlertSeverity.critical: return 'Critical';
        case AlertSeverity.warning: return 'Warning';
        default: return 'Information';
    }
};

/** The color an alert's severity carries. */
export const alertSeveritySeverity = (severity: AlertSeverity) => {
    switch (severity) {
        case AlertSeverity.critical: return 'danger' as const;
        case AlertSeverity.warning: return 'warning' as const;
        default: return 'info' as const;
    }
};

interface AlertDetailsProps {
    /** The alert to show. */
    item: Alert;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className='flex flex-col gap-1'>
        <h3 className='m-0 text-sm font-semibold'>{title}</h3>
        {children}
    </section>
);

/**
 * Everything known about one alert - what the sending system said, what an agent made of it, and
 * what people have added since.
 */
export const AlertDetails = ({ item }: AlertDetailsProps) => {
    const notes = item.notes ?? [];

    return (
        <div className='flex h-full flex-col gap-4 overflow-auto p-4'>
            <div className='flex flex-wrap items-center gap-2'>
                <Tag value={alertSeverityLabel(item.severity)} severity={alertSeveritySeverity(item.severity)} />
                <Tag value={alertStatusLabel(item.status)} severity={alertStatusSeverity(item.status)} />
                <span className='text-sm text-[var(--text-color-secondary)]'>
                    {item.source} · seen {item.occurrences}×
                    {item.lastObservedAt ? ` · last ${new Date(item.lastObservedAt).toLocaleString()}` : ''}
                </span>
            </div>

            <h2 className='m-0 text-base font-semibold'>{item.title}</h2>

            <Section title='Reported'>
                <pre className='m-0 whitespace-pre-wrap text-sm text-[var(--text-color-secondary)]'>{item.summary}</pre>
            </Section>

            {item.findings &&
                <Section title='What the agent found'>
                    <pre className='m-0 whitespace-pre-wrap text-sm text-[var(--text-color-secondary)]'>{item.findings}</pre>
                </Section>}

            {item.resolution &&
                <Section title='Resolution'>
                    <pre className='m-0 whitespace-pre-wrap text-sm text-[var(--text-color-secondary)]'>{item.resolution}</pre>
                    {item.resolvedBy && <span className='text-xs text-[var(--text-color-secondary)]'>Resolved by {item.resolvedBy}</span>}
                </Section>}

            {item.issue &&
                <Section title='Issue'>
                    <a href={item.issueUrl} target='_blank' rel='noreferrer'>
                        {item.issueOwner}/{item.issueRepository}#{item.issue}
                    </a>
                </Section>}

            {notes.length > 0 &&
                <Section title='Notes'>
                    {notes.map((note) => (
                        <div key={note.id.toString()} className='flex flex-col border-l-2 border-[var(--surface-border)] pl-2'>
                            <span className='whitespace-pre-wrap text-sm'>{note.text}</span>
                            <span className='text-xs text-[var(--text-color-secondary)]'>{note.addedBy || 'automation'}</span>
                        </div>
                    ))}
                </Section>}

            <Section title='Fingerprint'>
                <code className='text-xs text-[var(--text-color-secondary)]'>{item.fingerprint}</code>
            </Section>
        </div>
    );
};
