// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { discoverAgents } from '../../.cratis/ai/harnesses/pi/extensions/subagent/agents.ts';
import { readModelTierConfig, resolveModel } from '../../.cratis/ai/harnesses/pi/extensions/subagent/modelTiers.ts';
import type { ExtensionAPI, ExtensionContext, ToolDefinition } from '@earendil-works/pi-coding-agent';
import registerSubagent from '../../.cratis/ai/harnesses/pi/extensions/subagent/index.ts';
import { foreignDelegationTool } from '../../.cratis/ai/harnesses/pi/extensions/subagent/delegation.ts';

const workDirectory = resolve('.ai-work/ai-866');
mkdirSync(workDirectory, { recursive: true });

const tierConfig = { schemaVersion: '1.0', tiers: { scoped: 'alpha/small', strongest: 'alpha/large', reviewer: ['alpha/review', 'beta/review'] } };
const reviewer = { modelTier: 'reviewer', reviewIndependence: 'different-provider' };

test('each configured tier resolves to its first model without inheriting thinking', () => {
    for (const [modelTier, model] of [['scoped', 'alpha/small'], ['strongest', 'alpha/large'], ['reviewer', 'alpha/review']]) {
        assert.deepEqual(resolveModel({ agent: { modelTier }, dispatchModel: 'alpha/author', config: tierConfig }), {
            model, thinkingInherited: false, outcome: 'tier',
        });
    }
});

test('missing configuration or tier inherits the session model and thinking', () => {
    for (const config of [undefined, { schemaVersion: '1.0', tiers: {} }]) {
        assert.deepEqual(resolveModel({ agent: { modelTier: 'scoped' }, dispatchModel: 'alpha/author', config }), {
            model: 'alpha/author', thinkingInherited: true, outcome: 'inherited',
        });
    }
});

test('review dispatch chooses the first available different provider, splitting only at the first slash', () => {
    const result = resolveModel({ agent: reviewer, dispatchModel: 'alpha/family/author', config: tierConfig, available: ['alpha/review', 'beta/review'] });
    assert.equal(result.model, 'beta/review');
    assert.equal(result.outcome, 'tier');
    assert.equal(result.thinkingInherited, false);
});

test('unavailable alternatives and same-provider-only or missing mappings visibly fall back', () => {
    for (const config of [tierConfig, { schemaVersion: '1.0', tiers: { reviewer: 'alpha/review' } }, undefined]) {
        const result = resolveModel({ agent: reviewer, dispatchModel: 'alpha/author', config, available: ['alpha/review'] });
        assert.equal(result.outcome, 'single-provider');
        assert.match(result.notice!, /not independent/);
        assert.equal(result.thinkingInherited, false);
        assert.equal(result.model, config ? 'alpha/review' : 'alpha/author');
    }
    assert.equal(resolveModel({ agent: reviewer, dispatchModel: 'alpha/author', config: tierConfig, available: [] }).model, 'alpha/author');
});

test('explicit model overrides tiers, including a visibly non-independent reviewer override', () => {
    const explicit = resolveModel({ agent: { ...reviewer, model: 'gamma/override' }, dispatchModel: 'alpha/author', config: tierConfig, available: [] });
    assert.equal(explicit.model, 'gamma/override');
    assert.equal(explicit.outcome, 'explicit');
    assert.equal(explicit.thinkingInherited, false);
    const sameProvider = resolveModel({ agent: { ...reviewer, model: 'alpha/override' }, dispatchModel: 'alpha/author', config: tierConfig });
    assert.equal(sameProvider.model, 'alpha/override');
    assert.equal(sameProvider.outcome, 'single-provider');
    assert.match(sameProvider.notice!, /not independent/);
});

test('an unavailable ordinary tier inherits rather than selecting an unavailable model', () => {
    const result = resolveModel({ agent: { modelTier: 'scoped' }, dispatchModel: 'alpha/author', config: tierConfig, available: [] });
    assert.equal(result.outcome, 'inherited');
    assert.equal(result.model, 'alpha/author');
    assert.equal(result.thinkingInherited, true);
});

test('the user config reader accepts version 1 mappings and ignores unknown tiers', () => {
    const directory = mkdtempSync(join(workDirectory, 'models-'));
    assert.deepEqual(readModelTierConfig(directory), {});
    writeFileSync(join(directory, 'cratis-models.json'), JSON.stringify({ schemaVersion: '1.2', tiers: { scoped: ' alpha/small ', unknown: 42 } }));
    assert.deepEqual(readModelTierConfig(directory), { config: { schemaVersion: '1.2', tiers: { scoped: 'alpha/small' } } });
});

test('malformed, unsupported and oversized user configuration is ignored with a dispatch notice', () => {
    const directory = mkdtempSync(join(workDirectory, 'invalid-models-'));
    for (const content of ['{', 'null', '{"schemaVersion":"2.0","tiers":{}}', '{"schemaVersion":"1.0","tiers":{"scoped":"missing-provider"}}', ' '.repeat(65537)]) {
        writeFileSync(join(directory, 'cratis-models.json'), content);
        const loaded = readModelTierConfig(directory);
        assert.equal(loaded.config, undefined);
        assert.match(loaded.notice!, /Ignoring/);
        const result = resolveModel({ agent: { modelTier: 'scoped' }, dispatchModel: 'alpha/author', ...loaded });
        assert.equal(result.model, 'alpha/author');
        assert.equal(result.outcome, 'inherited');
        assert.equal(result.notice, loaded.notice);
    }
});

test('the agent loader retains trimmed tier and independence strings only', () => {
    const directory = mkdtempSync(join(workDirectory, 'agents-'));
    const agentsDirectory = join(directory, '.pi/agents');
    mkdirSync(agentsDirectory, { recursive: true });
    writeFileSync(join(agentsDirectory, 'review.md'), '---\nname: review\ndescription: review\nmodelTier: " reviewer "\nreviewIndependence: " different-provider "\n---\nReview.');
    writeFileSync(join(agentsDirectory, 'invalid.md'), '---\nname: invalid\ndescription: invalid\nmodelTier: 42\nreviewIndependence: false\n---\nReview.');
    const agents = discoverAgents(directory, 'project').agents;
    assert.equal(agents.find(agent => agent.name === 'review')?.modelTier, 'reviewer');
    assert.equal(agents.find(agent => agent.name === 'review')?.reviewIndependence, 'different-provider');
    assert.equal(agents.find(agent => agent.name === 'invalid')?.modelTier, undefined);
    assert.equal(agents.find(agent => agent.name === 'invalid')?.reviewIndependence, undefined);
});

type Tool = { name: string; sourceInfo?: { source: string } };
type Notice = { message: string; type?: string };
type Context = { hasUI: boolean; ui: { notify(message: string, type?: string): void } };
type SessionStart = (event: unknown, context: Context) => void;

/** A host that holds the registered and active tools the way Pi does, with the given tools from other extensions. */
function host(otherTools: Tool[], options: { failing?: boolean } = {}) {
    const registered: Tool[] = [...otherTools];
    let subagent: ToolDefinition | undefined;
    let active = otherTools.map(tool => tool.name);
    let sessionStart: SessionStart | undefined;
    const unavailable = () => {
        throw new Error('Action methods cannot be called in this host.');
    };
    registerSubagent({
        registerTool(tool: Tool) {
            subagent = tool as ToolDefinition;
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
    return { start, notices, active: () => active, execute: subagent!.execute };
}

test('dispatch preserves model selection, thinking and visible fallback across all execution modes', async () => {
    const directory = mkdtempSync(join(workDirectory, 'dispatch-'));
    const agentsDirectory = join(directory, '.pi/agents');
    mkdirSync(agentsDirectory, { recursive: true });
    writeFileSync(join(agentsDirectory, 'review.md'), '---\nname: review\ndescription: review\nmodelTier: reviewer\nreviewIndependence: different-provider\n---\nReview.');
    writeFileSync(join(agentsDirectory, 'ordinary.md'), '---\nname: ordinary\ndescription: ordinary\nmodelTier: scoped\n---\nImplement.');
    writeFileSync(join(directory, 'cratis-models.json'), JSON.stringify(tierConfig));
    const entry = join(directory, 'fake-pi.mjs');
    writeFileSync(entry, 'console.log(JSON.stringify({type:"message_end",message:{role:"assistant",content:[{type:"text",text:JSON.stringify(process.argv.slice(2))}]}}));');
    const previousEntry = process.argv[1];
    const previousDirectory = process.env.PI_CODING_AGENT_DIR;
    process.argv[1] = entry;
    process.env.PI_CODING_AGENT_DIR = directory;
    const session = host([]);
    const context = {
        cwd: directory, hasUI: true, model: { provider: 'alpha', id: 'author' }, thinkingLevel: 'high',
        modelRegistry: { getAvailable: () => [{ provider: 'alpha', id: 'review' }] },
        ui: { notify: (message: string, type?: string) => session.notices.push({ message, type }) },
    } as unknown as ExtensionContext;
    const reviewTask = { agent: 'review', task: 'Review', agentScope: 'project' };
    const modes = [reviewTask, { agentScope: 'project', chain: [reviewTask, { agent: 'ordinary', task: '{previous}' }] }, { agentScope: 'project', tasks: [reviewTask, reviewTask] }];
    try {
        for (const params of modes) {
            session.notices.length = 0;
            const result = await session.execute('dispatch', params, undefined, undefined, context);
            const text = (result.content[0] as { text: string }).text;
            const details = result.details as { results: { model: string; modelOutcome: string; finalText: string }[] };
            assert.match(text, /single-provider.*not independent/);
            assert.equal(details.results[0].model, 'alpha/review');
            assert.equal(details.results[0].modelOutcome, 'single-provider');
            assert.equal(details.results[0].finalText.includes('--thinking'), false);
            assert.equal(session.notices.length, 1);
            assert.equal(session.notices[0].type, 'warning');
        }
        context.modelRegistry.getAvailable = () => [{ provider: 'beta', id: 'review' }] as ReturnType<typeof context.modelRegistry.getAvailable>;
        const independent = await session.execute('dispatch', reviewTask, undefined, undefined, context);
        assert.doesNotMatch((independent.content[0] as { text: string }).text, /single-provider/);
        const ordinary = await session.execute('dispatch', { ...reviewTask, agent: 'ordinary' }, undefined, undefined, context);
        assert.match((ordinary.content[0] as { text: string }).text, /--thinking/);
    } finally {
        process.argv[1] = previousEntry;
        if (previousDirectory === undefined) delete process.env.PI_CODING_AGENT_DIR;
        else process.env.PI_CODING_AGENT_DIR = previousDirectory;
    }
});

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
