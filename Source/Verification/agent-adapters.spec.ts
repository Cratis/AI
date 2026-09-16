// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { canonicalToolNames, checkOpenCodeAgents, generateOpenCodeAgent, openCodeAgentsDirectory, parseCanonicalAgent, readCanonicalAgents } from '../Harness.Setup/opencode-agents.ts';
import { discoverAgents, normalizeTools, normalizeToolsDetailed, toolsErrorFor } from '../../.cratis/ai/harnesses/pi/extensions/subagent/agents.ts';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const corpusRoot = join(repositoryRoot, '.cratis', 'ai');

/** What each canonical Claude tool name becomes on Pi. `Agent` has no Pi built-in and is dropped. */
const piToolFor: Record<string, string | null> = { Read: 'read', Grep: 'grep', Glob: 'find', Bash: 'bash', Edit: 'edit', Write: 'write', Agent: null };

const canonicalAgents = readCanonicalAgents(corpusRoot);

test('every canonical agent declares a non-empty tools list in the canonical vocabulary', () => {
    assert.equal(canonicalAgents.length, 12);
    for (const agent of canonicalAgents) {
        assert.ok(agent.tools.length > 0, `${agent.file} declares no tools`);
        for (const tool of agent.tools) assert.ok((canonicalToolNames as readonly string[]).includes(tool), `${agent.file}: ${tool}`);
    }
});

test('read-only roles are readonly and never declare Edit or Write', () => {
    const readOnlyRoles = ['code-reviewer.md', 'security-reviewer.md', 'performance-reviewer.md', 'repository-investigator.md', 'repository-investigation-reviewer.md'];
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
    }
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
        if (agent.model?.startsWith('claude-')) assert.ok(frontmatter.includes(`model: anthropic/${agent.model}`), `${agent.file} model`);
        assert.ok(content.endsWith(agent.body), `${agent.file} body must be the canonical body`);
    }
});

test('the generator refuses a canonical agent it cannot express faithfully', () => {
    const readonlyEditor = parseCanonicalAgent('bad.md', '---\nname: Bad\ndescription: x\ntools:\n  - Edit\nreadonly: true\n---\nbody\n');
    assert.throws(() => generateOpenCodeAgent(readonlyEditor), /readonly but declares Edit\/Write/);
    const foreignVocabulary = parseCanonicalAgent('bad.md', '---\nname: Bad\ndescription: x\ntools: [githubRepo]\n---\nbody\n');
    assert.throws(() => generateOpenCodeAgent(foreignVocabulary), /outside the canonical vocabulary/);
});

test('every harness that receives agents resolves them to the intended source', () => {
    const canonical = realpathSync(join(corpusRoot, 'agents'));
    for (const path of ['.claude/agents', '.cursor/agents', '.pi/agents']) {
        assert.equal(realpathSync(join(repositoryRoot, path)), canonical, path);
    }
    assert.equal(realpathSync(join(repositoryRoot, '.opencode', 'agents')), realpathSync(join(corpusRoot, openCodeAgentsDirectory)));
    for (const agent of canonicalAgents) {
        const copilot = join(repositoryRoot, '.github', 'agents', agent.file.replace(/\.md$/, '.agent.md'));
        assert.ok(existsSync(copilot), copilot);
        assert.equal(readlinkSync(copilot), `../../.cratis/ai/agents/${agent.file}`);
    }
});
