// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useEffect, useRef, useState } from 'react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { WorkItem } from './Listing/Listing';
import { WorkPurpose } from './WorkPurpose';
import { WorkStatus } from './WorkStatus';
import { StopWork } from './Stopping/Stopping';

/**
 * Props for the {@link WorkDetails} component.
 */
export interface WorkDetailsProps {
    /**
     * The unit of work to show details for.
     */
    work: WorkItem;
}

export const workStatusLabel = (status: WorkStatus) => {
    switch (status) {
        case WorkStatus.running: return 'Running';
        case WorkStatus.completed: return 'Completed';
        case WorkStatus.failed: return 'Failed';
        case WorkStatus.stopped: return 'Stopped';
        default: return 'Scheduled';
    }
};

export const workStatusSeverity = (status: WorkStatus) => {
    switch (status) {
        case WorkStatus.running: return 'warning';
        case WorkStatus.completed: return 'success';
        case WorkStatus.failed: return 'danger';
        case WorkStatus.stopped: return 'secondary';
        default: return 'info';
    }
};

export const workPurposeLabel = (purpose: WorkPurpose) => {
    switch (purpose) {
        case WorkPurpose.investigation: return 'Investigation';
        case WorkPurpose.adHoc: return 'Ad-hoc';
        default: return 'Implementation';
    }
};

export const WorkDetails = ({ work }: WorkDetailsProps) => {
    const [lines, setLines] = useState<string[]>([]);
    const [steer, setSteer] = useState('');
    const consoleRef = useRef<HTMLPreElement>(null);
    const active = work.status === WorkStatus.running;

    useEffect(() => {
        setLines([]);
        const source = new EventSource(`/api/work/${work.id}/log`);
        source.onmessage = (event) => setLines((current) => [...current.slice(-2000), event.data as string]);
        source.onerror = () => source.close();
        return () => source.close();
    }, [work.id]);

    useEffect(() => {
        consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight });
    }, [lines]);

    const stop = async () => {
        const command = new StopWork();
        command.work = work.id;
        await command.execute();
    };

    const sendSteering = async () => {
        if (!steer.trim()) return;
        await fetch(`/api/work/${work.id}/input`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: steer }),
        });
        setSteer('');
    };

    const usage = (work.inputTokens ?? 0) + (work.outputTokens ?? 0);

    return (
        <div className='flex h-full flex-col gap-3 overflow-hidden p-4' data-color-mode='dark'>
            <div className='flex items-center gap-2'>
                <Tag value={workPurposeLabel(work.purpose)} />
                <Tag value={workStatusLabel(work.status)} severity={workStatusSeverity(work.status)} />
                {(work.status === WorkStatus.scheduled || work.status === WorkStatus.running) &&
                    <Button label='Stop' icon='pi pi-stop-circle' severity='danger' size='small' outlined onClick={stop} />}
            </div>

            <div className='text-sm text-[var(--text-color-secondary)]'>
                Model: {work.model || 'auto'}
                {work.requestedBy ? ` · requested by ${work.requestedBy}` : ' · scheduled by automation'}
                {work.startedAt ? ` · started ${new Date(work.startedAt).toLocaleString()}` : ''}
                {usage > 0 ? ` · ${usage.toLocaleString()} tokens` : ''}
                {work.cost ? ` · $${work.cost.toFixed(2)}` : ''}
                {work.durationMs ? ` · ${Math.round(work.durationMs / 1000)}s` : ''}
            </div>

            {work.prompt &&
                <div className='max-h-40 overflow-auto rounded border border-[var(--surface-border)] p-2 text-sm'>
                    {work.prompt}
                </div>}

            {(work.summary || work.findings || work.reason) &&
                <div className='max-h-72 overflow-auto rounded border border-[var(--surface-border)] p-3'>
                    {work.reason
                        ? <div className='text-sm text-red-400'>{work.reason}</div>
                        : <MarkdownPreview source={work.findings ?? work.summary ?? ''} style={{ background: 'transparent' }} />}
                </div>}

            <div className='flex min-h-0 flex-1 flex-col gap-2'>
                <div className='font-medium'>Console</div>
                <pre
                    ref={consoleRef}
                    className='m-0 min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all rounded bg-black p-3 font-mono text-xs text-green-400'>
                    {lines.length > 0 ? lines.join('\n') : (active ? 'Waiting for output…' : 'No live output - the worker is not running')}
                </pre>
                {active &&
                    <div className='flex gap-2'>
                        <InputText
                            className='flex-1'
                            placeholder='Steer the agent - your text is sent to the running session'
                            value={steer}
                            onChange={(e) => setSteer(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendSteering()} />
                        <Button label='Send' icon='pi pi-send' onClick={sendSteering} disabled={!steer.trim()} />
                    </div>}
            </div>
        </div>
    );
};
