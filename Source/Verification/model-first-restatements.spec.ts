// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { modelFirstRestatements } from './model-first-restatements.ts';
import { selectedSkillPaths } from '../Pi.Plugin/src/index.ts';

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
        'Opted in per `general.md` "Model first"; where `cratis-screenplay-modeling-lifecycle` is installed, run its `scripts/model-first-status.mjs`.',
        'Staged or untracked `.play` files are drafts, not the contract; a `.play` outside the model root is not a contract.',
        'For a committed model with working-tree edits, HEAD remains the contract until the change is committed.',
        'The setting `mcpServers.screenplay.root` selects the MCP workspace.',
        'Use `git ls-tree HEAD` to inspect tracked build output.',
    ].join('\n\n') }]);
    assert.equal(report.scanned, 1);
    assert.deepEqual(report.problems, []);
});

test('an unexpectedly empty population fails', () => {
    assert.match(modelFirstRestatements([]).problems[0], /vacuously/);
});

function corpusFiles() {
    const root = resolve(import.meta.dirname, '../..');
    const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? walk(path) : entry.isFile() && path.endsWith('.md') ? [path] : [];
    });
    return walk(join(root, '.cratis/ai')).map(path => ({ path: relative(root, path), content: readFileSync(path, 'utf8') }));
}

test('every non-lifecycle script pointer names the universal definition and conditional execution', () => {
    const files = corpusFiles().filter(file => !file.path.includes('/cratis-screenplay-modeling-lifecycle/'));
    const pointers = files.flatMap(file => file.content.split('\n')
        .filter(line => line.includes('scripts/model-first-status.mjs')).map(line => ({ path: file.path, line })));
    assert.ok(pointers.length > 40);
    for (const { path, line } of pointers) {
        assert.match(line, /`general\.md` "Model first"/, path);
        assert.match(line, /where `cratis-screenplay-modeling-lifecycle` is installed, run its/, path);
    }
});

for (const profile of ['cratis/specifications/dotnet', 'cratis/application/react', 'cratis/arc/core']) {
    test(`profile ${profile} retains a usable fallback without the lifecycle skill`, t => {
        const repository = mkdtempSync(join(tmpdir(), 'model-first-profile-spec-'));
        t.after(() => rmSync(repository, { recursive: true, force: true }));
        mkdirSync(join(repository, '.cratis'));
        writeFileSync(join(repository, '.cratis/ai.json'), JSON.stringify({ profiles: [profile], languages: ['csharp', 'react', 'typescript'] }));
        const skills = selectedSkillPaths(repository).map(path => basename(path));
        assert.ok(!skills.includes('cratis-screenplay-modeling-lifecycle'));
        const skill = profile === 'cratis/arc/core' ? 'cratis-arc-command' : 'cratis-application-slice-conformance';
        assert.ok(skills.includes(skill));
        const root = resolve(import.meta.dirname, '../../.cratis/ai');
        assert.match(readFileSync(join(root, 'rules/general.md'), 'utf8'), /\*\*Model first\.\*\*/);
        const content = readFileSync(join(root, 'skills', skill, 'SKILL.md'), 'utf8');
        assert.match(content, /`general\.md` "Model first"/);
        assert.match(content, /where `cratis-screenplay-modeling-lifecycle` is installed/);
        if (skill === 'cratis-application-slice-conformance') {
            assert.match(content, /These steps are enough on\s+their own when the Screenplay skills are not installed/);
            for (const text of [content, readFileSync(join(root, 'skills', skill, 'references/contract-and-precedence.md'), 'utf8')]) {
                assert.match(text, /Staged or untracked `.play` files are drafts, not the contract/);
                assert.match(text, /a `.play` outside the model root is not a contract/);
                assert.match(text, /HEAD remains the contract until the change is committed/);
            }
        }
    });
}

test('the real corpus has no opt-in restatements outside its owners', () => {
    const report = modelFirstRestatements(corpusFiles());
    assert.ok(report.scanned > 100);
    assert.deepEqual(report.problems, []);
});
