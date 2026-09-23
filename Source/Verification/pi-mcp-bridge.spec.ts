// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { nativeHarness, projectFixture, tool } from './pi-mcp-helpers.ts';

test('native Screenplay bridge does not start children or register tools for inactive/opted-out projects', async () => {
    for (const config of [{ profiles: ['other'] }, { profiles: ['cratis/screenplay'], mcpServers: { screenplay: { enabled: false } } }]) {
        const harness = nativeHarness(projectFixture(config));
        await harness.event('session_start');
        await harness.event('before_agent_start');
        assert.equal(harness.children.length, 0);
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
