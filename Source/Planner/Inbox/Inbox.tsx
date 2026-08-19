// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useMemo, useState } from 'react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { Tag } from 'primereact/tag';
import { Page } from '@cratis/components/Common';
import { useIdentity } from '@cratis/arc.react/identity';
import { OpenIssues, Issue, IssueComment } from '../Issues/Listing/Listing';
import { PlannerUserDetails } from '../Identity/PlannerIdentityDetailsProvider';
import { ReplyToIssue } from '../Issues/Comments/Replying/Replying';

interface InboxItem {
    key: string;
    issue: Issue;
    reason: string;
    when: Date;
}

const mentionsLogin = (text: string | undefined, login: string) =>
    !!text && new RegExp(`@${login}\\b`, 'i').test(text);

/**
 * The inbox - everything across tracked repositories that needs the signed-in user: mentions in an
 * issue body or its comments, and issues assigned to them. Empties itself as items resolve, since
 * it is built on OpenIssues - a closed issue simply stops appearing.
 */
export const Inbox = () => {
    const identity = useIdentity(PlannerUserDetails, { login: '' });
    const login = identity.details.login;
    const [issuesResult] = OpenIssues.use();
    const [replyFor, setReplyFor] = useState<Issue | undefined>(undefined);
    const [replyText, setReplyText] = useState('');

    const items = useMemo(() => {
        if (!login) return [];

        const result: InboxItem[] = [];
        for (const issue of issuesResult.data ?? []) {
            if ((issue.assignees ?? []).some((assignee) => assignee.toLowerCase() === login.toLowerCase())) {
                result.push({ key: `${issue.id}-assigned`, issue, reason: 'Assigned to you', when: new Date(issue.createdAt) });
            }

            if (mentionsLogin(issue.body, login)) {
                result.push({ key: `${issue.id}-mention-body`, issue, reason: 'Mentioned you', when: new Date(issue.createdAt) });
            }

            for (const comment of (issue.comments ?? []) as IssueComment[]) {
                if (mentionsLogin(comment.body, login)) {
                    result.push({ key: `${issue.id}-mention-${comment.id}`, issue, reason: `Mentioned you in a comment by ${comment.author}`, when: new Date(comment.commentedAt) });
                }
            }
        }

        return result.sort((left, right) => right.when.getTime() - left.when.getTime());
    }, [issuesResult.data, login]);

    const sendReply = async () => {
        if (!replyFor || !replyText.trim()) return;
        const command = new ReplyToIssue();
        command.issue = replyFor.id;
        command.text = replyText;
        await command.execute();
        setReplyText('');
        setReplyFor(undefined);
    };

    return (
        <Page title='Inbox'>
            <div className='flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4'>
                {!login &&
                    <p className='text-sm text-[var(--text-color-secondary)]'>Sign in to see what needs you.</p>}
                {login && items.length === 0 &&
                    <p className='text-sm text-[var(--text-color-secondary)]'>Nothing needs you right now.</p>}
                {items.map((item) => (
                    <div key={item.key} className='flex flex-col gap-2 rounded border border-[var(--surface-border)] p-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <Tag value={item.reason} severity='info' />
                            <span className='font-medium'>{item.issue.owner}/{item.issue.repository}#{item.issue.number} {item.issue.title}</span>
                        </div>
                        <div className='max-h-40 overflow-auto text-sm' data-color-mode='dark'>
                            <MarkdownPreview source={item.issue.body || '_No description_'} style={{ background: 'transparent' }} />
                        </div>
                        <div className='flex gap-2'>
                            <Button
                                label='Open on GitHub'
                                icon='pi pi-external-link'
                                outlined
                                size='small'
                                onClick={() => window.open(`https://github.com/${item.issue.owner}/${item.issue.repository}/issues/${item.issue.number}`, '_blank')} />
                            <Button label='Reply' icon='pi pi-reply' size='small' onClick={() => setReplyFor(item.issue)} />
                        </div>
                        {replyFor?.id === item.issue.id &&
                            <div className='flex flex-col gap-2'>
                                <InputTextarea
                                    value={replyText}
                                    onChange={(event) => setReplyText(event.target.value)}
                                    rows={4}
                                    placeholder='Your reply' />
                                <div className='flex gap-2'>
                                    <Button label='Send' icon='pi pi-send' size='small' onClick={sendReply} />
                                    <Button label='Cancel' text size='small' onClick={() => setReplyFor(undefined)} />
                                </div>
                            </div>}
                    </div>
                ))}
            </div>
        </Page>
    );
};
