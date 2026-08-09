// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useState } from 'react';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { DataPage, MenuItem } from '@cratis/components/DataPage';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { DropdownField, InputTextField } from '@cratis/components/CommandForm/fields';
import { AllAccounts, ClaudeAccount } from './Listing/Listing';
import { ClaudePlan } from './ClaudePlan';
import { RegisterAccount } from './Registering/Registering';
import { SetAccountToken } from './SettingToken/SettingToken';
import { ChangeAccountPlan } from './ChangingPlan/ChangingPlan';
import { RemoveAccount } from './Removing/Removing';

const planOptions = [
    { label: 'Pro', value: ClaudePlan.pro },
    { label: 'Max 5x', value: ClaudePlan.max5x },
    { label: 'Max 20x', value: ClaudePlan.max20x },
];

const planLabel = (plan: ClaudePlan) => planOptions.find((option) => option.value === plan)?.label ?? 'Pro';

/**
 * The Claude accounts settings page - the accounts the Planner schedules work on, each with a
 * name, subscription plan, owning user and the Claude CLI token workers authenticate with.
 */
export const ClaudeAccounts = () => {
    const [selected, setSelected] = useState<ClaudeAccount | undefined>(undefined);
    const [registerVisible, setRegisterVisible] = useState(false);
    const [tokenFor, setTokenFor] = useState<ClaudeAccount | undefined>(undefined);
    const [planFor, setPlanFor] = useState<ClaudeAccount | undefined>(undefined);

    const removeAccount = async (account: ClaudeAccount) => {
        const command = new RemoveAccount();
        command.account = account.id;
        await command.execute();
    };

    return (
        <>
            <DataPage
                title='Claude Accounts'
                query={AllAccounts}
                emptyMessage='No accounts registered'
                dataKey='id'
                selection={selected}
                onSelectionChange={(event) => setSelected(event.value as ClaudeAccount)}>
                <DataPage.MenuItems>
                    <MenuItem label='Register' icon={() => <i className='pi pi-plus' />} disableOnUnselected={false} command={() => setRegisterVisible(true)} />
                    <MenuItem label='Set token' icon={() => <i className='pi pi-key' />} disableOnUnselected command={() => selected && setTokenFor(selected)} />
                    <MenuItem label='Change plan' icon={() => <i className='pi pi-sliders-h' />} disableOnUnselected command={() => selected && setPlanFor(selected)} />
                    <MenuItem label='Remove' icon={() => <i className='pi pi-trash' />} disableOnUnselected command={() => selected && removeAccount(selected)} />
                </DataPage.MenuItems>
                <DataPage.Columns>
                    <Column field='name' header='Name' />
                    <Column header='Plan' body={(account: ClaudeAccount) => planLabel(account.plan)} style={{ width: '9rem' }} />
                    <Column field='registeredBy' header='Registered by' style={{ width: '12rem' }} />
                    <Column
                        header='Token'
                        body={(account: ClaudeAccount) => account.hasToken
                            ? <Tag value='Configured' severity='success' />
                            : <Tag value='Missing' severity='danger' />}
                        style={{ width: '9rem' }} />
                </DataPage.Columns>
            </DataPage>

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
        </>
    );
};
