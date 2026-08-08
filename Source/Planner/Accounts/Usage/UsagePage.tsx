// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useEffect } from 'react';
import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import { AccountUsage, AllAccountUsage } from './Usage';
import { ClaudePlan } from '../ClaudePlan';

const planLabel = (plan: ClaudePlan) => {
    switch (plan) {
        case ClaudePlan.max5x: return 'Max 5x';
        case ClaudePlan.max20x: return 'Max 20x';
        default: return 'Pro';
    }
};

const WindowBar = ({ label, used, limit, resetsAt }: { label: string; used: number; limit: number; resetsAt?: Date }) => {
    const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    return (
        <div className='flex flex-col gap-1'>
            <div className='flex justify-between text-sm'>
                <span>{label}</span>
                <span className='text-[var(--text-color-secondary)]'>
                    {used} of {limit} sessions · {Math.max(0, limit - used)} left
                    {resetsAt ? ` · window resets ${new Date(resetsAt).toLocaleTimeString()}` : ''}
                </span>
            </div>
            <ProgressBar value={percentage} showValue={false} style={{ height: '0.5rem' }} />
        </div>
    );
};

/**
 * The usage page - what each Claude account has consumed and what is left of its five-hour and
 * weekly windows, as the scheduler sees it.
 */
export const Usage = () => {
    const [usageResult, refresh] = AllAccountUsage.use();

    useEffect(() => {
        const interval = setInterval(() => refresh(), 30_000);
        return () => clearInterval(interval);
    }, [refresh]);

    const accounts: AccountUsage[] = usageResult.data ?? [];

    return (
        <div className='flex h-full flex-col gap-4 overflow-auto p-4'>
            <div className='flex items-center gap-2'>
                <h1 className='m-0 flex-1 text-lg font-semibold'>Account Usage</h1>
                <Button icon='pi pi-refresh' rounded text tooltip='Refresh' onClick={() => refresh()} />
            </div>

            {accounts.length === 0 &&
                <div className='text-[var(--text-color-secondary)]'>No Claude accounts registered</div>}

            <div className='grid grid-cols-1 gap-4 xl:grid-cols-2'>
                {accounts.map((account) => (
                    <div key={account.id.toString()} className='flex flex-col gap-3 rounded border border-[var(--surface-border)] bg-[var(--surface-card)] p-4'>
                        <div className='flex items-center gap-2'>
                            <span className='text-base font-semibold'>{account.name}</span>
                            <Tag value={planLabel(account.plan)} />
                        </div>
                        <WindowBar
                            label='Five-hour window'
                            used={account.sessionsLastFiveHours}
                            limit={account.sessionsPerFiveHours}
                            resetsAt={account.fiveHourWindowResetsAt} />
                        <WindowBar
                            label='Weekly window'
                            used={account.sessionsLastWeek}
                            limit={account.sessionsPerWeek} />
                        <div className='grid grid-cols-2 gap-x-4 gap-y-1 text-sm'>
                            <span className='text-[var(--text-color-secondary)]'>Tokens last week</span>
                            <span>{account.tokensUsedLastWeek.toLocaleString()}</span>
                            <span className='text-[var(--text-color-secondary)]'>Tokens total</span>
                            <span>{account.tokensUsedTotal.toLocaleString()}</span>
                            <span className='text-[var(--text-color-secondary)]'>Reported cost last week</span>
                            <span>${account.costLastWeek.toFixed(2)}</span>
                            <span className='text-[var(--text-color-secondary)]'>Reported cost total</span>
                            <span>${account.costTotal.toFixed(2)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
