// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Writable } from 'node:stream';
import test from 'node:test';
import type { ExtensionAPI, ExtensionContext, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { createServerBridge } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/ServerBridge.ts';
import { StdioConnection } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/StdioConnection.ts';
import { discoverServer, mapServerResult } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/serverProtocol.ts';
import { selectedServer } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/configuration.ts';
import { selectedCorpusServers } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/servers.ts';
import type { CorpusServer } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/CorpusServer.ts';
import { registerBridge } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/index.ts';
import { fakeChild, projectFixture, tool } from './pi-mcp-helpers.ts';

const playwright = { id: 'playwright', profiles: ['cratis/playwright'], transport: 'stdio', command: 'npx', args: ['-y', '@playwright/mcp@0.0.83'], description: 'Browser' };
const codescene = { id: 'codescene', profiles: ['cratis/codescene'], transport: 'stdio', command: 'cs-mcp', args: [] };
const screenplay = { id: 'screenplay', profiles: ['cratis/screenplay'], transport: 'stdio', command: 'cratis', args: ['screenplay', 'mcp'] };

function serversFixture(servers: unknown[], configuration: unknown = { profiles: ['cratis/playwright', 'cratis/codescene'] }, schemaVersion = '1.0') {
    const fixture = projectFixture(configuration);
    writeFileSync(join(fixture.corpus, 'profile-catalog.json'), JSON.stringify({
        publicProfiles: [
            { id: 'cratis/screenplay', languages: ['language-agnostic'] },
            { id: 'cratis/playwright', languages: ['language-agnostic'] },
            { id: 'cratis/codescene', languages: ['language-agnostic'] },
            { id: 'bundle', composes: ['cratis/playwright', 'cratis/codescene'], languages: ['language-agnostic'] },
        ], engineeringProfiles: [],
    }));
    writeFileSync(join(fixture.corpus, 'mcp-servers.json'), JSON.stringify({ schemaVersion, servers }));
    return fixture;
}

const ids = (fixture: ReturnType<typeof serversFixture>) => selectedCorpusServers(fixture.project, fixture.corpus).servers.map(server => server.id);

test('only servers whose profiles are explicitly listed are loaded, never through composition', () => {
    const servers = [screenplay, playwright, codescene];
    assert.deepEqual(ids(serversFixture(servers, { profiles: ['cratis/playwright'] })), ['playwright']);
    assert.deepEqual(ids(serversFixture(servers, { profiles: ['cratis/playwright', 'cratis/codescene'] })), ['playwright', 'codescene']);
    assert.deepEqual(ids(serversFixture(servers, { profiles: ['bundle'] })), [], 'a profile reached only through composes never starts a generic server');
    assert.deepEqual(ids(serversFixture(servers, { profiles: ['bundle', 'cratis/codescene'] })), ['codescene']);
    assert.deepEqual(ids(serversFixture(servers, { profiles: ['cratis/screenplay'] })), [], 'Screenplay keeps its own bridge path');
    assert.deepEqual(ids(serversFixture(servers, {})), []);
});

test('Screenplay reached through composition is still selected', () => {
    const fixture = serversFixture([screenplay, playwright], { profiles: ['screenplay-bundle'] });
    writeFileSync(join(fixture.corpus, 'profile-catalog.json'), JSON.stringify({
        publicProfiles: [
            { id: 'cratis/screenplay', languages: ['language-agnostic'] },
            { id: 'cratis/playwright', languages: ['language-agnostic'] },
            { id: 'screenplay-bundle', composes: ['cratis/screenplay', 'cratis/playwright'], languages: ['language-agnostic'] },
        ], engineeringProfiles: [],
    }));
    assert.ok(selectedServer(fixture.project, fixture.corpus));
    assert.deepEqual(ids(fixture), []);
});

test('command, args and literal env are carried verbatim', () => {
    const fixture = serversFixture([{ ...playwright, env: { FIRST: '$HOME', SECOND: 'two' } }], { profiles: ['cratis/playwright'] });
    assert.deepEqual(selectedCorpusServers(fixture.project, fixture.corpus), {
        servers: [{ id: 'playwright', command: 'npx', args: ['-y', '@playwright/mcp@0.0.83'], env: { FIRST: '$HOME', SECOND: 'two' } }], messages: [],
    });
});

test('every malformed selected server is skipped with one message and the others still load', () => {
    const malformed: Array<[string, Record<string, unknown>]> = [
        ['transport', { transport: 'http' }],
        ['command', { command: '' }],
        ['command', { command: undefined }],
        ['args', { args: 'a b' }],
        ['args', { args: undefined }],
        ['id', { id: 'bad id' }],
        ['env', { env: { KEY: 1 } }],
        ['env', { env: ['A=b'] }],
    ];
    for (const [reason, change] of malformed) {
        const fixture = serversFixture([{ ...playwright, ...change }, codescene]);
        const selection = selectedCorpusServers(fixture.project, fixture.corpus);
        assert.deepEqual(selection.servers.map(server => server.id), ['codescene'], reason);
        assert.equal(selection.messages.length, 1, reason);
        assert.match(selection.messages[0], new RegExp(reason === 'id' ? 'id must match' : reason));
    }
});

test('malformed servers that are not selected are ignored silently, unknown fields are ignored', () => {
    const fixture = serversFixture([{ ...codescene, transport: 'http', command: '' }, { ...codescene, id: 'nothing', profiles: [] }, { ...codescene, id: 'missing', profiles: undefined }, { ...playwright, future: true }], { profiles: ['cratis/playwright'] });
    assert.deepEqual(selectedCorpusServers(fixture.project, fixture.corpus).messages, []);
    assert.deepEqual(ids(fixture), ['playwright']);
});

test('a duplicate id skips every entry with that id with one message', () => {
    const fixture = serversFixture([playwright, { ...playwright, command: 'other' }, codescene]);
    const selection = selectedCorpusServers(fixture.project, fixture.corpus);
    assert.deepEqual(selection.servers.map(server => server.id), ['codescene']);
    assert.equal(selection.messages.length, 1);
    assert.match(selection.messages[0], /more than once/);
});

test('mcpServers.<id>.enabled opts one server out; a non-boolean is an error for that server only', () => {
    const profiles = ['cratis/playwright', 'cratis/codescene'];
    const off = serversFixture([playwright, codescene], { profiles, mcpServers: { playwright: { enabled: false } } });
    assert.deepEqual(selectedCorpusServers(off.project, off.corpus), { servers: [{ id: 'codescene', command: 'cs-mcp', args: [], env: {} }], messages: [] });
    const invalid = serversFixture([playwright, codescene], { profiles, mcpServers: { playwright: { enabled: 'no' } } });
    const selection = selectedCorpusServers(invalid.project, invalid.corpus);
    assert.deepEqual(selection.servers.map(server => server.id), ['codescene']);
    assert.match(selection.messages.join('\n'), /enabled must be a boolean/);
    const on = serversFixture([playwright], { profiles, mcpServers: { playwright: { enabled: true } } });
    assert.deepEqual(ids(on), ['playwright']);
});

test('any 1.x schema loads; another major loads nothing with one message', () => {
    assert.deepEqual(ids(serversFixture([playwright], { profiles: ['cratis/playwright'] }, '1.7')), ['playwright']);
    const fixture = serversFixture([playwright], { profiles: ['cratis/playwright'] }, '2.0');
    const selection = selectedCorpusServers(fixture.project, fixture.corpus);
    assert.deepEqual(selection.servers, []);
    assert.equal(selection.messages.length, 1);
    assert.match(selection.messages[0], /schemaVersion/);
});

function harness(fixture: ReturnType<typeof serversFixture>, behaviors: Record<string, 'ok' | 'exit' | 'hang' | 'throw'> = {}, deadline = 15_000, timeout = 1000) {
    const children = new Map<string, ReturnType<typeof fakeChild>>();
    const registered = new Map<string, ToolDefinition>();
    const launched: CorpusServer[] = [];
    const notices: string[] = [];
    const requests: Array<Record<string, unknown>> = [];
    const toolNames: Record<string, string[]> = {};
    let active = ['read'];
    const context = { cwd: fixture.project, hasUI: true, ui: { notify: (message: string) => notices.push(message) } } as unknown as ExtensionContext;
    const api = {
        registerTool(definition: ToolDefinition) { if (!registered.has(definition.name)) active.push(definition.name); registered.set(definition.name, definition); },
        getActiveTools: () => [...active],
        getAllTools: () => [...registered.values()],
        setActiveTools(names: string[]) { active = names; },
    } as unknown as ExtensionAPI;
    const bridge = createServerBridge(api, fixture.corpus, (project: string, server: CorpusServer) => {
        assert.equal(project, fixture.project);
        launched.push(server);
        if (behaviors[server.id] === 'throw') throw new Error('synchronous connection failure');
        const child = fakeChild();
        children.set(server.id, child);
        child.onRequest(request => {
            requests.push({ server: server.id, ...request });
            if (behaviors[server.id] === 'exit') { child.exit(); return; }
            if (behaviors[server.id] === 'hang') return;
            if (request.method === 'initialize') child.result(request, { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: server.id } });
            if (request.method === 'tools/list') child.result(request, { tools: (toolNames[server.id] ?? ['browser-navigate']).map(name => ({ name, description: 'Go', inputSchema: { type: 'object' } })) });
            if (request.method === 'tools/call') child.result(request, { content: [{ type: 'text', text: `ran ${server.id}` }] });
        });
        return new StdioConnection(child.child, timeout, server.id, true);
    }, deadline);
    return { setTools(names: Record<string, string[]>) { Object.assign(toolNames, names); }, children, bridge, context, registered, launched, notices, requests, active: () => active };
}

test('a selected server starts with its own connection and namespaced tools, and executes calls', async () => {
    const fixture = serversFixture([screenplay, playwright, codescene], { profiles: ['cratis/playwright'] });
    const run = harness(fixture);
    await run.bridge.refresh(run.context, true);
    assert.deepEqual(run.launched.map(server => server.id), ['playwright']);
    assert.deepEqual([...run.registered.keys()], ['playwright_browser_navigate']);
    assert.ok(run.active().includes('playwright_browser_navigate'));
    const result = await run.registered.get('playwright_browser_navigate')!.execute('call', {}, undefined, undefined, run.context);
    assert.deepEqual(result.content, [{ type: 'text', text: 'ran playwright' }]);
    run.bridge.dispose();
    assert.equal(run.active().includes('playwright_browser_navigate'), false);
});

test('nothing starts without a selected server profile', async () => {
    const run = harness(serversFixture([playwright, codescene], { profiles: ['cratis/screenplay'] }));
    await run.bridge.refresh(run.context, true);
    assert.deepEqual(run.launched, []);
    assert.deepEqual(run.notices, []);
});

test('a server that fails to start does not stop the others and is reported once', async () => {
    const fixture = serversFixture([playwright, codescene]);
    const run = harness(fixture, { codescene: 'exit' });
    await run.bridge.refresh(run.context, true);
    assert.deepEqual([...run.registered.keys()], ['playwright_browser_navigate']);
    assert.equal(run.notices.length, 1);
    assert.match(run.notices[0], /'codescene' is unavailable/);
    await run.bridge.refresh(run.context, false);
    assert.equal(run.notices.length, 1, 'unchanged selection does not retry or repeat the notice');
});

test('a synchronous connection failure leaves other servers registered and reports unavailable', async () => {
    const run = harness(serversFixture([codescene, playwright]), { codescene: 'throw' });
    try {
        await run.bridge.refresh(run.context, true);
        assert.deepEqual(run.launched.map(server => server.id), ['codescene', 'playwright']);
        assert.deepEqual([...run.registered.keys()], ['playwright_browser_navigate']);
        assert.deepEqual(run.notices, ["MCP server 'codescene' is unavailable: synchronous connection failure"]);
        const result = await run.registered.get('playwright_browser_navigate')!.execute('call', {}, undefined, undefined, run.context);
        assert.deepEqual(result.content, [{ type: 'text', text: 'ran playwright' }]);
    } finally {
        run.bridge.dispose();
    }
});

test('a crash of one server leaves the other usable', async () => {
    const run = harness(serversFixture([playwright, codescene]));
    await run.bridge.refresh(run.context, true);
    run.children.get('codescene')!.exit();
    await new Promise(resolve => setImmediate(resolve));
    await assert.rejects(run.registered.get('codescene_browser_navigate')!.execute('call', {}, undefined, undefined, run.context), /unavailable|exited|closed/);
    const result = await run.registered.get('playwright_browser_navigate')!.execute('call', {}, undefined, undefined, run.context);
    assert.deepEqual(result.content, [{ type: 'text', text: 'ran playwright' }]);
});

test('a server that never answers initialize is abandoned at the deadline while the others start in parallel', async () => {
    const run = harness(serversFixture([codescene, playwright]), { codescene: 'hang' }, 150, 60_000);
    const started = Date.now();
    await run.bridge.refresh(run.context, true);
    assert.ok(Date.now() - started < 5000, 'session start is bounded by the per-server deadline, not the request timeout');
    const order = run.requests.filter(request => request.method === 'initialize').map(request => request.server);
    assert.deepEqual(order, ['codescene', 'playwright'], 'the second server initializes without waiting for the hung one');
    assert.ok(run.requests.some(request => request.server === 'playwright' && request.method === 'tools/list'));
    assert.deepEqual([...run.registered.keys()], ['playwright_browser_navigate']);
    assert.match(run.notices.join('\n'), /'codescene' is unavailable: .*did not become ready/);
    const result = await run.registered.get('playwright_browser_navigate')!.execute('call', {}, undefined, undefined, run.context);
    assert.deepEqual(result.content, [{ type: 'text', text: 'ran playwright' }]);
});

test('a tool-name collision is won by the earlier server in selection order, however readiness is ordered', async () => {
    // 'a' + 'b_x' and 'a_b' + 'x' both namespace to a_b_x; the first selected server wins.
    const first = { ...codescene, id: 'a_b' };
    const second = { ...playwright, id: 'a' };
    const fixture = serversFixture([{ ...first, profiles: ['cratis/codescene'] }, { ...second, profiles: ['cratis/playwright'] }]);
    const run = harness(fixture);
    run.setTools({ a_b: ['x'], a: ['b_x'] });
    await run.bridge.refresh(run.context, true);
    assert.equal(run.registered.get('a_b_x')!.label, 'a_b x');
    assert.match(run.notices.join('\n'), /'a' tool 'b_x' was skipped/);
});

test('third-party server notifications are ignored and server requests are refused with -32601', async () => {
    const fixture = serversFixture([playwright], { profiles: ['cratis/playwright'] });
    const run = harness(fixture);
    await run.bridge.refresh(run.context, true);
    const child = run.children.get('playwright')!;
    (child.child.stdout as unknown as Writable).write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/message' })}\n`);
    (child.child.stdout as unknown as Writable).write(`${JSON.stringify({ jsonrpc: '2.0', id: 'srv-1', method: 'roots/list' })}\n`);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(child.requests.at(-1), { jsonrpc: '2.0', id: 'srv-1', error: { code: -32601, message: 'Method not found' } });
    const result = await run.registered.get('playwright_browser_navigate')!.execute('call', {}, undefined, undefined, run.context);
    assert.deepEqual(result.content, [{ type: 'text', text: 'ran playwright' }]);
});

test('oversized tools are skipped and unsupported or oversized images are replaced by a note', () => {
    assert.equal(mapServerResult({ content: [{ type: 'image', data: 'AAAA', mimeType: 'image/svg+xml' }] }, 'p').content[0].type, 'text');
    assert.equal(mapServerResult({ content: [{ type: 'image', data: 'x'.repeat(3 * 1024 * 1024), mimeType: 'image/png' }] }, 'p').content[0].type, 'text');
    assert.equal(mapServerResult({ content: [{ type: 'image', data: 'AAAA', mimeType: 'image/png' }] }, 'p').content[0].type, 'image');
});

test('tools with an oversized description or schema are skipped with a message', async () => {
    const child = fakeChild();
    child.onRequest(request => {
        if (request.method === 'initialize') child.result(request, { capabilities: { tools: {} } });
        if (request.method === 'tools/list') child.result(request, { tools: [
            { name: 'ok', inputSchema: { type: 'object' } },
            { name: 'long', description: 'x'.repeat(5000), inputSchema: { type: 'object' } },
            { name: 'wide', inputSchema: { type: 'object', properties: { a: { description: 'x'.repeat(70_000) } } } },
        ] });
    });
    const catalog = await discoverServer(new StdioConnection(child.child, 1000, 'p', true), 'p');
    assert.deepEqual(catalog.tools.map(tool => tool.nativeName), ['p_ok']);
    assert.equal(catalog.messages.length, 2);
});

test('registerBridge runs Screenplay and a generic server side by side, each isolated', async () => {
    const fixture = serversFixture([screenplay, playwright], { profiles: ['cratis/screenplay', 'cratis/playwright'] });
    const registered = new Map<string, ToolDefinition>();
    const handlers = new Map<string, Array<(event: Record<string, unknown>, context: ExtensionContext) => unknown>>();
    let active = ['read'];
    const context = { cwd: fixture.project, hasUI: true, ui: { notify() { /* not asserted */ } } } as unknown as ExtensionContext;
    const api = {
        registerTool(definition: ToolDefinition) { if (!registered.has(definition.name)) active.push(definition.name); registered.set(definition.name, definition); },
        getActiveTools: () => [...active],
        getAllTools: () => [...registered.values()],
        setActiveTools(names: string[]) { active = names; },
        on(name: string, handler: (event: Record<string, unknown>, context: ExtensionContext) => unknown) { handlers.set(name, [...(handlers.get(name) ?? []), handler]); },
    } as unknown as ExtensionAPI;
    const screenplayChild = fakeChild();
    screenplayChild.onRequest(request => {
        if (request.method === 'initialize') screenplayChild.result(request, { protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'cratis.screenplay' } });
        if (request.method === 'tools/list') screenplayChild.result(request, { tools: [tool('diagnostics')] });
        if (request.method === 'tools/call') screenplayChild.result(request, { content: [{ type: 'text', text: 'ran screenplay' }] });
    });
    const genericChild = fakeChild();
    genericChild.onRequest(request => {
        if (request.method === 'initialize') genericChild.result(request, { capabilities: { tools: {} } });
        if (request.method === 'tools/list') genericChild.result(request, { tools: [{ name: 'navigate', inputSchema: { type: 'object' } }] });
        if (request.method === 'tools/call') genericChild.result(request, { content: [{ type: 'text', text: 'ran playwright' }] });
    });
    registerBridge(api, fixture.corpus, () => new StdioConnection(screenplayChild.child, 1000), async () => true,
        (_project, server) => { assert.equal(server.id, 'playwright'); return new StdioConnection(genericChild.child, 1000, server.id, true); });
    for (const handler of handlers.get('session_start') ?? []) await handler({}, context);
    assert.deepEqual([...registered.keys()].sort(), ['playwright_navigate', 'screenplay_diagnostics']);
    assert.equal((await registered.get('screenplay_diagnostics')!.execute('c', {}, undefined, undefined, context)).content[0].type, 'text');
    genericChild.exit();
    await new Promise(resolve => setImmediate(resolve));
    await assert.rejects(registered.get('playwright_navigate')!.execute('c', {}, undefined, undefined, context));
    const survivor = await registered.get('screenplay_diagnostics')!.execute('c', {}, undefined, undefined, context);
    assert.deepEqual(survivor.content, [{ type: 'text', text: 'ran screenplay' }]);
});

test('skip messages from the selection are surfaced when the context has a UI', async () => {
    const run = harness(serversFixture([{ ...playwright, transport: 'http' }, codescene]));
    await run.bridge.refresh(run.context, true);
    assert.equal(run.notices.length, 1);
    assert.match(run.notices[0], /only the stdio transport/);
    assert.deepEqual(run.launched.map(server => server.id), ['codescene']);
});

test('capabilities.json tells the CLI that Pi handles every selected server', () => {
    const path = join(import.meta.dirname, '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/capabilities.json');
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), { servers: 'selected-profiles' });
});
