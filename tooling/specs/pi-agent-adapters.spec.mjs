// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, parseCanonical, rebaseLinks, renderAdapter } from '../pi-agent-adapters.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const canonical = '---\nname: Code Reviewer\ndescription: >\n  Review changed files.\n  Preserve instructions.\nmodel: claude-sonnet-4-5\ntools:\n  - githubRepo\n  - codeSearch\n---\n\n# Review\n\nLocal instruction.\n';

test('parses folded descriptions without dropping body or model pin', () => {
    const result = parseCanonical(canonical);
    assert.equal(result.fields.description, 'Review changed files. Preserve instructions.');
    assert.equal(result.fields.model, 'claude-sonnet-4-5');
    assert.equal(result.body, '\n# Review\n\nLocal instruction.\n');
});

test('inline tool lists are accepted', () => {
    assert.deepEqual(parseCanonical(canonical.replace('tools:\n  - githubRepo\n  - codeSearch', 'tools: [Read, Glob, Grep]')).fields.tools, ['Read', 'Glob', 'Grep']);
});

for (const [name, bad] of [
    ['unknown field', canonical.replace('model:', 'permissions: all\nmodel:')],
    ['duplicate key', canonical.replace('model:', 'name: Other\nmodel:')],
    ['unknown tool', canonical.replace('githubRepo', 'runAnything')],
    ['missing tools', canonical.replace('tools:\n  - githubRepo\n  - codeSearch\n', '')],
    ['invalid scalar', canonical.replace('claude-sonnet-4-5', '*anchor')],
    ['CRLF', canonical.replaceAll('\n', '\r\n')],
    ['nested metadata', canonical.replace('model: claude-sonnet-4-5', 'model:\n  name: unsafe')],
    ['empty body', canonical.split('\n---\n')[0] + '\n---\n'],
]) test(`refuses ${name}`, () => assert.throws(() => parseCanonical(bad)));

test('read-only profiles have stable dispatch, no inherited resources, no writes or delegation', () => {
    for (const name of ['code-reviewer', 'security-reviewer', 'performance-reviewer', 'repository-investigator', 'planner', 'coordinator', 'orchestrator']) {
        const output = renderAdapter(`${name}.md`, canonical);
        assert.match(output, new RegExp(`\nname: ${name}\n`));
        assert.match(output, /\ntools: read, bash, grep, find, ls\n/);
        assert.match(output, /\nextensions: false\nskills: false\nisolated: true\nallowed_subagents: false\n/);
        assert.ok(output.endsWith(parseCanonical(canonical).body));
        assert.equal(output, renderAdapter(`${name}.md`, canonical));
    }
});

test('explicit no-command evidence-review contract remains narrower', () => {
    assert.match(renderAdapter('repository-investigation-reviewer.md', canonical), /\ntools: read, grep, find, ls\n/);
});

test('implementers get native edit/write; planners return execution to parent', () => {
    for (const name of ['backend-developer', 'frontend-developer', 'spec-writer', 'slice-implementer']) {
        assert.match(renderAdapter(`${name}.md`, canonical), /tools: read, bash, grep, find, ls, edit, write\n/);
    }
    for (const name of ['orchestrator', 'coordinator', 'planner']) {
        const output = renderAdapter(`${name}.md`, canonical);
        assert.match(output, /returns the complete plan to the parent for execution/);
        assert.match(output, /description: "Plan-only support for explicitly requested large independent scope/);
    }
    assert.throws(() => renderAdapter('unreviewed-role.md', canonical));
});

test('links preserve their target and code examples preserve relative imports', () => {
    const body = '[TS](../rules/typescript.md)\n[peer](./planner.md)\nimport X from "./thing";';
    assert.equal(rebaseLinks(body), '[TS](../../.ai/rules/typescript.md)\n[peer](../../.ai/agents/planner.md)\nimport X from "./thing";');
    assert.throws(() => rebaseLinks('[escape](../../../outside.md)'));
});

function fixture(callback) {
    const directory = join(root, '.ai-work/rule-cleanup');
    mkdirSync(directory, { recursive: true });
    const repo = mkdtempSync(join(directory, 'adapter-spec-'));
    for (const path of ['.git', '.ai/agents', '.pi/agents']) mkdirSync(join(repo, path), { recursive: true });
    writeFileSync(join(repo, '.ai/agents/code-reviewer.md'), canonical);
    symlinkSync('../../.ai/agents/code-reviewer.md', join(repo, '.pi/agents/code-reviewer.md'));
    try { callback(repo); } finally { rmSync(repo, { recursive: true, force: true }); }
}

test('adopts exact symlinks, backs up pre-state, regenerates deterministically and refuses drift', () => fixture(repo => {
    assert.throws(() => generate(repo), /need regeneration/);
    assert.equal(generate(repo, false), 2);
    assert.equal(generate(repo), 0);
    assert.equal(generate(repo, false), 0);
    writeFileSync(join(repo, '.ai/agents/code-reviewer.md'), canonical + 'Local improvement.\n');
    assert.throws(() => generate(repo), /need regeneration/);
    assert.equal(generate(repo, false), 2);
    assert.equal(generate(repo), 0);
    const path = join(repo, '.pi/agents/code-reviewer.md');
    writeFileSync(path, readFileSync(path, 'utf8') + 'Manual adapter edit.\n');
    assert.throws(() => generate(repo, false), /adapter drift/);
}));

test('refuses orphan links, unmanaged files, adapter set drift and broken relative links', () => fixture(repo => {
    const path = join(repo, '.pi/agents/code-reviewer.md');
    rmSync(path);
    symlinkSync('../../.ai/agents/missing.md', path);
    assert.throws(() => generate(repo, false), /Unexpected adapter symlink/);
    rmSync(path);
    writeFileSync(path, canonical);
    assert.throws(() => generate(repo, false), /unmanaged adapter/);
    rmSync(path);
    symlinkSync('../../.ai/agents/code-reviewer.md', path);
    writeFileSync(join(repo, '.ai/agents/code-reviewer.md'), canonical + '[missing](../rules/missing.md)');
    assert.throws(() => generate(repo, false), /Broken relative link/);
    writeFileSync(join(repo, '.ai/agents/code-reviewer.md'), canonical);
    generate(repo, false);
    writeFileSync(join(repo, '.pi/agents/planner.md'), canonical);
    assert.throws(() => generate(repo, false), /Adapter set drift/);
}));

test('refuses generated distribution roots and relative paths', () => {
    assert.throws(() => generate('relative/path', false), /Unsupported repository root/);
    assert.throws(() => generate(join(dirname(root), 'AI.Distribution'), false), /Unsupported repository root/);
});

test('renders the current canonical checkout without effects', () => {
    // Runs after local adapter adoption; no sessions, builds, dependencies or network.
    const output = readFileSync(join(root, '.ai/agents/code-reviewer.md'), 'utf8');
    assert.match(renderAdapter('code-reviewer.md', output), /name: code-reviewer/);
});
