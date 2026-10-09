// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Harness } from './Harness.ts';

export function object(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function parseLine(line: string): Record<string, unknown> {
    try { return object(JSON.parse(line)); } catch { return {}; }
}

/** Only actual Skill/read tool calls count; mentions, grep searches and tool results do not. */
export function calls(harness: Harness, event: Record<string, unknown>): Array<{ id: string; name: string; input: Record<string, unknown> }> {
    if (harness === Harness.Pi && event.type === 'tool_execution_start') {
        return [{ id: String(event.toolCallId), name: String(event.toolName), input: object(event.args) }];
    }
    if (harness !== Harness.Claude || event.type !== 'assistant') return [];
    const content = object(event.message).content;
    if (!Array.isArray(content)) return [];
    return content.map(object).filter(block => block.type === 'tool_use').map(block => ({
        id: String(block.id), name: String(block.name), input: object(block.input),
    }));
}

export function skillSignal(name: string, input: Record<string, unknown>): string | undefined {
    if (name === 'Skill') {
        const skill = input.skill ?? input.command;
        return typeof skill === 'string' ? skill.split(':').at(-1) : undefined;
    }
    if (!['read', 'Read'].includes(name)) return undefined;
    const path = input.path ?? input.file_path;
    return typeof path === 'string' ? /(?:^|[/\\])skills[/\\]([a-z0-9-]+)[/\\]SKILL\.md$/.exec(path)?.[1] : undefined;
}

export class Transcript {
    readonly skillsRead = new Set<string>();
    readonly seenCalls = new Set<string>();
    text = '';
    usage: { input: number; output: number; costUsd?: number } | undefined;
    error: string | undefined;
    completed = false;

    constructor(readonly harness: Harness) {}

    consume(line: string): void {
        const event = parseLine(line);
        for (const call of calls(this.harness, event)) {
            if (this.seenCalls.has(call.id)) continue;
            this.seenCalls.add(call.id);
            const skill = skillSignal(call.name, call.input);
            if (skill) this.skillsRead.add(skill);
        }
        if (this.harness === Harness.Claude && event.type === 'result') {
            this.completed = true;
            this.text = typeof event.result === 'string' ? event.result : '';
            if (event.is_error) this.error = this.text || JSON.stringify(event);
            const usage = object(event.usage);
            if (typeof usage.input_tokens === 'number') this.usage = {
                input: number(usage.input_tokens) + number(usage.cache_read_input_tokens) + number(usage.cache_creation_input_tokens),
                output: number(usage.output_tokens),
                ...(typeof event.total_cost_usd === 'number' ? { costUsd: event.total_cost_usd } : {}),
            };
        }
        if (this.harness === Harness.Pi && event.type === 'agent_end') this.completed = true;
        const message = object(event.message);
        if (this.harness !== Harness.Pi || event.type !== 'message_end' || message.role !== 'assistant') return;
        if (message.errorMessage || message.stopReason === 'error' || message.stopReason === 'aborted') {
            this.error = String(message.errorMessage ?? message.stopReason);
        }
        this.text = Array.isArray(message.content) ? message.content.map(object).filter(block => block.type === 'text').map(block => block.text).join('') : '';
        const usage = object(message.usage);
        if (typeof usage.input === 'number') this.usage = {
            input: (this.usage?.input ?? 0) + number(usage.input) + number(usage.cacheRead) + number(usage.cacheWrite),
            output: (this.usage?.output ?? 0) + number(usage.output),
        };
    }
}

function number(value: unknown): number { return typeof value === 'number' ? value : 0; }
