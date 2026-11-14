// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
    ClaimRequest, ClaimTools, HeartbeatRequest, HeartbeatResult, ReleaseRequest, ReleaseResult, SEND_IDEMPOTENCY_KEY, TenantHeader,
    WorkClaimed, parseHeartbeatResult, parseReleaseResult, parseWorkClaimed
} from './DirectContract.ts';
import { SessionRefused } from './Refusals.ts';

/** The Direct operations a local session needs; specs use a fake. Any failure is the one generic refusal. */
export interface DirectGateway {
    claim(request: ClaimRequest): Promise<WorkClaimed>;
    heartbeat(request: HeartbeatRequest): Promise<HeartbeatResult>;
    release(request: ReleaseRequest): Promise<ReleaseResult>;
    close(): Promise<void>;
}

/** Calls one tool and returns its structured result; rejects on any failure. */
export type ToolCaller = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export interface GatewayOptions {
    readonly sendIdempotencyKey?: boolean;
    readonly newIdempotencyKey?: () => string;
}

export class McpDirectGateway implements DirectGateway {
    private readonly sendIdempotencyKey: boolean;
    private readonly newIdempotencyKey: () => string;

    constructor(private readonly call: ToolCaller, private readonly closeConnection: () => Promise<void>, options: GatewayOptions = {}) {
        this.sendIdempotencyKey = options.sendIdempotencyKey ?? SEND_IDEMPOTENCY_KEY;
        this.newIdempotencyKey = options.newIdempotencyKey ?? randomUUID;
    }

    async claim(request: ClaimRequest): Promise<WorkClaimed> {
        return parseWorkClaimed(await this.invoke(ClaimTools.claim, { ...request }));
    }

    async heartbeat(request: HeartbeatRequest): Promise<HeartbeatResult> {
        return parseHeartbeatResult(await this.invoke(ClaimTools.heartbeat, { ...request }));
    }

    async release(request: ReleaseRequest): Promise<ReleaseResult> {
        return parseReleaseResult(await this.invoke(ClaimTools.release, { ...request }));
    }

    close(): Promise<void> {
        return this.closeConnection();
    }

    private async invoke(tool: string, args: Record<string, unknown>): Promise<unknown> {
        const withKey = this.sendIdempotencyKey ? { ...args, idempotencyKey: this.newIdempotencyKey() } : args;
        try { return await this.call(tool, withKey); } catch { throw new SessionRefused('refused'); }
    }
}

/** Exactly the two headers Direct admits: the bearer token and the tenant. */
export function requestHeaders(token: string, tenantId: string): Record<string, string> {
    return { Authorization: `Bearer ${token}`, [TenantHeader]: tenantId };
}

type ToolResult = { isError?: boolean; structuredContent?: unknown; content?: Array<{ type: string; text?: string }> };

function structuredResult(result: ToolResult): unknown {
    if (result.isError) throw new Error('refused');
    if (result.structuredContent !== undefined) return result.structuredContent;
    const text = result.content?.find(part => part.type === 'text')?.text;
    if (text === undefined) throw new Error('empty');
    return JSON.parse(text);
}

/** The streamable HTTP connection to Direct's MCP endpoint. The token never leaves this closure except as the bearer header. */
export function connectDirect(mcpUrl: string, tenantId: string, token: string, options: GatewayOptions = {}): DirectGateway {
    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), { requestInit: { headers: requestHeaders(token, tenantId) } });
    const client = new Client({ name: 'cratis-pi-direct', version: '0.0.0' });
    let connected: Promise<void> | undefined;
    const call: ToolCaller = async (name, args) => {
        connected ??= client.connect(transport);
        await connected;
        return structuredResult(await client.callTool({ name, arguments: args }) as ToolResult);
    };
    return new McpDirectGateway(call, () => client.close(), options);
}
