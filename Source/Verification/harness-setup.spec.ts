// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { checkOpenCodeAgents } from '../Harness.Setup/opencode-agents.ts';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const setupPath = join(repositoryRoot, 'Source/Harness.Setup/setup.ts');

function setup(project: string, check = false, force = false) {
    return spawnSync(process.execPath, ['--import', 'tsx', setupPath, project, ...(check ? ['--check'] : []), ...(force ? ['--force'] : [])], { cwd: repositoryRoot, encoding: 'utf8' });
}

test('setup regenerates owned stale symlinks and generated adapters', () => {
    const project = fixture();
    try {
        assert.equal(setup(project).status, 0);
        const rootLink = join(project, 'AGENTS.md');
        unlinkSync(rootLink);
        symlinkSync('.cratis/ai/rules/obsolete.md', rootLink);
        const adapter = join(project, '.cratis/ai/harnesses/opencode/agents/backend-developer.md');
        writeFileSync(adapter, `${readFileSync(adapter, 'utf8')}\nStale generated content.\n`);
        assert.notEqual(setup(project, true).status, 0);
        const updated = setup(project);
        assert.equal(updated.status, 0, updated.stderr);
        assert.equal(readlinkSync(rootLink), '.cratis/ai/rules/general.md');
        assert.equal(setup(project, true).status, 0);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

function fixture() {
    const project = mkdtempSync(join(tmpdir(), 'cratis-go-setup-'));
    cpSync(join(repositoryRoot, '.cratis/ai'), join(project, '.cratis/ai'), { recursive: true });
    writeFileSync(join(project, '.cratis/ai.json'), JSON.stringify({ profiles: ['cratis/engineering/go', 'cratis/arc/go'], languages: ['go'] }));
    return project;
}

test('adapter generation is repeatable on clean and customized repositories without changing unlisted project files', () => {
    for (const customized of [false, true]) {
        const project = fixture();
        try {
            const local = new Map<string, string>([['README.md', '# Local module context\n'], ['go.mod', 'module example.com/local\n\ngo 1.22\n']]);
            if (customized) {
                local.set('.agents/local.md', '# Local workflow\n');
                local.set('.pi/settings.json', '{"theme":"local"}\n');
                local.set('.github/workflows/local.yml', 'name: Local workflow\n');
            }
            for (const [path, content] of local) {
                mkdirSync(join(project, path, '..'), { recursive: true });
                writeFileSync(join(project, path), content);
            }
            const installed = setup(project);
            assert.equal(installed.status, 0, installed.stderr);
            const updated = setup(project);
            assert.equal(updated.status, 0, updated.stderr);
            assert.equal(setup(project, true).status, 0);
            assert.equal(readlinkSync(join(project, '.pi/skills')), '../.cratis/ai/skills');
            const generated = join(project, '.cratis/ai/harnesses/opencode/agents/backend-developer.md');
            const before = readFileSync(generated, 'utf8');
            const canonical = join(project, '.cratis/ai/agents/backend-developer.md');
            writeFileSync(canonical, `${readFileSync(canonical, 'utf8')}\nUpdated upstream guidance.\n`);
            assert.ok(checkOpenCodeAgents(join(project, '.cratis/ai')).length > 0);
            assert.equal(setup(project).status, 0, 'updated canonical agent regenerates its owned adapter');
            assert.notEqual(readFileSync(generated, 'utf8'), before);
            assert.deepEqual(checkOpenCodeAgents(join(project, '.cratis/ai')), []);
            for (const [path, content] of local) assert.equal(readFileSync(join(project, path), 'utf8'), content, path);
        } finally {
            rmSync(project, { recursive: true, force: true });
        }
    }
});

test('adapter checks preserve unlisted files inside an occupied harness directory', () => {
    const project = fixture();
    try {
        const path = join(project, '.github/instructions/local.instructions.md');
        mkdirSync(join(project, '.github/instructions'), { recursive: true });
        const local = '---\napplyTo: "**/*.go"\n---\n# Local policy\n';
        writeFileSync(path, local);
        const checked = setup(project, true);
        assert.notEqual(checked.status, 0);
        assert.match(checked.stderr, /\.github\/instructions: expected symbolic link/);
        assert.equal(readFileSync(path, 'utf8'), local);
        const installed = setup(project);
        assert.notEqual(installed.status, 0);
        assert.match(installed.stderr, /\.github\/instructions: expected symbolic link/);
        assert.equal(readFileSync(path, 'utf8'), local);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('adapter checks report same-path local adoption conflicts without modifying local content', () => {
    const project = fixture();
    try {
        const local = '# Locally owned instructions\n';
        writeFileSync(join(project, 'AGENTS.md'), local);
        const generatedPath = join(project, '.cratis/ai/harnesses/opencode/agents/backend-developer.md');
        writeFileSync(generatedPath, local);
        const checked = setup(project, true);
        assert.notEqual(checked.status, 0);
        assert.match(checked.stderr, /OpenCode agent adapters are out of date/);
        assert.ok(checkOpenCodeAgents(join(project, '.cratis/ai')).some(path => path.includes('backend-developer.md')));
        assert.equal(readFileSync(generatedPath, 'utf8'), local);
        const refused = setup(project);
        assert.notEqual(refused.status, 0);
        assert.match(refused.stderr, /OpenCode agent adapters are out of date/);
        assert.equal(readFileSync(generatedPath, 'utf8'), local);
        assert.equal(readFileSync(join(project, 'AGENTS.md'), 'utf8'), local);
        // Once the generated adapter is repaired by its owner, the occupied root path is
        // independently reported, in check and mutating mode.
        cpSync(join(repositoryRoot, '.cratis/ai/harnesses/opencode/agents/backend-developer.md'), generatedPath);
        const rootConflict = setup(project, true);
        assert.notEqual(rootConflict.status, 0);
        assert.match(rootConflict.stderr, /AGENTS\.md: expected symbolic link/);
        assert.equal(readFileSync(join(project, 'AGENTS.md'), 'utf8'), local);
        const rootRefused = setup(project);
        assert.notEqual(rootRefused.status, 0);
        assert.match(rootRefused.stderr, /AGENTS\.md: expected symbolic link/);
        assert.equal(readFileSync(join(project, 'AGENTS.md'), 'utf8'), local);
        writeFileSync(generatedPath, local);
        assert.equal(setup(project, false, true).status, 0, '--force replaces explicitly occupied paths');
        assert.equal(readlinkSync(join(project, 'AGENTS.md')), '.cratis/ai/rules/general.md');
        assert.deepEqual(checkOpenCodeAgents(join(project, '.cratis/ai')), []);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});
