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

test('Copilot migration replaces only owned legacy links and never writes through the old directory link', () => {
    const project = fixture();
    try {
        mkdirSync(join(project, '.github'), { recursive: true });
        symlinkSync('../.cratis/ai/rules', join(project, '.github/instructions'), 'dir');
        const canonical = readFileSync(join(project, '.cratis/ai/rules/go.md'), 'utf8');
        assert.notEqual(setup(project, true).status, 0);
        assert.equal(setup(project).status, 0);
        assert.equal(readFileSync(join(project, '.cratis/ai/rules/go.md'), 'utf8'), canonical);
        symlinkSync('../../.cratis/ai/rules/go.md', join(project, '.github/instructions/go.md'));
        const local = join(project, '.github/instructions/local.md');
        writeFileSync(local, '# Local instructions\n');
        assert.notEqual(setup(project, true).status, 0);
        assert.equal(setup(project).status, 0);
        assert.throws(() => readlinkSync(join(project, '.github/instructions/go.md')), /ENOENT/);
        assert.equal(readlinkSync(join(project, '.github/instructions/go.instructions.md')), '../../.cratis/ai/rules/go.md');
        assert.equal(readFileSync(local, 'utf8'), '# Local instructions\n');
        assert.equal(setup(project, true).status, 0);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('Copilot path and root instructions preserve customized files unless forced', () => {
    for (const adapter of ['.github/instructions/go.instructions.md', '.github/copilot-instructions.md']) {
        const project = fixture();
        try {
            assert.equal(setup(project).status, 0);
            const path = join(project, adapter);
            unlinkSync(path);
            const local = '# Local instructions\n';
            writeFileSync(path, local);
            const checked = setup(project, true);
            const refused = setup(project);
            assert.notEqual(checked.status, 0);
            assert.notEqual(refused.status, 0);
            assert.ok(checked.stderr.includes(`${adapter}: expected`));
            assert.ok(refused.stderr.includes(`${adapter}: expected`));
            assert.equal(readFileSync(path, 'utf8'), local);
            assert.equal(setup(project, false, true).status, 0);
            assert.notEqual(readFileSync(path, 'utf8'), local);
        } finally {
            rmSync(project, { recursive: true, force: true });
        }
    }
});

test('Copilot normalizes only non-string applyTo forms and regenerates its own stale output', () => {
    const project = fixture();
    try {
        const universal = '# Universal fixture guidance\n';
        writeFileSync(join(project, '.cratis/ai/rules/universal-fixture.md'), universal);
        for (const scope of ['applyTo: **/*.go', 'applyTo:\n  - "**/*.go"\n  - "go.mod"']) {
            const canonical = `---\n${scope}\npaths:\n  - "**/*.go"\n---\n# Fixture guidance\n`;
            writeFileSync(join(project, '.cratis/ai/rules/fixture.md'), canonical);
            const installed = setup(project);
            assert.equal(installed.status, 0, installed.stderr);
            const path = join(project, '.github/instructions/fixture.instructions.md');
            const generated = readFileSync(path, 'utf8');
            assert.match(generated, /applyTo: "\*\*\/\*\.go(?:,go\.mod)?"\npaths:/);
            assert.match(generated, /generated Copilot instructions/);
            assert.equal(readFileSync(join(project, '.cratis/ai/rules/fixture.md'), 'utf8'), canonical);
            const root = readFileSync(join(project, '.github/copilot-instructions.md'), 'utf8');
            assert.ok(root.includes(universal));
            assert.throws(() => readFileSync(join(project, '.github/instructions/universal-fixture.instructions.md')), /ENOENT/);
            writeFileSync(path, `${generated}\nStale generated content.\n`);
            assert.notEqual(setup(project, true).status, 0);
            assert.equal(setup(project).status, 0);
            assert.equal(readFileSync(path, 'utf8'), generated);
            assert.equal(setup(project, true).status, 0);
        }
        writeFileSync(join(project, '.cratis/ai/rules/fixture.md'), '---\napplyTo: "**/*.go"\n---\n# Fixture guidance\n');
        assert.equal(setup(project).status, 0, 'a normalized adapter can become a canonical symlink again');
        assert.equal(readlinkSync(join(project, '.github/instructions/fixture.instructions.md')), '../../.cratis/ai/rules/fixture.md');
        writeFileSync(join(project, '.cratis/ai/rules/fixture.md'), '# Now universal\n');
        assert.equal(setup(project).status, 0);
        assert.throws(() => readlinkSync(join(project, '.github/instructions/fixture.instructions.md')), /ENOENT/);
        assert.ok(readFileSync(join(project, '.github/copilot-instructions.md'), 'utf8').includes('# Now universal'));
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('setup refuses occupied directories and links without following or deleting user content', () => {
    const project = fixture();
    try {
        const local = join(project, 'AGENTS.md/local.md');
        mkdirSync(join(project, 'AGENTS.md'));
        writeFileSync(local, '# Local content\n');
        assert.notEqual(setup(project).status, 0);
        assert.equal(readFileSync(local, 'utf8'), '# Local content\n');
        assert.equal(setup(project, false, true).status, 0);
        assert.equal(readlinkSync(join(project, 'AGENTS.md')), '.cratis/ai/rules/general.md');
        const target = join(project, 'local-agent.md');
        writeFileSync(target, '# Local agent\n');
        const adapter = join(project, '.cratis/ai/harnesses/opencode/agents/backend-developer.md');
        unlinkSync(adapter);
        symlinkSync(target, adapter);
        assert.notEqual(setup(project).status, 0);
        assert.equal(readFileSync(target, 'utf8'), '# Local agent\n');
        assert.equal(setup(project, false, true).status, 0);
        assert.equal(readFileSync(target, 'utf8'), '# Local agent\n');
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('setup does not write through an unowned parent-directory symlink', () => {
    const project = fixture();
    try {
        mkdirSync(join(project, 'local-pi'));
        symlinkSync('local-pi', join(project, '.pi'), 'dir');
        for (const check of [false, true]) {
            const refused = setup(project, check);
            assert.notEqual(refused.status, 0);
            assert.match(refused.stderr, /\.pi: expected directory/);
            assert.throws(() => readFileSync(join(project, 'local-pi/agents')), /ENOENT/);
        }
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

test('setup preserves unlisted local path instructions alongside managed adapters', () => {
    const project = fixture();
    try {
        const path = join(project, '.github/instructions/local.instructions.md');
        mkdirSync(join(project, '.github/instructions'), { recursive: true });
        const local = '---\napplyTo: "**/*.go"\n---\n# Local policy\n';
        writeFileSync(path, local);
        const checked = setup(project, true);
        assert.notEqual(checked.status, 0);
        assert.match(checked.stderr, /\.github\/instructions\/go\.instructions\.md: expected symbolic link/);
        assert.equal(readFileSync(path, 'utf8'), local);
        const installed = setup(project);
        assert.equal(installed.status, 0, installed.stderr);
        assert.equal(setup(project, true).status, 0);
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
