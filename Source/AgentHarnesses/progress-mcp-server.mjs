#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//
// The `report_progress` MCP tool a worker container's Claude CLI session calls into to post live
// progress - an initial plan/checklist and status updates while it works - back to the Direct,
// instead of the Direct only ever learning about a unit of work when it finishes.
//
// Talks stdio JSON-RPC (the MCP CLI wires this in through `--mcp-config`, see entrypoint.sh) and
// makes exactly one outbound call per tool invocation: a POST to DIRECT_PROGRESS_URL, bearer-
// authenticated with DIRECT_CALLBACK_TOKEN - the same per-work token the container's ordinary
// /callback reporting already uses. Both arrive as environment variables set explicitly in this
// server's `env` block in the generated MCP config, rather than relying on inheritance.
//
// A failed report (DIRECT_PROGRESS_URL unset, a network error, a non-2xx response) is never
// allowed to crash this process or the agent's session: it is logged to stderr - stdout is the
// JSON-RPC channel, writing anything else there would corrupt the protocol stream - and the tool
// call still returns a normal (if `isError: true`) result, so the agent sees the report did not go
// through and can decide whether to retry or just keep working. Losing a progress update is a
// shrug, never an incident.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Posts a progress report to the Direct. Never throws - every failure mode (no URL configured,
 * a network error, a non-2xx response, a timeout) resolves to `{ ok: false, reason }` instead.
 * @param {{ plan?: string[], completed?: string[], note?: string }} report The fields to report -
 *   a field the caller did not send is simply absent from the JSON body, so the backend's merge
 *   ("not sent" keeps whatever is already recorded) applies naturally.
 * @param {{ progressUrl?: string, token?: string, fetchImpl?: typeof fetch }} config Where to post
 *   and how to authenticate - injectable so tests can point this at a local HTTP listener.
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function postProgress(report, config) {
    const progressUrl = config?.progressUrl;
    const token = config?.token;
    const fetchImpl = config?.fetchImpl ?? fetch;

    if (!progressUrl) {
        return { ok: false, reason: 'DIRECT_PROGRESS_URL is not set - nowhere to report progress to' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetchImpl(progressUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(report),
            signal: controller.signal,
        });

        if (!response.ok) {
            return { ok: false, reason: `Direct responded ${response.status} ${response.statusText}` };
        }

        return { ok: true };
    } catch (error) {
        const reason = error?.name === 'AbortError' ? 'the request timed out' : (error?.message ?? String(error));
        return { ok: false, reason };
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Builds the `report_progress` tool's input, dropping fields the caller did not provide so the
 * posted JSON body only carries what was actually reported - `undefined` properties are omitted by
 * `JSON.stringify`, which is exactly the "not sent" the backend's merge semantics expect.
 * @param {{ plan?: string[], completed?: string[], note?: string }} args The tool call's arguments.
 * @returns {{ plan?: string[], completed?: string[], note?: string }}
 */
export function buildReport(args) {
    const report = {};
    if (args?.plan !== undefined) report.plan = args.plan;
    if (args?.completed !== undefined) report.completed = args.completed;
    if (args?.note !== undefined) report.note = args.note;
    return report;
}

/**
 * Creates the MCP server exposing the `report_progress` tool. Kept as a factory (rather than a
 * top-level side effect) so the test below can construct one against a stubbed HTTP endpoint
 * without any of this reaching a real network.
 * @param {{ progressUrl?: string, token?: string, fetchImpl?: typeof fetch }} config Where progress
 *   reports are posted and how they authenticate.
 * @returns {McpServer} The configured server - not yet connected to a transport.
 */
export function createServer(config) {
    const server = new McpServer({ name: 'direct-progress', version: '1.0.0' });

    server.registerTool(
        'report_progress',
        {
            description:
                'Report live progress on the current unit of work back to Direct. Call it once near the ' +
                'start with a plan (a checklist of the steps you intend to take), and again whenever you ' +
                'complete a step or your status changes meaningfully. All fields are optional - send only ' +
                'what changed.',
            inputSchema: {
                plan: z
                    .array(z.string())
                    .optional()
                    .describe('The full checklist of steps you intend to take. Replaces whatever plan is already recorded.'),
                completed: z
                    .array(z.string())
                    .optional()
                    .describe('The plan steps completed so far. Replaces whatever is already recorded.'),
                note: z.string().optional().describe('A short free-form status note.'),
            },
        },
        async (args) => {
            const report = buildReport(args);
            const result = await postProgress(report, config);

            if (result.ok) {
                return { content: [{ type: 'text', text: 'Progress reported.' }] };
            }

            // stdout is the JSON-RPC transport - anything logged goes to stderr so it never
            // corrupts the protocol stream the Claude CLI is reading.
            console.error(`[progress-mcp-server] Failed to report progress: ${result.reason}`);
            return {
                isError: true,
                content: [{ type: 'text', text: `Progress report did not go through: ${result.reason}. Continuing without it.` }],
            };
        },
    );

    return server;
}

async function main() {
    const server = createServer({
        progressUrl: process.env.DIRECT_PROGRESS_URL,
        token: process.env.DIRECT_CALLBACK_TOKEN,
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

// Only run the server when executed directly - importing this module from a test (to reach
// `createServer`/`postProgress`/`buildReport` in isolation) must not also start a stdio server.
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('[progress-mcp-server] Fatal error, exiting:', error);
        process.exit(1);
    });
}
