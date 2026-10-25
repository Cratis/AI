// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { parseFrontmatter } from '@earendil-works/pi-coding-agent';
import { checkPiAgents, generatePiAgent, piAgentsDirectory } from '../Harness.Setup/pi-agents.ts';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { canonicalToolNames, checkOpenCodeAgents, modelTiers, type ModelTier, generateOpenCodeAgent, openCodeAgentsDirectory, parseCanonicalAgent, readCanonicalAgents } from '../Harness.Setup/opencode-agents.ts';
import { discoverAgents, normalizeTools, normalizeToolsDetailed, toolsErrorFor } from '../../.cratis/ai/harnesses/pi/extensions/subagent/agents.ts';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const corpusRoot = join(repositoryRoot, '.cratis', 'ai');

/** What each canonical Claude tool name becomes on Pi. `Agent` has no Pi built-in and is dropped. */
const piToolFor: Record<string, string | null> = { Read: 'read', Grep: 'grep', Glob: 'find', Bash: 'bash', Edit: 'edit', Write: 'write', Agent: null };

const canonicalAgents = readCanonicalAgents(corpusRoot);

test('every canonical agent declares a non-empty tools list in the canonical vocabulary', () => {
    assert.equal(canonicalAgents.length, 16);
    for (const agent of canonicalAgents) {
        assert.ok(agent.tools.length > 0, `${agent.file} declares no tools`);
        assert.equal(agent.model, undefined, `${agent.file} must not pin a native model; declare modelTier instead`);
        assert.ok(modelTiers.includes(agent.modelTier as ModelTier), `${agent.file} must declare modelTier: ${modelTiers.join(' | ')}`);
        for (const tool of agent.tools) assert.ok((canonicalToolNames as readonly string[]).includes(tool), `${agent.file}: ${tool}`);
    }
});

test('reviewer-tier agents declare provider independence and the five reviewers use the reviewer tier', () => {
    const reviewers = ['code-reviewer.md', 'security-reviewer.md', 'performance-reviewer.md', 'screenplay-reviewer.md', 'repository-investigation-reviewer.md'];
    for (const agent of canonicalAgents) {
        assert.equal(agent.modelTier === 'reviewer', reviewers.includes(agent.file), `${agent.file} reviewer tier`);
        if (agent.modelTier === 'reviewer') assert.equal(agent.reviewIndependence, 'different-provider', `${agent.file} must declare reviewIndependence: different-provider`);
    }
});

test('the Pi and OpenCode outputs never carry a native model key', () => {
    for (const agent of canonicalAgents) {
        for (const generated of [generatePiAgent(agent), generateOpenCodeAgent(agent)]) {
            const frontmatter = generated.content.slice(4, generated.content.indexOf('\n---\n', 4)).split('\n');
            assert.ok(!frontmatter.some(line => line.startsWith('model:')), `${generated.path} must not pin a native model`);
        }
    }
});

test('read-only roles are readonly and never declare Edit or Write', () => {
    const readOnlyRoles = ['code-reviewer.md', 'security-reviewer.md', 'performance-reviewer.md', 'repository-investigator.md', 'repository-investigation-reviewer.md', 'screenplay-reviewer.md', 'browser-operator.md'];
    for (const file of readOnlyRoles) {
        const agent = canonicalAgents.find(candidate => candidate.file === file);
        assert.ok(agent, file);
        assert.equal(agent.readonly, true, `${file} must carry readonly: true for Cursor`);
        assert.ok(!agent.tools.includes('Edit') && !agent.tools.includes('Write'), `${file} must not edit`);
    }
    for (const agent of canonicalAgents.filter(candidate => !readOnlyRoles.includes(candidate.file))) {
        assert.equal(agent.readonly, false, `${agent.file} must not be readonly`);
    }
});

test('Pi receives exactly the canonical allowlist, translated, for every agent', () => {
    for (const agent of canonicalAgents) {
        const expected = [...new Set(agent.tools.map(tool => piToolFor[tool]).filter((tool): tool is string => tool !== null))];
        assert.deepEqual(normalizeTools(agent.tools), expected, agent.file);
        assert.equal(toolsErrorFor(agent.name, agent.tools), undefined, agent.file);
    }
    // The subagent extension itself, discovering through the same files, must agree and must not carry an error.
    const discovered = discoverAgents(repositoryRoot, 'both').agents.filter(agent => agent.source !== 'user');
    for (const agent of canonicalAgents) {
        const launched = discovered.find(candidate => candidate.name === agent.name);
        assert.ok(launched, `${agent.name} is not discovered by the Pi subagent extension`);
        assert.equal(launched.toolsError, undefined, agent.file);
        assert.deepEqual(launched.tools, normalizeTools(agent.tools), agent.file);
        assert.equal(launched.model, undefined, `${agent.file} must not pin a native model on Pi`);
    }
});

test('the generated Screenplay Modeler exposes exactly the Pi built-in names without loader mapping', () => {
    const canonical = canonicalAgents.find(agent => agent.file === 'screenplay-modeler.md')!;
    const text = readFileSync(join(repositoryRoot, '.pi/agents/screenplay-modeler.md'), 'utf8');
    assert.equal(text, generatePiAgent(canonical).content);
    const { frontmatter } = parseFrontmatter<{ tools: string }>(text);
    // External Agent loaders split the CSV as written, without Claude-to-Pi normalization.
    assert.equal(typeof frontmatter.tools, 'string');
    assert.deepEqual(frontmatter.tools.split(',').map(tool => tool.trim()), ['read', 'grep', 'find', 'bash', 'edit', 'write']);
    for (const agent of canonicalAgents) {
        const generated = generatePiAgent(agent);
        assert.ok(generated.content.endsWith(agent.body), `${agent.file} preserves its body`);
        const original = parseFrontmatter<Record<string, unknown>>(`---\n${agent.frontmatter.join('\n')}\n---\n${agent.body}`).frontmatter;
        const adapted = parseFrontmatter<Record<string, unknown>>(generated.content).frontmatter;
        assert.deepEqual(adapted, { ...original, tools: normalizeTools(agent.tools)!.join(', ') }, `${agent.file} preserves other metadata`);
    }
    assert.deepEqual(checkPiAgents(corpusRoot), []);
    assert.deepEqual(readdirSync(join(corpusRoot, piAgentsDirectory)).sort(), canonicalAgents.map(agent => agent.file));
});

test('Pi generation refuses every unresolved name, even alongside a resolvable tool', () => {
    const agent = parseCanonicalAgent('unknown.md', '---\nname: Unknown\ndescription: x\ntools: [Read, githubRepo]\n---\nbody\n');
    assert.throws(() => generatePiAgent(agent), /unknown\.md declares unresolved Pi tools: githubRepo/);
    assert.throws(() => generatePiAgent({ ...agent, tools: ['Read', 'constructor'] }), /unresolved Pi tools: constructor/);
    assert.throws(() => generatePiAgent({ ...agent, tools: ['Agent'] }), /no Pi-resolvable tools/);
    const known = generatePiAgent({ ...agent, tools: ['Read', 'MultiEdit', 'LS', 'Agent', 'Task', 'Skill', 'TodoWrite', 'WebFetch', 'WebSearch', 'Glob', 'find'] });
    assert.match(known.content, /tools: read, edit, ls, find\n/);
});

test('a tools list that resolves to no Pi tool is a launch error naming the entries, never an unrestricted launch', () => {
    const legacyCopilotNames = ['githubRepo', 'codeSearch', 'usages', 'rename', 'terminalLastCommand'];
    assert.deepEqual(normalizeToolsDetailed(legacyCopilotNames), { tools: undefined, unresolved: legacyCopilotNames });
    const error = toolsErrorFor('Code Reviewer', legacyCopilotNames);
    assert.ok(error, 'expected a launch error');
    for (const name of legacyCopilotNames) assert.match(error, new RegExp(name));
    // Omitting tools altogether is still "inherit everything", exactly like Claude Code.
    assert.equal(toolsErrorFor('Anything', undefined), undefined);
    assert.equal(normalizeTools(undefined), undefined);
    // A partially resolvable list keeps what resolves (the Copilot "ignore unknown names" behavior).
    assert.deepEqual(normalizeToolsDetailed(['Read', 'githubRepo']), { tools: ['read'], unresolved: ['githubRepo'] });
});

test('the OpenCode adapters are generated from the canonical agents and are current', () => {
    assert.deepEqual(checkOpenCodeAgents(corpusRoot), []);
    const directory = join(corpusRoot, openCodeAgentsDirectory);
    assert.deepEqual(readdirSync(directory).sort(), canonicalAgents.map(agent => agent.file));
    for (const agent of canonicalAgents) {
        const generated = generateOpenCodeAgent(agent);
        const content = readFileSync(join(directory, agent.file), 'utf8');
        assert.equal(content, generated.content, agent.file);
        const frontmatter = content.slice(4, content.indexOf('\n---\n', 4)).split('\n');
        assert.ok(frontmatter.includes('mode: subagent'), agent.file);
        assert.ok(frontmatter.some(line => line.startsWith('description:')), agent.file);
        for (const forbidden of ['name:', 'tools:', 'readonly:']) assert.ok(!frontmatter.some(line => line.startsWith(forbidden)), `${agent.file} leaks ${forbidden} into OpenCode`);
        const canEdit = agent.tools.includes('Edit') || agent.tools.includes('Write');
        assert.ok(frontmatter.includes(`  edit: ${canEdit ? 'allow' : 'deny'}`), `${agent.file} edit permission`);
        assert.ok(frontmatter.includes(`  bash: ${agent.tools.includes('Bash') ? 'allow' : 'deny'}`), `${agent.file} bash permission`);
        assert.ok(!frontmatter.some(line => line.startsWith('model:')), `${agent.file} must inherit the OpenCode session model`);
        assert.ok(content.endsWith(agent.body), `${agent.file} body must be the canonical body`);
    }
});

test('the generator refuses a canonical agent it cannot express faithfully', () => {
    const readonlyEditor = parseCanonicalAgent('bad.md', '---\nname: Bad\ndescription: x\ntools:\n  - Edit\nreadonly: true\n---\nbody\n');
    assert.throws(() => generateOpenCodeAgent(readonlyEditor), /readonly but declares Edit\/Write/);
    const foreignVocabulary = parseCanonicalAgent('bad.md', '---\nname: Bad\ndescription: x\ntools: [githubRepo]\n---\nbody\n');
    assert.throws(() => generateOpenCodeAgent(foreignVocabulary), /outside the canonical vocabulary/);
    const pinnedModel = parseCanonicalAgent('bad.md', '---\nname: Bad\ndescription: x\ntools: [Read]\nmodel: claude-sonnet-4-5\n---\nbody\n');
    assert.throws(() => generateOpenCodeAgent(pinnedModel), /pins a model.*modelTier/);
});

test('every harness that receives agents resolves them to the intended source', () => {
    const canonical = realpathSync(join(corpusRoot, 'agents'));
    for (const path of ['.claude/agents', '.cursor/agents']) {
        assert.equal(realpathSync(join(repositoryRoot, path)), canonical, path);
    }
    assert.equal(realpathSync(join(repositoryRoot, '.pi', 'agents')), realpathSync(join(corpusRoot, piAgentsDirectory)));
    assert.equal(realpathSync(join(repositoryRoot, '.opencode', 'agents')), realpathSync(join(corpusRoot, openCodeAgentsDirectory)));
    for (const agent of canonicalAgents) {
        const copilot = join(repositoryRoot, '.github', 'agents', agent.file.replace(/\.md$/, '.agent.md'));
        assert.ok(existsSync(copilot), copilot);
        assert.equal(readlinkSync(copilot), `../../.cratis/ai/agents/${agent.file}`);
    }
});
