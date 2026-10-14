// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';
import { modelFirstRestatements } from './model-first-restatements.ts';

for (const path of ['skills/a/SKILL.md', 'skills/a/references/contract.md', 'rules/a.md', 'agents/a.md', 'prompts/a.prompt.md', 'harnesses/copilot/instructions/a.instructions.md']) {
    test(`a planted tree-test restatement fails in ${path}`, () => {
        const report = modelFirstRestatements([{ path: `.cratis/ai/${path}`, content: '# Heading\n\nUse `git ls-tree -r --name-only HEAD`\nto find a committed `.play` file.' }]);
        assert.equal(report.scanned, 1);
        assert.equal(report.problems.length, 1);
        assert.match(report.problems[0], /:3 restates the model-first/);
    });
}

for (const content of [
    'Opted in means the model root holds a committed `.play` file.',
    'The repository is opted in if the project explicitly set `mcpServers.screenplay.root`.',
]) {
    test(`a planted prose-only test fails: ${content}`, () => {
        assert.equal(modelFirstRestatements([{ path: '.cratis/ai/agents/a.md', content }]).problems.length, 1);
    });
}

test('owners may define the test but other lifecycle references cannot', () => {
    const content = 'Opted in: `git ls-tree -r --name-only HEAD` finds a committed `.play` file.';
    const report = modelFirstRestatements([
        { path: '.cratis/ai/rules/general.md', content },
        { path: '.cratis/ai/skills/cratis-screenplay-modeling-lifecycle/SKILL.md', content },
        { path: '.cratis/ai/skills/cratis-screenplay-modeling-lifecycle/references/opt-in.md', content },
    ]);
    assert.equal(report.scanned, 1);
    assert.equal(report.problems.length, 1);
});

test('pointers, config mechanism documentation and unrelated Git commands pass', () => {
    const report = modelFirstRestatements([{ path: '.cratis/ai/skills/a/SKILL.md', content: [
        "Opted in? Run `cratis-screenplay-modeling-lifecycle`'s `scripts/model-first-status.mjs`.",
        'The setting `mcpServers.screenplay.root` selects the MCP workspace.',
        'Use `git ls-tree HEAD` to inspect tracked build output.',
    ].join('\n\n') }]);
    assert.equal(report.scanned, 1);
    assert.deepEqual(report.problems, []);
});

test('an unexpectedly empty population fails', () => {
    assert.match(modelFirstRestatements([]).problems[0], /vacuously/);
});

test('the real corpus has no opt-in restatements outside its owners', () => {
    const root = resolve(import.meta.dirname, '../..');
    const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? walk(path) : entry.isFile() && path.endsWith('.md') ? [path] : [];
    });
    const files = walk(join(root, '.cratis/ai')).map(path => ({ path: relative(root, path), content: readFileSync(path, 'utf8') }));
    const report = modelFirstRestatements(files);
    assert.ok(report.scanned > 100);
    assert.deepEqual(report.problems, []);
});
