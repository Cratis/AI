// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Every Direct S2 name lives in this module (tool names, field names, shapes). The shapes are not frozen yet:
// a rename is a change here and in DirectGateway.ts only.

import { SessionRefused } from './Refusals.ts';

export const ClaimTools = {
    claim: 'direct_work_claim',
    heartbeat: 'direct_work_heartbeat',
    release: 'direct_work_release'
} as const;

/** The tenant header; the gateway sends it, together with Authorization, on every request and nothing else identity-bearing. */
export const TenantHeader = 'x-cratis-tenant-id';

/** The one switch: the contract records do not carry an idempotency key today. Turn it on if S2 adds one. */
export const SEND_IDEMPOTENCY_KEY = false;

/** Fail closed on implausible grants; leases and heartbeat intervals are capped at 24 hours. */
export const MaxLeaseSeconds = 86_400;
const MaxTimeoutMilliseconds = 2_147_483_647;

/** Shared with the send-time deadline so even gateways bypassing the parser cannot extend authority. */
export function leaseMilliseconds(seconds: number): number {
    const milliseconds = seconds * 1000;
    if (!Number.isFinite(seconds)) throw new SessionRefused('refused');
    if (seconds <= 0 || seconds > MaxLeaseSeconds) throw new SessionRefused('refused');
    if (!Number.isSafeInteger(milliseconds)) throw new SessionRefused('refused');
    return milliseconds;
}

export const ReleaseOutcomes = ['Delivered', 'Abandoned', 'Blocked', 'Declined'] as const;
export type ReleaseOutcome = typeof ReleaseOutcomes[number];

export interface ClaimRequest {
    readonly workHandle: string;
    readonly session: string;
    readonly harness: string;
    /** The proof exactly as read from the file (64 lowercase hex characters). */
    readonly launchProof: string;
}

export interface WorkPayload {
    readonly title: string;
    readonly brief: string;
    readonly repository: string;
    readonly baseRef: string;
}

export interface WorkClaimed {
    readonly workHandle: string;
    readonly claimId: string;
    readonly epoch: number;
    readonly leaseSeconds: number;
    readonly heartbeatSeconds: number;
    readonly payload: WorkPayload;
}

export interface HeartbeatRequest {
    readonly workHandle: string;
    readonly claimId: string;
    readonly epoch: number;
    readonly activity?: string;
}

export interface HeartbeatResult {
    readonly epoch: number;
    readonly leaseSeconds: number;
}

export interface ReleaseRequest {
    readonly workHandle: string;
    readonly claimId: string;
    readonly epoch: number;
    readonly outcome: ReleaseOutcome;
    readonly reason?: string;
}

export interface ReleaseResult {
    readonly epoch: number;
    readonly outcome: ReleaseOutcome;
}

type Fields = Record<string, unknown>;

function refuse(): never {
    throw new SessionRefused('refused');
}

function isRecord(value: unknown): value is Fields {
    return typeof value === 'object' && value !== null;
}

function isNumberWhere(value: unknown, accepts: (number: number) => boolean): value is number {
    return typeof value === 'number' && accepts(value);
}

function fieldsOf(value: unknown): Fields {
    return isRecord(value) ? value : refuse();
}

function text(fields: Fields, name: string): string {
    const value = fields[name];
    if (typeof value !== 'string' || value.length === 0) throw new SessionRefused('refused');
    return value;
}

function positive(fields: Fields, name: string): number {
    const value = fields[name];
    return isNumberWhere(value, number => Number.isFinite(number) && number > 0) ? value : refuse();
}

function timing(fields: Fields, name: string): number {
    const seconds = positive(fields, name);
    leaseMilliseconds(seconds);
    return seconds;
}

function counter(fields: Fields, name: string): number {
    const value = fields[name];
    return isNumberWhere(value, number => Number.isInteger(number) && number >= 0) ? value : refuse();
}

function optionalText(fields: Fields, name: string): string {
    const value = fields[name];
    return typeof value === 'string' ? value : '';
}

export function parseWorkClaimed(value: unknown): WorkClaimed {
    const fields = fieldsOf(value);
    const payload = fieldsOf(fields.payload);
    const leaseSeconds = timing(fields, 'leaseSeconds');
    const heartbeatSeconds = timing(fields, 'heartbeatSeconds');
    if (heartbeatSeconds >= leaseSeconds || heartbeatSeconds * 1000 > MaxTimeoutMilliseconds) refuse();
    return {
        workHandle: text(fields, 'workHandle'),
        claimId: text(fields, 'claimId'),
        epoch: counter(fields, 'epoch'),
        leaseSeconds,
        heartbeatSeconds,
        payload: {
            title: text(payload, 'title'),
            brief: optionalText(payload, 'brief'),
            repository: optionalText(payload, 'repository'),
            baseRef: optionalText(payload, 'baseRef')
        }
    };
}

export function parseHeartbeatResult(value: unknown): HeartbeatResult {
    const fields = fieldsOf(value);
    return { epoch: counter(fields, 'epoch'), leaseSeconds: timing(fields, 'leaseSeconds') };
}

export function parseReleaseResult(value: unknown): ReleaseResult {
    const fields = fieldsOf(value);
    const outcome = text(fields, 'outcome');
    if (!(ReleaseOutcomes as readonly string[]).includes(outcome)) throw new SessionRefused('refused');
    return { epoch: counter(fields, 'epoch'), outcome: outcome as ReleaseOutcome };
}
