// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import type { spawn } from 'node:child_process';
import test from 'node:test';
import { ConnectionFailure } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/ConnectionFailure.ts';
import { discover, mapResult } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/protocol.ts';
import { startConnection } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/process.ts';
import { StdioConnection } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/StdioConnection.ts';
import { fakeChild, tool } from './pi-mcp-helpers.ts';

test('Screenplay launches only the native CLI with a physical project argument and no shell', t => {
    const child = fakeChild();
    let invocation: unknown[] = [];
    const launch = ((...arguments_: unknown[]) => { invocation = arguments_; return child.child; }) as unknown as typeof spawn;
    const connection = startConnection('/physical/project with spaces', launch);
    t.after(() => connection.dispose());
    assert.equal(invocation[0], 'cratis');
    assert.deepEqual(invocation[1], ['screenplay', 'mcp', '--project-root', '/physical/project with spaces']);
    const options = invocation[2] as { shell: boolean; cwd: string; stdio: string[] };
    assert.equal(options.shell, false);
    assert.equal(options.cwd, '/physical/project with spaces');
    assert.deepEqual(options.stdio, ['pipe', 'pipe', 'pipe']);
});

test('Screenplay negotiates initialization and discovers the exact live schemas', async t => {
    const child = fakeChild();
    const connection = new StdioConnection(child.child);
    t.after(() => connection.dispose());
    const definition = tool('diagnostics', { limit: { type: 'integer', minimum: 1, maximum: 200 } });
    child.onRequest(request => {
        if (request.method === 'initialize') child.result(request, { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'cratis.screenplay' } });
        if (request.method === 'tools/list') child.result(request, { tools: [definition] });
    });
    const tools = await discover(connection);
    assert.equal(tools.length, 1);
    assert.equal(tools[0].nativeName, 'screenplay_diagnostics');
    assert.deepEqual(tools[0].parameters, definition.inputSchema);
    assert.deepEqual(child.requests.map(request => request.method), ['initialize', 'notifications/initialized', 'tools/list']);
});

test('Screenplay transport rejects malformed, mismatched and unsolicited protocol data', async () => {
    for (const line of ['not json\n', '{"jsonrpc":"2.0","id":99,"result":{}}\n', '{"jsonrpc":"2.0","method":"tools/list_changed"}\n', '{"jsonrpc":"2.0","id":1,"result":{},"error":{}}\n']) {
        const child = fakeChild();
        const connection = new StdioConnection(child.child);
        const response = connection.request('tools/list', {});
        child.child.stdout.emit('data', Buffer.from(line));
        await assert.rejects(response, /malformed or unexpected/);
        assert.equal(connection.stopped, true);
        assert.equal(child.child.killed, true);
    }
});

test('Screenplay transport bounds unterminated response lines and outgoing requests', async () => {
    const child = fakeChild();
    const connection = new StdioConnection(child.child);
    await assert.rejects(connection.request('tools/call', { content: 'x'.repeat(8 * 1024 * 1024) }), /8 MiB/);
    assert.equal(child.requests.length, 0);
    const response = connection.request('tools/list', {});
    child.child.stdout.emit('data', Buffer.alloc(8 * 1024 * 1024 + 1, 120));
    await assert.rejects(response, /8 MiB/);
});

test('Screenplay transport rejects concurrent requests instead of growing a queue', async t => {
    const child = fakeChild();
    const connection = new StdioConnection(child.child);
    t.after(() => connection.dispose());
    const first = connection.request('tools/list', {});
    await assert.rejects(connection.request('tools/list', {}), /busy/);
    child.result(child.requests[0], { tools: [] });
    assert.deepEqual(await first, { tools: [] });
    assert.equal(child.requests.length, 1);
});

test('Screenplay transport decodes fragmented UTF-8 lines', async t => {
    const child = fakeChild();
    const connection = new StdioConnection(child.child);
    t.after(() => connection.dispose());
    const response = connection.request('ping', {});
    const bytes = Buffer.from('{"jsonrpc":"2.0","id":1,"result":{"value":"é"}}\n');
    const split = bytes.indexOf(Buffer.from('é')) + 1;
    child.child.stdout.emit('data', bytes.subarray(0, split));
    child.child.stdout.emit('data', bytes.subarray(split));
    assert.deepEqual(await response, { value: 'é' });
});

test('Screenplay child exit during a mutation is uncertain and never retried', async () => {
    const child = fakeChild();
    const connection = new StdioConnection(child.child);
    const response = connection.request('tools/call', { name: 'apply' }, undefined, true);
    child.exit();
    await assert.rejects(response, (error: unknown) => error instanceof ConnectionFailure && error.outcomeUnknown && /Do not retry/.test(error.message));
    await assert.rejects(connection.request('tools/call', { name: 'apply' }), /outcome is unknown/);
    assert.equal(child.requests.length, 1);
});

test('Screenplay mutation protocol errors remain uncertain failures', async () => {
    const child = fakeChild();
    const connection = new StdioConnection(child.child);
    child.onRequest(request => child.protocolError(request));
    await assert.rejects(connection.request('tools/call', { name: 'apply' }, undefined, true), /protocol error.*outcome is unknown/);
    assert.equal(connection.outcomeUnknown, true);
});

test('Screenplay cancellation before sending has no effects', async t => {
    const child = fakeChild();
    const connection = new StdioConnection(child.child);
    t.after(() => connection.dispose());
    const cancellation = new AbortController();
    cancellation.abort();
    await assert.rejects(connection.request('tools/call', {}, cancellation.signal, true), /before sending/);
    assert.equal(connection.outcomeUnknown, false);
    assert.equal(child.requests.length, 0);
});

test('Screenplay cancellation after a mutation is sent is an unknown outcome', async () => {
    const child = fakeChild();
    const connection = new StdioConnection(child.child);
    const cancellation = new AbortController();
    const response = connection.request('tools/call', {}, cancellation.signal, true);
    cancellation.abort();
    await assert.rejects(response, /cancelled.*outcome is unknown/);
    assert.equal(child.requests.length, 1);
});

test('Screenplay request timeout is a failure, not a successful empty result', async () => {
    const child = fakeChild();
    const connection = new StdioConnection(child.child, 1);
    await assert.rejects(connection.request('tools/list', {}), /timed out/);
    assert.equal(child.child.killed, true);
});

test('Screenplay missing CLI failure is actionable without auto-installation', async () => {
    const child = fakeChild();
    const connection = new StdioConnection(child.child);
    const response = connection.request('initialize', {});
    child.child.emit('error', new Error('ENOENT'));
    await assert.rejects(response, /normal channel.*never downloads/);
    assert.equal(child.requests.length, 1);
});

test('Screenplay shutdown disposes a pending request and stream listeners', async () => {
    const child = fakeChild();
    const connection = new StdioConnection(child.child);
    const response = connection.request('tools/list', {});
    const closed = new Promise<void>(resolve => child.child.once('close', () => resolve()));
    connection.dispose();
    connection.dispose();
    await assert.rejects(response, /session closed/);
    await closed;
    assert.equal(child.child.stdout.listenerCount('data'), 0);
    assert.equal(child.child.stdout.listenerCount('end'), 0);
    assert.equal(child.child.stdin.listenerCount('error'), 0);
    assert.equal(child.child.stderr.listenerCount('data'), 0);
});

test('Screenplay result mapping retains structured failures without repeating the payload', () => {
    const structuredContent = { success: false, rollback: 'incomplete', operationId: 'operation' };
    const result = mapResult({ content: [{ type: 'text', text: JSON.stringify(structuredContent) }], structuredContent, isError: true });
    assert.equal(result.details.isError, true);
    assert.equal(result.content.length, 1);
    assert.deepEqual(result.details.structuredContent, structuredContent);
    assert.equal(result.content[0].text, JSON.stringify(structuredContent));
});

test('Screenplay display truncation is explicit and preserves structured data', () => {
    const structuredContent = { text: 'x'.repeat(40_000) };
    const result = mapResult({ content: [{ type: 'text', text: JSON.stringify(structuredContent) }], structuredContent });
    assert.equal(result.details.truncated, true);
    assert.match(result.content[0].text, /Request a smaller page/);
    assert.deepEqual(result.details.structuredContent, structuredContent);
});
