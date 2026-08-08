// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useState } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Tag } from 'primereact/tag';
import { AllAccounts, ClaudeAccount } from './Listing/Listing';
import { ClaudePlan } from './ClaudePlan';
import { RegisterAccount } from './Registering/Registering';
import { SetAccountToken } from './SettingToken/SettingToken';
import { ChangeAccountPlan } from './ChangingPlan/ChangingPlan';
import { RemoveAccount } from './Removing/Removing';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { DropdownField, InputTextField } from '@cratis/components/CommandForm/fields';

const planOptions = [
    { label: 'Pro', value: ClaudePlan.pro },
    { label: 'Max 5x', value: ClaudePlan.max5x },
    { label: 'Max 20x', value: ClaudePlan.max20x },
];

const planLabel = (plan: ClaudePlan) => planOptions.find((option) => option.value === plan)?.label ?? 'Pro';

/**
 * The Claude accounts settings page - the accounts the Planner schedules work on, each with a
 * name, subscription plan and the Claude CLI token workers authenticate with.
 */
export const ClaudeAccounts = () => {
    const [accountsResult] = AllAccounts.use();
    const [registerVisible, setRegisterVisible] = useState(false);
    const [tokenFor, setTokenFor] = useState<ClaudeAccount | undefined>(undefined);
    const [planFor, setPlanFor] = useState<ClaudeAccount | undefined>(undefined);

    const removeAccount = async (account: ClaudeAccount) => {
        const command = new RemoveAccount();
        command.account = account.id;
        await command.execute();
    };

    return (
        <div className='flex h-full flex-col gap-4 overflow-auto p-4'>
            <div className='flex items-center gap-2'>
                <h1 className='m-0 flex-1 text-lg font-semibold'>Claude Accounts</h1>
                <Button label='Register account' icon='pi pi-plus' outlined onClick={() => setRegisterVisible(true)} />
            </div>

            <DataTable value={accountsResult.data ?? []} dataKey='id' size='small' emptyMessage='No accounts registered'>
                <Column field='name' header='Name' />
                <Column header='Plan' body={(account: ClaudeAccount) => planLabel(account.plan)} style={{ width: '9rem' }} />
                <Column
                    header='Token'
                    body={(account: ClaudeAccount) => account.hasToken
                        ? <Tag value='Configured' severity='success' />
                        : <Tag value='Missing' severity='danger' />}
                    style={{ width: '9rem' }} />
                <Column
                    style={{ width: '12rem' }}
                    body={(account: ClaudeAccount) => (
                        <div className='flex gap-1'>
                            <Button icon='pi pi-key' rounded text tooltip='Set token' onClick={() => setTokenFor(account)} />
                            <Button icon='pi pi-sliders-h' rounded text tooltip='Change plan' onClick={() => setPlanFor(account)} />
                            <Button icon='pi pi-trash' rounded text severity='danger' tooltip='Remove' onClick={() => removeAccount(account)} />
                        </div>
                    )} />
            </DataTable>

            {registerVisible &&
                <CommandDialog<RegisterAccount>
                    command={RegisterAccount}
                    visible
                    title='Register Claude account'
                    width='32rem'
                    okLabel='Register'
                    cancelLabel='Cancel'
                    initialValues={{ plan: ClaudePlan.pro }}
                    onConfirm={() => setRegisterVisible(false)}
                    onCancel={() => setRegisterVisible(false)}>
                    <InputTextField<RegisterAccount> value={(instance) => instance.name} title='Name' placeholder='A recognizable name for the account' />
                    <DropdownField<RegisterAccount> value={(instance) => instance.plan} title='Plan' options={planOptions} optionValue='value' optionLabel='label' />
                    <InputTextField<RegisterAccount> value={(instance) => instance.token} title='Token' placeholder='Long-lived token from `claude setup-token` (optional)' />
                </CommandDialog>}

            {tokenFor &&
                <CommandDialog<SetAccountToken>
                    command={SetAccountToken}
                    visible
                    title={`Set token for ${tokenFor.name}`}
                    width='32rem'
                    okLabel='Set'
                    cancelLabel='Cancel'
                    initialValues={{ account: tokenFor.id }}
                    onConfirm={() => setTokenFor(undefined)}
                    onCancel={() => setTokenFor(undefined)}>
                    <InputTextField<SetAccountToken> value={(instance) => instance.token} title='Token' placeholder='Long-lived token from `claude setup-token`' />
                </CommandDialog>}

            {planFor &&
                <CommandDialog<ChangeAccountPlan>
                    command={ChangeAccountPlan}
                    visible
                    title={`Change plan for ${planFor.name}`}
                    width='30rem'
                    okLabel='Change'
                    cancelLabel='Cancel'
                    initialValues={{ account: planFor.id, plan: planFor.plan }}
                    onConfirm={() => setPlanFor(undefined)}
                    onCancel={() => setPlanFor(undefined)}>
                    <DropdownField<ChangeAccountPlan> value={(instance) => instance.plan} title='Plan' options={planOptions} optionValue='value' optionLabel='label' />
                </CommandDialog>}
        </div>
    );
};
