// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useState } from 'react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Page } from '@cratis/components/Common';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { MarkdownEditorField } from '../Common/MarkdownEditorField';
import { Current as GetVision } from './Listing/Listing';
import { AllPlans, Plan } from './Listing/PlanListing';
import { SetVision } from './SettingVision/SettingVision';
import { PlanStatus } from './PlanStatus';

const planStatusLabel = (status: PlanStatus) => {
    switch (status) {
        case PlanStatus.ready: return 'Ready';
        case PlanStatus.failed: return 'Failed';
        default: return 'Generating\u2026';
    }
};

const planStatusSeverity = (status: PlanStatus) => {
    switch (status) {
        case PlanStatus.ready: return 'success';
        case PlanStatus.failed: return 'danger';
        default: return 'info';
    }
};

/**
 * The Roadmap page - the vision (a markdown document maintained by hand, versioned through events)
 * and the plans generated from selected issues.
 */
export const Roadmap = () => {
    const [visionResult] = GetVision.use();
    const [plansResult] = AllPlans.use();
    const [editVisionVisible, setEditVisionVisible] = useState(false);
    const [expandedPlan, setExpandedPlan] = useState<string | undefined>(undefined);

    const vision = visionResult.data;
    const plans = [...(plansResult.data ?? [])].sort(
        (left, right) => new Date(right.requestedAt ?? 0).getTime() - new Date(left.requestedAt ?? 0).getTime());

    return (
        <Page title='Roadmap'>
            <div className='flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4'>
                <section className='flex flex-col gap-2'>
                    <div className='flex items-center justify-between'>
                        <h3 className='m-0 text-base font-semibold'>Vision</h3>
                        <Button label='Edit' icon='pi pi-pencil' text size='small' onClick={() => setEditVisionVisible(true)} />
                    </div>
                    <div className='rounded border border-[var(--surface-border)] p-3' data-color-mode='dark'>
                        <MarkdownPreview
                            source={vision?.content || '_No vision written yet - where is Cratis going?_'}
                            style={{ background: 'transparent' }} />
                    </div>
                </section>

                <section className='flex flex-col gap-2'>
                    <h3 className='m-0 text-base font-semibold'>Plans</h3>
                    {plans.length === 0 &&
                        <p className='m-0 text-sm text-[var(--text-color-secondary)]'>
                            No plans yet - select issues on the Issues page and choose Plan.
                        </p>}
                    {plans.map((plan: Plan) => (
                        <div key={plan.id.toString()} className='flex flex-col gap-2 rounded border border-[var(--surface-border)] p-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Tag value={planStatusLabel(plan.status)} severity={planStatusSeverity(plan.status)} />
                                <span className='text-sm text-[var(--text-color-secondary)]'>
                                    {(plan.issues ?? []).length} issue(s)
                                    {plan.requestedBy ? ` \u00b7 requested by ${plan.requestedBy}` : ''}
                                    {plan.requestedAt ? ` \u00b7 ${new Date(plan.requestedAt).toLocaleString()}` : ''}
                                </span>
                                {plan.status === PlanStatus.ready &&
                                    <Button
                                        label={expandedPlan === plan.id.toString() ? 'Hide' : 'Show'}
                                        text
                                        size='small'
                                        onClick={() => setExpandedPlan(expandedPlan === plan.id.toString() ? undefined : plan.id.toString())} />}
                            </div>
                            {plan.status === PlanStatus.failed &&
                                <span className='text-sm text-[var(--red-500)]'>{plan.failureReason}</span>}
                            {expandedPlan === plan.id.toString() && plan.content &&
                                <div data-color-mode='dark'>
                                    <MarkdownPreview source={plan.content} style={{ background: 'transparent' }} />
                                </div>}
                        </div>
                    ))}
                </section>
            </div>

            {editVisionVisible &&
                <CommandDialog<SetVision>
                    command={SetVision}
                    visible
                    title='Edit vision'
                    width='40rem'
                    okLabel='Save'
                    cancelLabel='Cancel'
                    initialValues={{ content: vision?.content ?? '' }}
                    onConfirm={() => setEditVisionVisible(false)}
                    onCancel={() => setEditVisionVisible(false)}>
                    <MarkdownEditorField<SetVision> value={(instance) => instance.content} title='Vision' rows={12} />
                </CommandDialog>}
        </Page>
    );
};
