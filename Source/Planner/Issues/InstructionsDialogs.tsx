// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { CommandDialog } from '@cratis/components/CommandDialog';
import { MarkdownEditorField } from '../Common/MarkdownEditorField';
import { Issue } from './Listing/Listing';
import { Group } from './Grouping/Listing/Listing';
import { SetIssuePrompt } from './SettingPrompt/SettingPrompt';
import { SetGroupPrompt } from './Grouping/SettingPrompt/SettingPrompt';

/**
 * Props for the {@link IssueInstructionsDialog} component.
 */
export interface IssueInstructionsDialogProps {
    /**
     * The issue to edit instructions for.
     */
    issue: Issue;

    /**
     * Called when the dialog closes.
     */
    onClose: () => void;
}

export const IssueInstructionsDialog = ({ issue, onClose }: IssueInstructionsDialogProps) => (
    <CommandDialog<SetIssuePrompt>
        command={SetIssuePrompt}
        visible
        title={`Instructions for ${issue.owner}/${issue.repository}#${issue.number}`}
        width='36rem'
        okLabel='Save'
        cancelLabel='Cancel'
        initialValues={{ issue: issue.id, prompt: issue.prompt ?? '' }}
        onConfirm={onClose}
        onCancel={onClose}>
        <MarkdownEditorField<SetIssuePrompt>
            value={(instance) => instance.prompt}
            title='Instructions'
            placeholder='Extra instructions sent along when an agent works on this issue' />
    </CommandDialog>
);

/**
 * Props for the {@link GroupInstructionsDialog} component.
 */
export interface GroupInstructionsDialogProps {
    /**
     * The group to edit instructions for.
     */
    group: Group;

    /**
     * Called when the dialog closes.
     */
    onClose: () => void;
}

export const GroupInstructionsDialog = ({ group, onClose }: GroupInstructionsDialogProps) => (
    <CommandDialog<SetGroupPrompt>
        command={SetGroupPrompt}
        visible
        title={`Instructions for ${group.name}`}
        width='36rem'
        okLabel='Save'
        cancelLabel='Cancel'
        initialValues={{ group: group.id, prompt: group.prompt ?? '' }}
        onConfirm={onClose}
        onCancel={onClose}>
        <MarkdownEditorField<SetGroupPrompt>
            value={(instance) => instance.prompt}
            title='Instructions'
            placeholder='Extra instructions sent along when an agent works on this group' />
    </CommandDialog>
);
