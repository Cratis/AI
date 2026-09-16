// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//
// Verifies progress-mcp-server.mjs at the one boundary that is genuinely, fully testable without a
// live worker container or a real Claude CLI session: the MCP protocol handling itself. The
// "over stdio" tests below spawn the script as a real child process and speak the actual MCP
// initialize handshake and a tools/call request to it, using the same SDK client classes a real MCP
// host (the Claude CLI included) uses - not a hand-rolled stand-in for the protocol. The one
// outbound HTTP call the tool makes is pointed at a local http.createServer instead of the real
// Direct, so the request that actually went out (method, path, headers, body) can be asserted
// rather than trusted.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { buildReport, postProgress } from './progress-mcp-server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_SCRIPT = path.join(__dirname, 'progress-mcp-server.mjs');

/**
 * Starts a local HTTP listener that records every request it receives and answers with a fixed
 * status, standing in for the Direct's /progress route.
 * @param {number} statusCode The status code to answer every request with.
 * @returns {Promise<{ url: string, close: () => Promise<void>, requests: Array<{ method: string, path: string, headers: Record<string, string>, body: unknown }> }>}
 */
async function startTestListener(statusCode = 200) {
    const requests = [];
    const server = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            requests.push({
                method: req.method,
                path: req.url,
                headers: req.headers,
                body: raw ? JSON.parse(raw) : undefined,
            });
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({}));
        });
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    return {
        url: `http://127.0.0.1:${port}/api/work/00000000-0000-0000-0000-000000000000/progress`,
        requests,
        close: () => new Promise((resolve) => server.close(resolve)),
    };
}

/**
 * Connects a real MCP client to the server script over real stdio, with the given environment.
 * @param {Record<string, string>} env Environment variables the spawned server process gets.
 * @returns {Promise<{ client: Client, close: () => Promise<void> }>}
 */
async function connectToServer(env) {
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [SERVER_SCRIPT],
        env,
        stderr: 'pipe',
    });
    const client = new Client({ name: 'progress-mcp-server-test', version: '1.0.0' });
    await client.connect(transport);
    return { client, close: () => client.close() };
}

test('the real MCP initialize handshake and tool listing', async (t) => {
    const listener = await startTestListener(200);
    const { client, close } = await connectToServer({
        DIRECT_PROGRESS_URL: listener.url,
        DIRECT_CALLBACK_TOKEN: 'test-token',
    });

    t.after(async () => {
        await close();
        await listener.close();
    });

    // client.connect() already performed the initialize handshake and threw if it failed - reaching
    // here at all proves the server answered it correctly over real stdio JSON-RPC framing.
    const { tools } = await client.listTools();
    assert.equal(tools.length, 1);
    assert.equal(tools[0].name, 'report_progress');
    assert.equal(tools[0].inputSchema.type, 'object');
    assert.deepEqual(
        new Set(Object.keys(tools[0].inputSchema.properties)),
        new Set(['plan', 'completed', 'note']),
    );
});

test('a tools/call for report_progress posts the report to Direct', async (t) => {
    const listener = await startTestListener(200);
    const { client, close } = await connectToServer({
        DIRECT_PROGRESS_URL: listener.url,
        DIRECT_CALLBACK_TOKEN: 'test-token-abc',
    });

    t.after(async () => {
        await close();
        await listener.close();
    });

    const result = await client.callTool({
        name: 'report_progress',
        arguments: { plan: ['Read the code', 'Make the change', 'Verify it'], note: 'Starting now' },
    });

    assert.equal(result.isError, undefined);
    assert.match(result.content[0].text, /reported/i);

    assert.equal(listener.requests.length, 1);
    const [request] = listener.requests;
    assert.equal(request.method, 'POST');
    assert.equal(request.path, '/api/work/00000000-0000-0000-0000-000000000000/progress');
    assert.equal(request.headers.authorization, 'Bearer test-token-abc');
    assert.equal(request.headers['content-type'], 'application/json');
    assert.deepEqual(request.body, {
        plan: ['Read the code', 'Make the change', 'Verify it'],
        note: 'Starting now',
    });
    // completed was never sent by the tool call, so it must be absent from the JSON body entirely -
    // not present-as-null, not present-as-[] - so the backend's "not sent keeps current" merge holds.
    assert.equal('completed' in request.body, false);
});

test('a report_progress call touching only completed and note omits plan from the posted body', async (t) => {
    const listener = await startTestListener(200);
    const { client, close } = await connectToServer({
        DIRECT_PROGRESS_URL: listener.url,
        DIRECT_CALLBACK_TOKEN: 'test-token',
    });

    t.after(async () => {
        await close();
        await listener.close();
    });

    await client.callTool({ name: 'report_progress', arguments: { completed: ['Read the code'], note: 'Halfway there' } });

    assert.equal(listener.requests.length, 1);
    assert.deepEqual(listener.requests[0].body, { completed: ['Read the code'], note: 'Halfway there' });
    assert.equal('plan' in listener.requests[0].body, false);
});

test('a failed report does not crash the server or the session - it comes back as a soft tool error', async (t) => {
    const listener = await startTestListener(500);
    const { client, close } = await connectToServer({
        DIRECT_PROGRESS_URL: listener.url,
        DIRECT_CALLBACK_TOKEN: 'test-token',
    });

    t.after(async () => {
        await close();
        await listener.close();
    });

    const failed = await client.callTool({ name: 'report_progress', arguments: { note: 'This will not go through' } });
    assert.equal(failed.isError, true);
    assert.match(failed.content[0].text, /did not go through/i);

    // The session must still be alive and usable after a failed report - a lost progress update is
    // a shrug, not a reason the rest of the unit of work should be unable to continue.
    const stillWorks = await client.listTools();
    assert.equal(stillWorks.tools.length, 1);
});

test('no DIRECT_PROGRESS_URL configured is a soft failure, not a crash', async (t) => {
    const { client, close } = await connectToServer({});
    t.after(() => close());

    const result = await client.callTool({ name: 'report_progress', arguments: { note: 'hello' } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /DIRECT_PROGRESS_URL/);
});

test('postProgress() reports ok:false without throwing when the URL is unset', async () => {
    const result = await postProgress({ note: 'hi' }, { progressUrl: undefined, token: 'x' });
    assert.deepEqual(result, { ok: false, reason: 'DIRECT_PROGRESS_URL is not set - nowhere to report progress to' });
});

test('postProgress() reports ok:false without throwing when the request errors', async () => {
    const failingFetch = async () => {
        throw new Error('connect ECONNREFUSED');
    };
    const result = await postProgress(
        { note: 'hi' },
        { progressUrl: 'http://127.0.0.1:1/progress', token: 'x', fetchImpl: failingFetch },
    );
    assert.equal(result.ok, false);
    assert.match(result.reason, /ECONNREFUSED/);
});

test('postProgress() reports ok:false without throwing on a non-2xx response', async () => {
    const fetchImpl = async () => new Response('nope', { status: 503, statusText: 'Service Unavailable' });
    const result = await postProgress({ note: 'hi' }, { progressUrl: 'http://example.invalid/progress', token: 'x', fetchImpl });
    assert.equal(result.ok, false);
    assert.match(result.reason, /503/);
});

test('buildReport() only includes fields that were actually provided', () => {
    assert.deepEqual(buildReport({}), {});
    assert.deepEqual(buildReport({ note: 'hi' }), { note: 'hi' });
    assert.deepEqual(buildReport({ plan: ['a'], completed: [] }), { plan: ['a'], completed: [] });
    assert.deepEqual(buildReport(undefined), {});
});
