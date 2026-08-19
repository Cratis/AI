// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useMemo, useState } from 'react';
import { MultiSelect } from 'primereact/multiselect';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { CheckboxField, DropdownField, MultiSelectField } from '@cratis/components/CommandForm/fields';
import { MarkdownEditorField } from '../Common/MarkdownEditorField';
import { ScheduleAdHocWork } from './SchedulingAdHoc/SchedulingAdHoc';
import { AllRepositories } from '../Repositories/Listing/Listing';
import { AllOrganizations } from '../Repositories/Organizations/Listing/Listing';
import { AllRepositoryGroups } from '../Repositories/Groups/Listing/Listing';

/**
 * Props for the {@link AdHocWorkDialog} component.
 */
export interface AdHocWorkDialogProps {
    /**
     * Called when the dialog closes.
     */
    onClose: () => void;
}

const modelOptions = [
    { label: 'Automatic', value: '' },
    { label: 'Opus', value: 'opus' },
    { label: 'Sonnet', value: 'sonnet' },
    { label: 'Haiku', value: 'haiku' },
];

export const AdHocWorkDialog = ({ onClose }: AdHocWorkDialogProps) => {
    const [repositoriesResult] = AllRepositories.use();
    const [organizationsResult] = AllOrganizations.use();
    const [groupsResult] = AllRepositoryGroups.use();
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

    const repositoryOptions = useMemo(() =>
        (repositoriesResult.data ?? []).map((repository) => ({
            label: `${repository.owner}/${repository.name}`,
            value: repository.id,
        })),
        [repositoriesResult.data]);

    const organizationOptions = useMemo(() =>
        [{ label: 'None - use the selection below', value: '' },
         ...(organizationsResult.data ?? []).map((organization) => ({
            label: `Entire ${organization.name} organization`,
            value: organization.name as string,
         }))],
        [organizationsResult.data]);

    const groupOptions = useMemo(() =>
        (groupsResult.data ?? []).map((group) => ({ label: group.name as string, value: group.id.toString() })),
        [groupsResult.data]);

    // Selected repository groups expand to their member repositories just before execution.
    const expandGroups = (command: ScheduleAdHocWork) => {
        const members = (groupsResult.data ?? [])
            .filter((group) => selectedGroups.includes(group.id.toString()))
            .flatMap((group) => group.repositories);
        command.repositories = [...new Set([...(command.repositories ?? []), ...members])];
        return command;
    };

    return (
        <CommandDialog<ScheduleAdHocWork>
            command={ScheduleAdHocWork}
            visible
            title='Ad-hoc work'
            width='40rem'
            okLabel='Schedule'
            cancelLabel='Cancel'
            initialValues={{ repositories: [], organization: '', allRepositories: false, model: '' }}
            onBeforeExecute={expandGroups}
            onConfirm={onClose}
            onCancel={onClose}>
            <MarkdownEditorField<ScheduleAdHocWork>
                value={(instance) => instance.prompt}
                title='What should the agent do?'
                placeholder='The instructions for the agent'
                rows={10} />
            <CheckboxField<ScheduleAdHocWork>
                value={(instance) => instance.allRepositories}
                label='All repositories the Planner tracks' />
            <MultiSelectField<ScheduleAdHocWork>
                value={(instance) => instance.repositories}
                title='Repositories (ignored when "All repositories" is checked)'
                options={repositoryOptions}
                optionValue='value'
                optionLabel='label' />
            <div className='flex flex-col gap-1'>
                <label className='font-medium' htmlFor='adhoc-groups'>Repository groups</label>
                <MultiSelect
                    id='adhoc-groups'
                    value={selectedGroups}
                    options={groupOptions}
                    optionValue='value'
                    optionLabel='label'
                    placeholder='Include the repositories of these groups'
                    onChange={(e) => setSelectedGroups(e.value as string[])} />
            </div>
            <DropdownField<ScheduleAdHocWork>
                value={(instance) => instance.organization}
                title='Organization (ignored when "All repositories" is checked)'
                options={organizationOptions}
                optionValue='value'
                optionLabel='label' />
            <DropdownField<ScheduleAdHocWork>
                value={(instance) => instance.model}
                title='Model'
                options={modelOptions}
                optionValue='value'
                optionLabel='label' />
        </CommandDialog>
    );
};
