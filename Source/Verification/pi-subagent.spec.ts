// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import registerSubagent from '../../.cratis/ai/harnesses/pi/extensions/subagent/index.ts';
import { foreignDelegationTool } from '../../.cratis/ai/harnesses/pi/extensions/subagent/delegation.ts';

type Tool = { name: string; sourceInfo?: { source: string } };
type Notice = { message: string; type?: string };
type Context = { hasUI: boolean; ui: { notify(message: string, type?: string): void } };
type SessionStart = (event: unknown, context: Context) => void;

/** A host that holds the registered and active tools the way Pi does, with the given tools from other extensions. */
function host(otherTools: Tool[], options: { failing?: boolean } = {}) {
    const registered: Tool[] = [...otherTools];
    let active = otherTools.map(tool => tool.name);
    let sessionStart: SessionStart | undefined;
    const unavailable = () => {
        throw new Error('Action methods cannot be called in this host.');
    };
    registerSubagent({
        registerTool(tool: Tool) {
            registered.push({ name: tool.name, sourceInfo: { source: 'cratis' } });
            active.push(tool.name);
        },
        on(name: string, handler: SessionStart) {
            if (name === 'session_start') sessionStart = handler;
        },
        getAllTools: options.failing ? unavailable : () => registered,
        getActiveTools: options.failing ? unavailable : () => [...active],
        setActiveTools: options.failing ? unavailable : (names: string[]) => {
            active = names;
        },
    } as unknown as ExtensionAPI);
    assert.ok(sessionStart, 'the subagent extension must decide at session start');
    const notices: Notice[] = [];
    const start = (hasUI = true) => sessionStart!({ type: 'session_start', reason: 'startup' }, {
        hasUI,
        ui: { notify: (message: string, type?: string) => notices.push({ message, type }) },
    });
    return { start, notices, active: () => active };
}

test('the Pi subagent tool stays active when no other delegation tool exists', () => {
    const session = host([{ name: 'read' }, { name: 'bash' }]);
    session.start();
    assert.deepEqual(session.active(), ['read', 'bash', 'subagent']);
    assert.deepEqual(session.notices, []);
});

test('the Pi subagent tool stands down once for another extension\'s Agent tool', () => {
    const session = host([{ name: 'read' }, { name: 'Agent', sourceInfo: { source: 'npm:@tintinweb/pi-subagents' } }]);
    session.start();
    assert.deepEqual(session.active(), ['read', 'Agent'], 'subagent must leave the active tools and nothing else may');
    assert.equal(session.notices.length, 1);
    assert.equal(session.notices[0].type, 'info');
    assert.match(session.notices[0].message, /"Agent" tool from npm:@tintinweb\/pi-subagents/);
    assert.match(session.notices[0].message, /Cratis "subagent" tool is disabled for this session/);

    session.start();
    assert.deepEqual(session.active(), ['read', 'Agent']);
    assert.equal(session.notices.length, 1, 'a later session start must not repeat the notice');
});

test('the Pi subagent tool stands down silently without a UI', () => {
    const session = host([{ name: 'Agent', sourceInfo: { source: 'npm:@tintinweb/pi-subagents' } }]);
    session.start(false);
    assert.deepEqual(session.active(), ['Agent']);
    assert.deepEqual(session.notices, []);
});

test('the Pi subagent tool keeps the session running when the host cannot list tools', () => {
    const session = host([], { failing: true });
    assert.doesNotThrow(() => session.start());
    assert.deepEqual(session.notices, []);
});

test('only an exact Agent tool counts as another delegation tool', () => {
    for (const name of ['agent', 'Agents', 'list_agents', 'AgentStatus', 'subagent', 'get_subagent_result']) {
        assert.equal(foreignDelegationTool([{ name }]), undefined, name);
    }
    assert.equal(foreignDelegationTool([{ name: 'read' }, { name: 'Agent' }])?.name, 'Agent');
});
