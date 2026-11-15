// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { StdioConnection } from '../../.cratis/ai/harnesses/pi/extensions/cratis-mcp/StdioConnection.ts';
import { fakeChild, fakeServerConnect, nativeHarness, projectFixture, tool } from './pi-mcp-helpers.ts';

test('native Screenplay bridge does not start children or register tools for inactive/opted-out projects', async () => {
    for (const config of [{ profiles: ['other'] }, { profiles: ['cratis/screenplay'], mcpServers: { screenplay: { enabled: false } } }]) {
        const harness = nativeHarness(projectFixture(config));
        await harness.event('session_start');
        await harness.event('before_agent_start');
        assert.equal(harness.children.length, 0);
        assert.equal(harness.registered.size, 0);
    }
});

const deferredFixture = (configuration: unknown = { profiles: ['cratis/screenplay'] }) => projectFixture(configuration, undefined, []);
const enableScreenplay = (harness: ReturnType<typeof nativeHarness>) => harness.call('cratis_enable_mcp', { server: 'screenplay' });
const text = (result: { content: Array<{ type: string; text?: string }> }) => result.content.map(part => part.text).join('\n');

test('native Screenplay bridge defers: only cratis_enable_mcp is registered, no schema and no child before activation', async t => {
    const harness = nativeHarness(deferredFixture());
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    await harness.event('before_agent_start');
    assert.deepEqual([...harness.registered.keys()], ['cratis_enable_mcp']);
    assert.equal(harness.children.length, 0);
    assert.deepEqual(harness.registered.get('cratis_enable_mcp')?.parameters, { type: 'object', properties: { server: { type: 'string', enum: ['screenplay'] } }, required: ['server'], additionalProperties: false });
});

test('cratis_enable_mcp registers exactly the discovered schemas and says they are available from the next step', async t => {
    const tools = [tool('diagnostics', { limit: { type: 'integer' } }), tool('workspace-state')];
    const harness = nativeHarness(deferredFixture(), tools);
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    const result = await enableScreenplay(harness);
    assert.match(text(result), /next step.*screenplay_diagnostics, screenplay_workspace_state/);
    assert.deepEqual([...harness.registered.keys()], ['cratis_enable_mcp', 'screenplay_diagnostics', 'screenplay_workspace_state']);
    assert.deepEqual(harness.registered.get('screenplay_diagnostics')?.parameters, tools[0].inputSchema);
    assert.ok(harness.api.getActiveTools().includes('screenplay_diagnostics'));
    await harness.event('before_agent_start');
    assert.equal(harness.children.length, 1, 'an unchanged selection keeps the activated server');
});

test('cratis_enable_mcp twice, even concurrently, starts one child', async t => {
    const harness = nativeHarness(deferredFixture());
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    const [first, second] = await Promise.all([enableScreenplay(harness), enableScreenplay(harness)]);
    assert.equal(text(first), text(second));
    assert.match(text(await enableScreenplay(harness)), /already enabled.*screenplay_diagnostics/);
    assert.equal(harness.children.length, 1);
});

test('eager: true registers at session_start without cratis_enable_mcp', async t => {
    const harness = nativeHarness(projectFixture());
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    assert.deepEqual([...harness.registered.keys()], ['screenplay_diagnostics', 'screenplay_apply']);
});

test('a non-boolean mcpServers.screenplay.eager is an error and registers nothing', async () => {
    const harness = nativeHarness(projectFixture({ profiles: ['cratis/screenplay'], mcpServers: { screenplay: { eager: 'yes' } } }));
    await assert.rejects(harness.event('session_start'), /eager must be a boolean/);
    assert.equal(harness.registered.size, 0);
});

test('a failed enable is a tool error and a later enable retries', async t => {
    let attempts = 0;
    const fixture = deferredFixture();
    const children: ReturnType<typeof fakeChild>[] = [];
    const connect = fakeServerConnect(fixture, [tool('diagnostics'), tool('apply')], children);
    const harness = nativeHarness(fixture, undefined, [], async () => true, project => {
        if (++attempts === 1) throw new Error('Cannot spawn');
        return connect(project);
    });
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    await assert.rejects(enableScreenplay(harness), /Cannot spawn/);
    assert.equal(harness.registered.size, 1);
    assert.match(text(await enableScreenplay(harness)), /is enabled/);
    assert.ok(harness.registered.has('screenplay_apply'));
    assert.equal(children.length, 1);
});

test('an unavailable CLI is a tool error at enable time for application-only projects', async t => {
    const harness = nativeHarness(deferredFixture({ profiles: ['cratis/application'] }), undefined, [], async () => false);
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    assert.equal(harness.notices.length, 0);
    await assert.rejects(enableScreenplay(harness), /3\.46\.1/);
    assert.equal(harness.children.length, 0);
});

test('a selection change after enable rejects tool calls and returns the server to deferred until enabled again', async t => {
    const fixture = deferredFixture();
    const harness = nativeHarness(fixture);
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    await enableScreenplay(harness);
    mkdirSync(join(fixture.project, 'other-model'));
    fixture.configure({ profiles: ['cratis/screenplay'], mcpServers: { screenplay: { root: 'other-model' } } });
    await assert.rejects(harness.call('screenplay_diagnostics'), /profile\/root changed/);
    assert.equal(harness.children[0].child.killed, true);
    assert.equal(harness.children.length, 1, 'nothing restarts without a new enable');
    await enableScreenplay(harness);
    assert.equal(harness.children.length, 2);
    assert.equal((await harness.call('screenplay_diagnostics')).content.length, 1);
});

test('host-excluded and user-disabled tools stay inactive after enable', async t => {
    const harness = nativeHarness(deferredFixture(), [tool('diagnostics'), tool('apply')], ['screenplay_apply']);
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    await enableScreenplay(harness);
    assert.equal(harness.api.getActiveTools().includes('screenplay_apply'), false);
    await assert.rejects(harness.call('screenplay_apply'), /inactive/);
    harness.api.setActiveTools(['read', 'cratis_enable_mcp']);
    await harness.event('session_start');
    await enableScreenplay(harness);
    assert.equal(harness.api.getActiveTools().includes('screenplay_diagnostics'), false, 'a tool the user disabled is not re-enabled');
});

test('after enable, mutation still needs confirmation and an unknown outcome blocks every retry', async t => {
    const harness = nativeHarness(deferredFixture());
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    await enableScreenplay(harness);
    harness.approve(false);
    await assert.rejects(harness.call('screenplay_apply'), /not approved/);
    harness.approve(true);
    harness.children[0].onRequest(() => harness.children[0].exit());
    await assert.rejects(harness.call('screenplay_apply'), /outcome is unknown/);
    await assert.rejects(enableScreenplay(harness), /outcome remains unknown/);
    assert.equal(harness.children.length, 1);
});

test('full deferred flow: enable, read workspace state, propose, then apply after confirmation', async t => {
    const harness = nativeHarness(deferredFixture(), [tool('workspace-state'), tool('propose-ast'), tool('apply')]);
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    await enableScreenplay(harness);
    await harness.call('screenplay_workspace_state');
    await harness.call('screenplay_propose_ast');
    await harness.call('screenplay_apply', { proposalId: 'reviewed' });
    assert.equal(harness.confirmations, 1);
    assert.deepEqual(harness.children[0].requests.filter(request => request.method === 'tools/call').map(request => (request.params as { name: string }).name), ['workspace-state', 'propose-ast', 'apply']);
});

test('an opted-out or non-Screenplay project never registers cratis_enable_mcp', async () => {
    for (const config of [{ profiles: ['other'] }, { profiles: ['cratis/screenplay'], mcpServers: { screenplay: { enabled: false } } }]) {
        const harness = nativeHarness(deferredFixture(config));
        await harness.event('session_start');
        assert.equal(harness.registered.size, 0);
    }
});

test('native Screenplay bridge registers exactly discovered schemas without startup writes', async t => {
    const fixture = projectFixture();
    const tools = [tool('diagnostics', { limit: { type: 'integer' } }), tool('workspace-state'), tool('propose-ast')];
    const harness = nativeHarness(fixture, tools);
    t.after(() => harness.event('session_shutdown'));
    const before = readdirSync(fixture.project, { recursive: true });
    assert.equal(harness.children.length, 0, 'factory must not start a process');
    await harness.event('session_start');
    assert.deepEqual([...harness.registered.keys()], ['screenplay_diagnostics', 'screenplay_workspace_state', 'screenplay_propose_ast']);
    assert.deepEqual(harness.registered.get('screenplay_diagnostics')?.parameters, tools[0].inputSchema);
    assert.equal(harness.registered.get('screenplay_propose_ast')?.executionMode, 'sequential');
    assert.deepEqual(readdirSync(fixture.project, { recursive: true }), before);
    assert.ok(harness.api.getActiveTools().includes('read'));
});

test('native Screenplay bridge honors host excluded tools and user-disabled tools', async t => {
    const harness = nativeHarness(projectFixture(), [tool('diagnostics'), tool('apply')], ['screenplay_apply']);
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    assert.equal(harness.api.getActiveTools().includes('screenplay_apply'), false);
    await assert.rejects(harness.call('screenplay_apply'), /inactive/);
    harness.api.setActiveTools(['read']);
    await harness.event('before_agent_start');
    assert.deepEqual(harness.api.getActiveTools(), ['read']);
    await assert.rejects(harness.call('screenplay_diagnostics'), /inactive/);
});

test('native Screenplay mutation requires a confirmed user decision and sends only the discovered server name', async t => {
    const harness = nativeHarness(projectFixture());
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    harness.approve(false);
    await assert.rejects(harness.call('screenplay_apply', { proposalId: 'reviewed' }), /not approved/);
    assert.equal(harness.children[0].requests.filter(request => request.method === 'tools/call').length, 0);
    harness.approve(true);
    await harness.call('screenplay_apply', { proposalId: 'reviewed' });
    assert.equal(harness.confirmations, 2);
    assert.deepEqual(harness.children[0].requests.at(-1)?.params, { name: 'apply', arguments: { proposalId: 'reviewed' } });
});

test('native Screenplay mutation refuses headless execution but read tools remain usable', async t => {
    const harness = nativeHarness(projectFixture());
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    harness.context.hasUI = false;
    await assert.rejects(harness.call('screenplay_apply'), /interactive\/RPC/);
    assert.equal((await harness.call('screenplay_diagnostics')).content.length, 1);
});

test('native Screenplay failed results throw and restore structured server errors through tool_result', async t => {
    const harness = nativeHarness(projectFixture());
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    const child = harness.children[0];
    child.onRequest(request => child.result(request, { content: [{ type: 'text', text: 'Rollback incomplete' }], structuredContent: { recoveryRequired: true }, isError: true }));
    await assert.rejects(harness.call('screenplay_apply'), /failed tool call/);
    const result = await harness.event('tool_result', { toolName: 'screenplay_apply', toolCallId: 'call-id', isError: true });
    assert.deepEqual(result, {
        content: [{ type: 'text', text: 'Rollback incomplete' }],
        details: { structuredContent: { recoveryRequired: true }, isError: true, truncated: false }, isError: true,
    });
});

test('native Screenplay disconnect during apply disables tools and never automatically restarts', async t => {
    const harness = nativeHarness(projectFixture());
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    harness.children[0].onRequest(() => harness.children[0].exit());
    await assert.rejects(harness.call('screenplay_apply'), /outcome is unknown/);
    await harness.event('before_agent_start');
    await assert.rejects(harness.event('session_start'), /outcome remains unknown/);
    assert.equal(harness.children.length, 1);
    assert.deepEqual(harness.api.getActiveTools(), ['read']);
});

test('native Screenplay root changes close the old child and invalidate old tools before rediscovery', async t => {
    const fixture = projectFixture();
    const harness = nativeHarness(fixture);
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    mkdirSync(join(fixture.project, 'other-model'));
    fixture.configure({ profiles: ['cratis/screenplay'], mcpServers: { screenplay: { root: 'other-model' } } });
    await assert.rejects(harness.call('screenplay_diagnostics'), /profile\/root changed/);
    assert.equal(harness.children[0].child.killed, true);
    await harness.event('before_agent_start');
    assert.equal(harness.children.length, 2);
});

test('native Screenplay profile opt-out stops the child and deactivates all its tools', async () => {
    const fixture = projectFixture();
    const harness = nativeHarness(fixture);
    await harness.event('session_start');
    fixture.configure({ profiles: ['other'] });
    await harness.event('before_agent_start');
    assert.equal(harness.children[0].child.killed, true);
    assert.deepEqual(harness.api.getActiveTools(), ['read']);
    await assert.rejects(harness.call('screenplay_apply'), /profile\/root changed/);
});

test('native Screenplay rejects unsupported discovery before exposing any tools', async () => {
    const futureMutation = tool('future-write');
    futureMutation.annotations.readOnlyHint = false;
    for (const catalog of [[], [tool('diagnostics'), tool('diagnostics')], [futureMutation]]) {
        const harness = nativeHarness(projectFixture(), catalog);
        await assert.rejects(harness.event('session_start'), /catalog|Duplicate|Unrecognized/);
        assert.equal(harness.registered.size, 0);
        assert.equal(harness.children[0].child.killed, true);
    }
});

test('native Screenplay recover-workspace requires confirmation just like apply', async t => {
    const harness = nativeHarness(projectFixture(), [tool('recover-workspace')]);
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    harness.approve(false);
    await assert.rejects(harness.call('screenplay_recover_workspace', { operationId: 'interrupted' }), /not approved/);
    assert.equal(harness.children[0].requests.filter(request => request.method === 'tools/call').length, 0);
});

test('native Screenplay shutdown is idempotent and blocks previous-session tools', async () => {
    const harness = nativeHarness(projectFixture());
    await harness.event('session_start');
    await harness.event('session_shutdown');
    await harness.event('session_shutdown');
    assert.equal(harness.children[0].child.killed, true);
    assert.deepEqual(harness.api.getActiveTools(), ['read']);
    await assert.rejects(harness.call('screenplay_diagnostics'), /connection is unavailable/);
});

for (const reason of ['missing', 'old']) {
    test(`application-only Screenplay quietly skips a ${reason} CLI without launching MCP`, async t => {
        const fixture = projectFixture(
            { profiles: ['cratis/application/elixir'], languages: ['elixir'] },
            resolve(import.meta.dirname, '../../.cratis/ai'),
        );
        const harness = nativeHarness(fixture, undefined, [], async () => false);
        t.after(() => harness.event('session_shutdown'));
        const before = readdirSync(fixture.project, { recursive: true });
        await harness.event('session_start');
        await harness.event('before_agent_start');
        assert.equal(harness.children.length, 0);
        assert.equal(harness.registered.size, 0);
        assert.deepEqual(harness.api.getActiveTools(), ['read']);
        assert.deepEqual(harness.versionProjects, [fixture.project]);
        assert.equal(harness.notices.length, 1);
        assert.equal(harness.notices[0].type, 'info');
        assert.match(harness.notices[0].message, /Screenplay MCP is unavailable.*3\.46\.1/);
        assert.deepEqual(readdirSync(fixture.project, { recursive: true }), before);
        fixture.configure({ profiles: ['cratis/application/react'], languages: ['typescript', 'react'] });
        await harness.event('before_agent_start');
        fixture.configure({ profiles: ['cratis/application/elixir'], languages: ['elixir'] });
        await harness.event('before_agent_start');
        assert.deepEqual(harness.versionProjects, [fixture.project], 'failed version checks are cached too');
        assert.equal(harness.notices.length, 1, 'at most one notice per session');
    });
}

for (const profiles of [
    ['cratis/full/csharp'], ['cratis/modeling/screenplay-stage'], ['cratis'],
    ['cratis/application/kotlin', 'cratis/modeling/screenplay-stage'],
    ['cratis/modeling/screenplay-stage', 'cratis/application/kotlin'],
]) {
    test(`${profiles.join(' + ')} still surfaces missing-CLI errors`, async t => {
        const fixture = projectFixture({ profiles, languages: ['csharp', 'kotlin'] }, resolve(import.meta.dirname, '../../.cratis/ai'));
        const child = fakeChild();
        const harness = nativeHarness(fixture, undefined, [], async () => false, () => {
            const connection = new StdioConnection(child.child, 1000);
            queueMicrotask(() => child.child.emit('error', new Error('ENOENT')));
            return connection;
        });
        t.after(() => harness.event('session_shutdown'));
        await assert.rejects(harness.event('session_start'), /Cannot launch native cratis screenplay mcp/);
        assert.equal(harness.registered.size, 0);
        assert.equal(harness.versionProjects.length, 0);
        assert.equal(harness.notices.length, 0);
        assert.equal(child.child.killed, true);
    });
}

for (const failure of ['spawn', 'discovery']) {
    test(`application-only Screenplay quietly degrades on MCP ${failure} failure`, async t => {
        const harness = nativeHarness(projectFixture({ profiles: ['cratis/application'] }), [], [], async () => true,
            failure === 'spawn' ? () => { throw new Error('Cannot spawn'); } : undefined);
        t.after(() => harness.event('session_shutdown'));
        await harness.event('session_start');
        await harness.event('before_agent_start');
        assert.equal(harness.registered.size, 0);
        assert.deepEqual(harness.api.getActiveTools(), ['read']);
        assert.equal(harness.notices.length, 1);
        if (failure === 'discovery') assert.equal(harness.children[0].child.killed, true);
    });
}

test('application-only Screenplay quietly handles the CLI disappearing after the version check', async t => {
    const child = fakeChild();
    const harness = nativeHarness(projectFixture({ profiles: ['cratis/application'] }), undefined, [], async () => true, () => {
        const connection = new StdioConnection(child.child, 1000);
        queueMicrotask(() => child.child.emit('error', new Error('ENOENT')));
        return connection;
    });
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    assert.equal(harness.registered.size, 0);
    assert.equal(child.child.killed, true);
    assert.equal(harness.notices.length, 1);
});

test('application-only Screenplay emits neither a UI notice nor stdout in headless mode', async t => {
    const debug = t.mock.method(console, 'debug', () => {});
    const harness = nativeHarness(projectFixture({ profiles: ['cratis/application'] }), undefined, [], async () => false);
    harness.context.hasUI = false;
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    await harness.event('before_agent_start');
    assert.equal(harness.notices.length, 0);
    assert.equal(debug.mock.callCount(), 0);
    assert.equal(harness.registered.size, 0);
    assert.equal(harness.children.length, 0);
});

for (const explicit of ['profile', 'root']) {
    test(`Screenplay with an explicit ${explicit} still surfaces missing-CLI errors`, async t => {
        const fixture = projectFixture(explicit === 'profile'
            ? { profiles: ['cratis/screenplay'] }
            : { profiles: ['cratis/application'], mcpServers: { screenplay: { root: 'models' } } });
        if (explicit === 'root') mkdirSync(join(fixture.project, 'models'));
        const child = fakeChild();
        const harness = nativeHarness(fixture, undefined, [], async () => false, () => {
            const connection = new StdioConnection(child.child, 1000);
            queueMicrotask(() => child.child.emit('error', new Error('ENOENT')));
            return connection;
        });
        t.after(() => harness.event('session_shutdown'));
        await assert.rejects(harness.event('session_start'), /Cannot launch native cratis screenplay mcp/);
        assert.equal(harness.registered.size, 0);
        assert.equal(harness.versionProjects.length, 0);
        assert.equal(harness.notices.length, 0);
        assert.equal(child.child.killed, true);
    });
}

test('application-only Screenplay with a supported CLI registers tools and caches its version for the session', async t => {
    const fixture = projectFixture({ profiles: ['cratis/application'] });
    const harness = nativeHarness(fixture);
    t.after(() => harness.event('session_shutdown'));
    const before = readdirSync(fixture.project, { recursive: true });
    await harness.event('session_start');
    await harness.event('before_agent_start');
    assert.deepEqual([...harness.registered.keys()], ['screenplay_diagnostics', 'screenplay_apply']);
    assert.deepEqual(readdirSync(fixture.project, { recursive: true }), before);
    mkdirSync(join(fixture.project, 'models'));
    fixture.configure({ profiles: ['cratis/application'], mcpServers: { screenplay: { root: 'models' } } });
    await harness.event('before_agent_start');
    fixture.configure({ profiles: ['cratis/application'] });
    await harness.event('before_agent_start');
    assert.deepEqual(harness.versionProjects, [fixture.project]);
    await harness.event('session_start');
    assert.deepEqual(harness.versionProjects, [fixture.project, fixture.project]);
    assert.equal(harness.notices.length, 0);
});

test('application-only Screenplay never hides uncertain mutation outcomes', async t => {
    const harness = nativeHarness(projectFixture({ profiles: ['cratis/application'] }));
    t.after(() => harness.event('session_shutdown'));
    await harness.event('session_start');
    harness.children[0].onRequest(() => harness.children[0].exit());
    await assert.rejects(harness.call('screenplay_apply'), /outcome is unknown/);
    await assert.rejects(harness.event('session_start'), /outcome remains unknown/);
    assert.equal(harness.notices.length, 0);
    assert.equal(harness.children.length, 1);
});
