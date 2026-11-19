// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { Harness } from './Harness.ts';
import type { SkillExpectation } from './SkillExpectation.ts';

export function object(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function parseLine(line: string): Record<string, unknown> {
    try { return object(JSON.parse(line)); } catch { return {}; }
}

function blocks(event: Record<string, unknown>): Record<string, unknown>[] {
    const content = object(event.message).content;
    return Array.isArray(content) ? content.map(object) : [];
}

type ToolCall = { id: string; name: string; input: Record<string, unknown> };
type ToolCompletion = { id: string; failed: boolean };
type Usage = { input: number; output: number; costUsd?: number };

function piCalls(event: Record<string, unknown>): ToolCall[] {
    if (event.type !== 'tool_execution_start') return [];
    return [{ id: String(event.toolCallId ?? ''), name: String(event.toolName), input: object(event.args) }];
}

function claudeCalls(event: Record<string, unknown>): ToolCall[] {
    if (event.type !== 'assistant') return [];
    return blocks(event).filter(block => block.type === 'tool_use').map(block => ({
        id: String(block.id ?? ''), name: String(block.name), input: object(block.input),
    }));
}

function piCompletions(event: Record<string, unknown>): ToolCompletion[] {
    if (event.type !== 'tool_execution_end') return [];
    return [{ id: String(event.toolCallId ?? ''), failed: event.isError === true }];
}

function claudeCompletions(event: Record<string, unknown>): ToolCompletion[] {
    if (event.type !== 'user') return [];
    return blocks(event).filter(block => block.type === 'tool_result').map(block => ({
        id: String(block.tool_use_id ?? ''), failed: block.is_error === true,
    }));
}

const protocols = {
    [Harness.Pi]: { calls: piCalls, completions: piCompletions },
    [Harness.Claude]: { calls: claudeCalls, completions: claudeCompletions },
};

/** Tool starts are attempts, not evidence that the content was loaded. */
export function calls(harness: Harness, event: Record<string, unknown>): ToolCall[] {
    return protocols[harness].calls(event);
}

function completions(harness: Harness, event: Record<string, unknown>): ToolCompletion[] {
    return protocols[harness].completions(event);
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

function containedRead(input: Record<string, unknown>, root: string | undefined): boolean {
    const path = input.path ?? input.file_path;
    if (!root || typeof path !== 'string') return false;
    try {
        const within = relative(realpathSync(root), realpathSync(resolve(root, path)));
        return within !== '..' && !within.startsWith(`..${sep}`) && !isAbsolute(within);
    } catch { return false; }
}

export class Transcript {
    readonly skillsRead = new Set<string>();
    readonly attemptedSkills = new Set<string>();
    readonly seenCalls = new Set<string>();
    readonly pendingSkills = new Map<string, string | undefined>();
    text = '';
    usage: Usage | undefined;
    error: string | undefined;
    completed = false;
    listedSkills: string[] | undefined;

    constructor(readonly harness: Harness, readonly expectation?: SkillExpectation, readonly root?: string) {}

    get targetLoaded(): boolean {
        return this.expectation?.target !== undefined && this.skillsRead.has(this.expectation.target);
    }

    validateInitialization(): void {
        if (this.harness !== Harness.Claude || !this.expectation) return;
        if (this.listedSkills === undefined) this.error ??= 'Claude did not emit a valid system/init skills listing.';
    }

    consume(line: string, observeTools = true): void {
        const event = parseLine(line);
        if (observeTools) this.consumeTools(event);
        if (this.harness === Harness.Claude) this.consumeClaude(event);
        else this.consumePi(event);
    }

    private consumeTools(event: Record<string, unknown>): void {
        for (const call of calls(this.harness, event)) this.recordAttempt(call);
        for (const result of completions(this.harness, event)) this.recordCompletion(result);
    }

    private recordAttempt(call: ToolCall): void {
        if (!call.id || this.seenCalls.has(call.id)) return;
        this.seenCalls.add(call.id);
        const skill = skillSignal(call.name, call.input);
        if (!skill) return;
        this.attemptedSkills.add(skill);
        this.pendingSkills.set(call.id, this.confirmable(call, skill) ? skill : undefined);
    }

    private confirmable(call: ToolCall, skill: string): boolean {
        if (!this.expectation?.withSkills) return false;
        if (!this.expectation.corpusSkills.includes(skill)) return false;
        return call.name === 'Skill' || containedRead(call.input, this.root);
    }

    private recordCompletion(result: ToolCompletion): void {
        const skill = this.pendingSkills.get(result.id);
        this.pendingSkills.delete(result.id);
        if (skill && !result.failed) this.skillsRead.add(skill);
    }

    private consumeClaude(event: Record<string, unknown>): void {
        if (event.type === 'system' && event.subtype === 'init') this.consumeListing(event.skills);
        if (event.type !== 'result') return;
        this.completed = true;
        this.text = typeof event.result === 'string' ? event.result : '';
        if (event.is_error) this.error = this.text || JSON.stringify(event);
        this.usage = claudeUsage(event) ?? this.usage;
    }

    private consumeListing(skills: unknown): void {
        if (!isSkillListing(skills)) {
            if (this.expectation) this.error = 'Claude system/init has no valid skills listing.';
            return;
        }
        this.listedSkills = skills;
        this.error = listingError(skills, this.expectation) ?? this.error;
    }

    private consumePi(event: Record<string, unknown>): void {
        if (event.type === 'agent_end') this.completed = true;
        const message = object(event.message);
        if (event.type !== 'message_end' || message.role !== 'assistant') return;
        this.error = piError(message) ?? this.error;
        this.text = blocks(event).filter(block => block.type === 'text').map(block => block.text).join('');
        this.usage = piUsage(message, this.usage) ?? this.usage;
    }
}

function isSkillListing(skills: unknown): skills is string[] {
    return Array.isArray(skills) && skills.every(skill => typeof skill === 'string');
}

function listingError(skills: string[], expectation: SkillExpectation | undefined): string | undefined {
    if (!expectation) return;
    if (expectation.withSkills) return missingTarget(skills, expectation.target!);
    if (skills.some(skill => expectation.corpusSkills.includes(skill))) return 'Claude without-skills system/init lists a corpus skill.';
}

function missingTarget(skills: string[], target: string): string | undefined {
    if (!skills.includes(target)) return `Claude system/init does not list target skill '${target}'.`;
}

function claudeUsage(event: Record<string, unknown>): Usage | undefined {
    const usage = object(event.usage);
    if (typeof usage.input_tokens !== 'number') return;
    return {
        input: number(usage.input_tokens) + number(usage.cache_read_input_tokens) + number(usage.cache_creation_input_tokens),
        output: number(usage.output_tokens),
        ...(typeof event.total_cost_usd === 'number' ? { costUsd: event.total_cost_usd } : {}),
    };
}

function piError(message: Record<string, unknown>): string | undefined {
    if (message.errorMessage || ['error', 'aborted'].includes(String(message.stopReason))) {
        return String(message.errorMessage ?? message.stopReason);
    }
}

function piUsage(message: Record<string, unknown>, previous: Usage | undefined): Usage | undefined {
    const usage = object(message.usage);
    if (typeof usage.input !== 'number') return;
    return {
        input: (previous?.input ?? 0) + number(usage.input) + number(usage.cacheRead) + number(usage.cacheWrite),
        output: (previous?.output ?? 0) + number(usage.output),
    };
}

function number(value: unknown): number { return typeof value === 'number' ? value : 0; }
