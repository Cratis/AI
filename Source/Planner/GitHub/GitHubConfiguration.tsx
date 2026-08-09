// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useState } from 'react';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Page } from '@cratis/components/Common';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { InputTextField } from '@cratis/components/CommandForm/fields';
import { Current as GetGitHubAppStatus } from './App/GitHubAppStatus';
import { AllGitHubAppInstallations } from './App/Installations/Listing';
import { CurrentGitIdentity } from './GitIdentity/Listing/Listing';
import { SetGitIdentity } from './GitIdentity/Setting/Setting';

/**
 * The GitHub settings page - connecting the GitHub App the Planner authenticates as, the accounts
 * it has been installed on, and the git identity worker containers commit as.
 */
export const GitHubConfiguration = () => {
    const [statusResult] = GetGitHubAppStatus.use();
    const [installationsResult] = AllGitHubAppInstallations.use();
    const [identityResult] = CurrentGitIdentity.use();
    const [editIdentityVisible, setEditIdentityVisible] = useState(false);

    const status = statusResult.data;
    const installations = installationsResult.data ?? [];
    const identity = identityResult.data?.[0];

    return (
        <Page title='GitHub'>
            <div className='flex min-h-0 flex-1 flex-col gap-6 overflow-auto px-4 py-2'>
                <section className='flex flex-col items-start gap-3'>
                    <h2 className='m-0 text-base font-semibold'>GitHub App</h2>

                    {!status?.isConfigured &&
                        <>
                            <p className='m-0 text-sm text-[var(--text-color-secondary)]'>
                                Connect a GitHub App so worker containers commit and interact with GitHub as the
                                App&apos;s own identity, rather than a shared personal access token.
                            </p>
                            <Button label='Connect GitHub App' icon='pi pi-github' onClick={() => window.location.assign('/github-app/start')} />
                        </>}

                    {status?.isConfigured &&
                        <>
                            <div className='flex items-center gap-2'>
                                <Tag value='Configured' severity='success' />
                                <span className='font-medium'>{status.name || status.slug}</span>
                            </div>
                            <Button
                                label='Install on an organization'
                                icon='pi pi-plus'
                                outlined
                                onClick={() => window.open(`https://github.com/apps/${status.slug}/installations/new`, '_blank')} />
                        </>}

                    <div className='flex flex-col gap-1'>
                        <div className='text-sm font-medium'>Installations</div>
                        {installations.length === 0 &&
                            <div className='text-sm text-[var(--text-color-secondary)]'>Not installed on any account yet</div>}
                        {installations.map((installation) => (
                            <div key={installation.id} className='flex items-center gap-2 text-sm'>
                                <i className='pi pi-building' />
                                <span>{installation.account}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className='flex flex-col items-start gap-3'>
                    <h2 className='m-0 text-base font-semibold'>Git identity</h2>
                    <p className='m-0 text-sm text-[var(--text-color-secondary)]'>
                        The <code>git config user.name</code> / <code>user.email</code> worker containers commit as.
                    </p>
                    <div className='flex items-center gap-2'>
                        {identity
                            ? <span>{identity.name} &lt;{identity.email}&gt;</span>
                            : <span className='text-sm text-[var(--text-color-secondary)]'>Not set</span>}
                        <Button
                            label={identity ? 'Change' : 'Set'}
                            icon='pi pi-pencil'
                            outlined
                            size='small'
                            onClick={() => setEditIdentityVisible(true)} />
                    </div>
                </section>
            </div>

            {editIdentityVisible &&
                <CommandDialog<SetGitIdentity>
                    command={SetGitIdentity}
                    visible
                    title='Set git identity'
                    width='30rem'
                    okLabel='Save'
                    cancelLabel='Cancel'
                    initialValues={{ name: identity?.name ?? '', email: identity?.email ?? '' }}
                    onConfirm={() => setEditIdentityVisible(false)}
                    onCancel={() => setEditIdentityVisible(false)}>
                    <InputTextField<SetGitIdentity> value={(instance) => instance.name} title='Name' placeholder='e.g. Cratis Planner' />
                    <InputTextField<SetGitIdentity> value={(instance) => instance.email} title='Email' placeholder='e.g. planner@example.com' />
                </CommandDialog>}
        </Page>
    );
};
