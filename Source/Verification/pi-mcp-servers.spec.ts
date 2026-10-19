// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { ExtensionAPI, ExtensionContext, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { createServerBridge } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/ServerBridge.ts';
import { StdioConnection } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/StdioConnection.ts';
import { selectedCorpusServers } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/servers.ts';
import type { CorpusServer } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/CorpusServer.ts';
import { fakeChild, projectFixture } from './pi-mcp-helpers.ts';

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

test('only servers whose profiles are selected are loaded, including through composition', () => {
    const servers = [screenplay, playwright, codescene];
    assert.deepEqual(ids(serversFixture(servers, { profiles: ['cratis/playwright'] })), ['playwright']);
    assert.deepEqual(ids(serversFixture(servers, { profiles: ['cratis/playwright', 'cratis/codescene'] })), ['playwright', 'codescene']);
    assert.deepEqual(ids(serversFixture(servers, { profiles: ['bundle'] })), ['playwright', 'codescene']);
    assert.deepEqual(ids(serversFixture(servers, { profiles: ['cratis/screenplay'] })), [], 'Screenplay keeps its own bridge path');
    assert.deepEqual(ids(serversFixture(servers, {})), []);
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
        ['profiles', { profiles: [] }],
        ['id', { id: 'bad id' }],
        ['env', { env: { KEY: 1 } }],
        ['env', { env: ['A=b'] }],
    ];
    for (const [reason, change] of malformed) {
        const fixture = serversFixture([{ ...playwright, ...change }, codescene]);
        const selection = selectedCorpusServers(fixture.project, fixture.corpus);
        assert.deepEqual(selection.servers.map(server => server.id), ['codescene'], reason);
        assert.equal(selection.messages.length, 1, reason);
        assert.match(selection.messages[0], new RegExp(reason === 'id' ? 'id must match' : reason === 'profiles' ? 'profiles' : reason));
    }
});

test('malformed servers that are not selected are ignored silently, unknown fields are ignored', () => {
    const fixture = serversFixture([{ ...codescene, transport: 'http', command: '' }, { ...playwright, future: true }], { profiles: ['cratis/playwright'] });
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

function harness(fixture: ReturnType<typeof serversFixture>, behaviors: Record<string, 'ok' | 'exit'> = {}) {
    const registered = new Map<string, ToolDefinition>();
    const launched: CorpusServer[] = [];
    const notices: string[] = [];
    const requests: Array<Record<string, unknown>> = [];
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
        const child = fakeChild();
        child.onRequest(request => {
            requests.push({ server: server.id, ...request });
            if (behaviors[server.id] === 'exit') { child.exit(); return; }
            if (request.method === 'initialize') child.result(request, { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: server.id } });
            if (request.method === 'tools/list') child.result(request, { tools: [{ name: 'browser-navigate', description: 'Go', inputSchema: { type: 'object' } }] });
            if (request.method === 'tools/call') child.result(request, { content: [{ type: 'text', text: `ran ${server.id}` }] });
        });
        return new StdioConnection(child.child, 1000, server.id);
    });
    return { bridge, context, registered, launched, notices, requests, active: () => active };
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

test('a crash of one server leaves the other usable', async () => {
    const run = harness(serversFixture([playwright, codescene]));
    await run.bridge.refresh(run.context, true);
    assert.deepEqual([...run.registered.keys()].sort(), ['codescene_browser_navigate', 'playwright_browser_navigate']);
    const crashing = run.registered.get('codescene_browser_navigate')!;
    run.bridge.dispose();
    await assert.rejects(crashing.execute('call', {}, undefined, undefined, run.context), /unavailable/);
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
