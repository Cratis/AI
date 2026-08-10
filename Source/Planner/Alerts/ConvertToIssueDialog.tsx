// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useMemo } from 'react';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { DropdownField, InputTextField, TextAreaField } from '@cratis/components/CommandForm/fields';
import { Alert } from './Listing/Listing';
import { ConvertAlertToIssue } from './ConvertingToIssue/ConvertingToIssue';
import { AllRepositories } from '../Repositories/Listing/Listing';
import { Current as GetOperationsSettings } from '../Operations/OperationsSettings';
import { alertSeverityLabel } from './AlertDetails';

interface ConvertToIssueDialogProps {
    /** The alert being turned into an issue. */
    alert: Alert;

    /** Called when the dialog closes, whichever way. */
    onClose: () => void;
}

/**
 * Composes the issue body from everything already known about the alert - what was reported, what the
 * agent found, and what people have added since. It is the dialog's starting point rather than its
 * final word: the field stays editable so whoever files the issue adds whatever else it needs.
 */
const bodyFor = (alert: Alert) => {
    const sections = [
        `Raised by **${alert.source}**, seen ${alert.occurrences}×` +
        (alert.lastObservedAt ? `, most recently ${new Date(alert.lastObservedAt).toLocaleString()}.` : '.'),
        `Severity: ${alertSeverityLabel(alert.severity)}`,
        '## Reported',
        alert.summary,
    ];

    if (alert.findings) {
        sections.push('## What the agent found', alert.findings);
    }

    const notes = alert.notes ?? [];
    if (notes.length > 0) {
        sections.push('## Notes', notes.map((note) => `- ${note.text}${note.addedBy ? ` (${note.addedBy})` : ''}`).join('\n'));
    }

    sections.push(`_Filed from the Cratis Planner alert \`${alert.id}\`._`);
    return sections.join('\n\n');
};

/**
 * Turns an alert into a GitHub issue in one of the tracked repositories, defaulting to the one the
 * deployment nominates for operational issues.
 */
export const ConvertToIssueDialog = ({ alert, onClose }: ConvertToIssueDialogProps) => {
    const [repositoriesResult] = AllRepositories.use();
    const [operationsResult] = GetOperationsSettings.use();

    const repositoryOptions = useMemo(() =>
        (repositoriesResult.data ?? []).map((repository) => ({
            label: `${repository.owner}/${repository.name}`,
            value: repository.id,
        })),
        [repositoriesResult.data]);

    const defaultRepository = operationsResult.data?.defaultIssueRepository ?? '';

    return (
        <CommandDialog<ConvertAlertToIssue>
            command={ConvertAlertToIssue}
            visible
            title='Create issue from alert'
            width='44rem'
            okLabel='Create'
            cancelLabel='Cancel'
            initialValues={{
                alert: alert.id,
                repository: defaultRepository,
                title: alert.title,
                body: bodyFor(alert),
            }}
            onConfirm={onClose}
            onCancel={onClose}>
            <DropdownField<ConvertAlertToIssue>
                value={(instance) => instance.repository}
                title='Repository'
                options={repositoryOptions}
                optionValue='value'
                optionLabel='label'
                placeholder='Pick a tracked repository' />
            <InputTextField<ConvertAlertToIssue> value={(instance) => instance.title} title='Title' />
            <TextAreaField<ConvertAlertToIssue> value={(instance) => instance.body} title='Description' rows={16} />
        </CommandDialog>
    );
};
