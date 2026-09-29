// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { FailureClass } from './FailureClass.ts';
import type { NoulQuestion } from './NoulQuestion.ts';
import type { SystemOneOutcome } from './SystemOneOutcome.ts';

/** The injectable transport. Defaults to the global `fetch`. */
export type Transport = typeof fetch;

export interface Connection {
    endpoint: string;
    model: string;
    timeoutMs: number;
    apiKey?: string;
}

const maximumResponseBytes = 256 * 1024;
const maximumRetryAfterMs = 10 * 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads `retry-after-ms`, then `retry-after` (seconds or an HTTP date). Undefined when absent or unusable. */
export function retryAfterMs(headers: Headers, now: () => number = Date.now): number | undefined {
    const milliseconds = headers.get('retry-after-ms');
    if (milliseconds !== null && /^\d+(\.\d+)?$/.test(milliseconds.trim())) return Math.min(Number(milliseconds), maximumRetryAfterMs);
    const value = headers.get('retry-after')?.trim();
    if (!value) return undefined;
    if (/^\d+(\.\d+)?$/.test(value)) return Math.min(Number(value) * 1000, maximumRetryAfterMs);
    const date = Date.parse(value);
    return Number.isNaN(date) ? undefined : Math.min(Math.max(0, date - now()), maximumRetryAfterMs);
}

/**
 * Checks a response body against the questions that were asked. Every asked id must be answered as a
 * `noul` and nothing else may be answered; each probability must be finite and within [0, 1].
 */
export function validateAnswers(body: unknown, questionIds: readonly string[]): { probabilities: Map<string, number>; model?: string } | FailureClass {
    if (!isRecord(body) || !isRecord(body.answers)) return FailureClass.MalformedResponse;
    const answers = body.answers;
    const asked = new Set(questionIds);
    if (Object.keys(answers).some(id => !asked.has(id))) return FailureClass.MalformedResponse;
    const probabilities = new Map<string, number>();
    for (const id of questionIds) {
        if (!Object.hasOwn(answers, id)) return FailureClass.MalformedResponse;
        const answer = answers[id];
        if (!isRecord(answer) || answer.type !== 'noul' || typeof answer.noul !== 'number') return FailureClass.MalformedResponse;
        if (!Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) return FailureClass.InvalidProbability;
        probabilities.set(id, answer.noul);
    }
    return { probabilities, model: typeof body.model === 'string' ? body.model : undefined };
}

async function readBounded(response: Response): Promise<string | undefined> {
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maximumResponseBytes) return undefined;
    if (!response.body) return '';
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maximumResponseBytes) {
            await reader.cancel().catch(() => undefined);
            return undefined;
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
}

function statusFailure(status: number): FailureClass {
    if (status === 401 || status === 403) return FailureClass.Unauthorized;
    if (status === 429) return FailureClass.RateLimited;
    if (status === 529) return FailureClass.Overloaded;
    if (status >= 500) return FailureClass.ServerError;
    return FailureClass.InvalidRequest;
}

/**
 * Asks one batch of questions. Never throws and never outlives `timeoutMs` (plus scheduling delay): the
 * abort signal cancels the request, and a race against the same signal covers a transport that ignores
 * it. Redirects are refused so a loopback server cannot forward the prompt or the key elsewhere.
 */
export async function askSystemOne(
    connection: Connection,
    state: unknown,
    questions: Record<string, NoulQuestion>,
    transport: Transport = fetch,
    now: () => number = Date.now,
): Promise<SystemOneOutcome> {
    const started = now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), connection.timeoutMs);
    const failed = (failure: FailureClass, retryAfter?: number): SystemOneOutcome => ({ ok: false, failure, latencyMs: now() - started, retryAfterMs: retryAfter });

    const attempt = async (): Promise<SystemOneOutcome> => {
        try {
            const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
            if (connection.apiKey) headers.authorization = `Bearer ${connection.apiKey}`;
            const response = await transport(`${connection.endpoint}/v1/systemone`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ state, model: connection.model, questions }),
                signal: controller.signal,
                redirect: 'error',
            });
            if (!response.ok) {
                const wait = retryAfterMs(response.headers, now);
                await response.body?.cancel().catch(() => undefined);
                return failed(statusFailure(response.status), wait);
            }
            const text = await readBounded(response);
            if (text === undefined) return failed(FailureClass.MalformedResponse);
            let body: unknown;
            try {
                body = JSON.parse(text);
            } catch {
                return failed(FailureClass.MalformedResponse);
            }
            const validated = validateAnswers(body, Object.keys(questions));
            if (typeof validated === 'string') return failed(validated);
            return { ok: true, probabilities: validated.probabilities, model: validated.model, latencyMs: now() - started };
        } catch {
            return failed(controller.signal.aborted ? FailureClass.Timeout : FailureClass.Network);
        }
    };
    const deadline = new Promise<SystemOneOutcome>(resolve => {
        controller.signal.addEventListener('abort', () => resolve(failed(FailureClass.Timeout)), { once: true });
    });
    try {
        return await Promise.race([attempt(), deadline]);
    } finally {
        clearTimeout(timer);
    }
}
