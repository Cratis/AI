// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const browserTool = /browser|playwright|clickElement|typeInPage|\*/i;

export interface CapturedToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    source: 'pi' | 'claude';
}

type CaptureConfig = { capture: boolean; forbidden: string[]; sessions?: string[] };
type CaptureManifest = Record<string, CaptureConfig & { sessions: string[] }>;

const sensitiveKey = /secret|token|password|passwd|api[-_]?key|authorization|credential|cookie/i;
const sensitiveValue = /(sk-|ghp_|gho_|xox[bp]-|Bearer\s+)[\w.-]{8,}/;
const urlCredentials = /:\/\/[^/\s:@]+:[^/\s@]+@/;

function object(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function redactString(value: string): string {
    return sensitiveValue.test(value) || urlCredentials.test(value) ? '[redacted]' : value.slice(0, 200);
}

function redactEntry([key, value]: [string, unknown]): [string, unknown] {
    return [key, sensitiveKey.test(key) ? '[redacted]' : redact(value)];
}

export function redact(value: unknown): unknown {
    if (typeof value === 'string') return redactString(value);
    if (Array.isArray(value)) return value.map(redact);
    if (value === null || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(redactEntry));
}

function nonemptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
}

function capturedCall(id: unknown, name: unknown, arguments_: unknown, source: CapturedToolCall['source']): CapturedToolCall[] {
    if (!nonemptyString(id) || !nonemptyString(name)) return [];
    return [{ id, name, arguments: object(redact(object(arguments_))), source }];
}

function messageCalls(event: Record<string, unknown>): CapturedToolCall[] {
    const message = object(event.message);
    const content = message.content;
    if (!Array.isArray(content)) return [];
    if (event.type === 'assistant') {
        return content.map(object).filter(block => block.type === 'tool_use')
            .flatMap(block => capturedCall(block.id, block.name, block.input, 'claude'));
    }
    if (event.type !== 'message' || message.role !== 'assistant') return [];
    return content.map(object).filter(block => block.type === 'toolCall')
        .flatMap(block => capturedCall(block.id, block.name, block.arguments, 'pi'));
}

// Pi execution starts and Claude tool_use shapes mirror Source/SkillEvaluation/signals.ts calls().
// Persisted Pi assistant toolCall blocks are also accepted; results and mentions never count.
function eventCalls(value: unknown): CapturedToolCall[] {
    const event = object(value);
    if (event.type === 'tool_execution_start') {
        return capturedCall(event.toolCallId, event.toolName, event.args, 'pi');
    }
    return messageCalls(event);
}

function parseLine(line: string): { calls: CapturedToolCall[] } | undefined {
    let value: unknown;
    try { value = JSON.parse(line); } catch { return undefined; }
    return { calls: eventCalls(value) };
}

export function parseSession(jsonl: string): CapturedToolCall[] {
    const events = jsonl.split(/\r?\n/).map(parseLine).filter(event => event !== undefined);
    if (events.length === 0) throw new Error('session contains no parseable JSON lines');
    const calls = new Map<string, CapturedToolCall>();
    for (const call of events.flatMap(event => event.calls)) {
        if (!calls.has(call.id)) calls.set(call.id, call);
    }
    return [...calls.values()];
}

export function assertNoForbiddenCalls(fixtureName: string, calls: CapturedToolCall[], config: CaptureConfig): void {
    if (config.capture && calls.length === 0) throw new Error(`${fixtureName}: captured no tool calls`);
    const forbidden = config.forbidden.map(pattern => new RegExp(pattern, 'i'));
    for (const call of calls) {
        if (forbidden.some(pattern => pattern.test(call.name))) throw new Error(`forbidden tool call: ${call.name}`);
    }
}

export function loadCaptureManifest(): CaptureManifest {
    return JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures', 'restraint', 'captures.json'), 'utf8')) as CaptureManifest;
}
