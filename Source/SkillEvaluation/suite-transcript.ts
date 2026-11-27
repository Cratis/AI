// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { object } from './signals.ts';
import type { SuiteMetrics } from './Suite.ts';

export class SuiteTranscript {
    readonly attemptedSkills = new Set<string>();
    readonly confirmedSkills = new Set<string>();
    private readonly pending = new Map<string, string>();
    private readonly usage = new Map<string, number>();
    turns = 0;
    toolCalls = 0;
    completed = false;
    identityObserved = false;
    error?: string;

    constructor(readonly model: string, readonly skills: string[], readonly stageRoot = '/corpus') {}

    consume(event: Record<string, unknown>): void {
        if (event.type === 'tool_execution_start') this.toolStarted(event);
        if (event.type === 'tool_execution_end') this.toolEnded(event);
        if (event.type === 'agent_end') this.completed = true;
        const message = object(event.message);
        if (event.type !== 'message_end' || message.role !== 'assistant') return;
        this.turns++;
        this.observeIdentity(message);
        this.accumulateUsage(object(message.usage));
        if (message.stopReason === 'error' || message.stopReason === 'aborted') this.error ??= String(message.errorMessage ?? message.stopReason);
    }

    private observeIdentity(message: Record<string, unknown>): void {
        if (typeof message.provider !== 'string' || typeof message.model !== 'string') return;
        this.identityObserved = true;
        if (`${message.provider}/${message.model}` !== this.model) this.error = `Unexpected model: ${message.provider}/${message.model}`;
    }

    private accumulateUsage(usage: Record<string, unknown>): void {
        for (const [key, value] of Object.entries(usage)) {
            if (typeof value === 'number' && Number.isFinite(value)) this.usage.set(key, (this.usage.get(key) ?? 0) + value);
        }
    }

    private toolStarted(event: Record<string, unknown>): void {
        this.toolCalls++;
        if (event.toolName !== 'read') return;
        const path = object(event.args).path;
        if (typeof path !== 'string') return;
        const skill = /\/skills\/([^/]+)\/SKILL\.md$/.exec(path)?.[1];
        if (!skill) return;
        this.attemptedSkills.add(skill);
        const allowed = [this.stageRoot, '/corpus'].some(root => path === `${root}/skills/${skill}/SKILL.md`);
        if (allowed && this.skills.includes(skill)) this.pending.set(String(event.toolCallId), skill);
    }

    private toolEnded(event: Record<string, unknown>): void {
        const id = String(event.toolCallId);
        const skill = this.pending.get(id);
        this.pending.delete(id);
        if (skill && event.isError !== true) this.confirmedSkills.add(skill);
    }

    metrics(): SuiteMetrics {
        return { input: this.usage.get('input') ?? null, output: this.usage.get('output') ?? null,
            cacheRead: this.usage.get('cacheRead') ?? null, cacheWrite: this.usage.get('cacheWrite') ?? null,
            reasoning: this.usage.get('reasoning') ?? null, turns: this.turns, toolCalls: this.toolCalls, costUsd: null };
    }
}
