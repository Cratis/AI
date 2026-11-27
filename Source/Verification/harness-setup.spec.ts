// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { checkCopilotInstructions, copilotInstructionsDirectory } from '../Harness.Setup/copilot-instructions.ts';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const setupPath = join(repositoryRoot, 'Source/Harness.Setup/setup.ts');

function setup(project: string, check = false, force = false) {
    return spawnSync(process.execPath, ['--import', 'tsx', setupPath, project, ...(check ? ['--check'] : []), ...(force ? ['--force'] : [])], { cwd: repositoryRoot, encoding: 'utf8' });
}

test('Codex setup links only native shell hooks, is idempotent and repairs owned links', () => {
    const project = fixture();
    try {
        const path = join(project, '.codex/hooks.json');
        const target = '../.cratis/ai/harnesses/codex/hooks.json';
        assert.equal(setup(project).status, 0);
        assert.equal(readlinkSync(path), target);
        assert.deepEqual(Object.keys(JSON.parse(readFileSync(path, 'utf8')).hooks), ['PreToolUse']);
        const before = readFileSync(path, 'utf8');
        assert.equal(setup(project).status, 0);
        assert.equal(setup(project, true).status, 0);
        assert.equal(readFileSync(path, 'utf8'), before);
        unlinkSync(path);
        symlinkSync('../.cratis/ai/harnesses/codex/obsolete.json', path);
        assert.notEqual(setup(project, true).status, 0);
        assert.equal(setup(project).status, 0);
        assert.equal(readlinkSync(path), target);
    } finally { rmSync(project, { recursive: true, force: true }); }
});

test('Codex setup never replaces user hook config or writes through an occupied parent', () => {
    for (const occupied of ['file', 'link', 'parent-file', 'parent-link']) {
        const project = fixture();
        try {
            const local = join(project, 'local');
            mkdirSync(local);
            writeFileSync(join(local, 'hooks.json'), '{"user":true}\n');
            const parent = join(project, '.codex');
            if (occupied === 'parent-file') writeFileSync(parent, 'user parent');
            else if (occupied === 'parent-link') symlinkSync('local', parent);
            else {
                mkdirSync(parent);
                if (occupied === 'file') writeFileSync(join(parent, 'hooks.json'), '{"user":true}\n');
                else symlinkSync('../local/hooks.json', join(parent, 'hooks.json'));
            }
            for (const [check, force] of [[false, false], [true, false], [false, true]]) {
                assert.notEqual(setup(project, check, force).status, 0);
                assert.equal(readFileSync(join(local, 'hooks.json'), 'utf8'), '{"user":true}\n');
                if (occupied === 'file') assert.equal(readFileSync(join(parent, 'hooks.json'), 'utf8'), '{"user":true}\n');
                if (occupied === 'parent-file') assert.equal(readFileSync(parent, 'utf8'), 'user parent');
            }
        } finally { rmSync(project, { recursive: true, force: true }); }
    }
});

test('setup regenerates owned stale symlinks', () => {
    const project = fixture();
    try {
        assert.equal(setup(project).status, 0);
        const rootLink = join(project, 'AGENTS.md');
        unlinkSync(rootLink);
        symlinkSync('.cratis/ai/rules/obsolete.md', rootLink);
        assert.notEqual(setup(project, true).status, 0);
        const updated = setup(project);
        assert.equal(updated.status, 0, updated.stderr);
        assert.equal(readlinkSync(rootLink), '.cratis/ai/rules/general.md');
        assert.equal(setup(project, true).status, 0);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('Copilot migration replaces owned directory or per-file links without changing canonical rules', () => {
    for (const legacy of ['directory', 'files']) {
        const project = fixture();
        try {
            mkdirSync(join(project, '.github'), { recursive: true });
            const instructions = join(project, '.github/instructions');
            if (legacy === 'directory') symlinkSync('../.cratis/ai/rules', instructions, 'dir');
            else {
                mkdirSync(instructions);
                symlinkSync('../../.cratis/ai/rules/framework.md', join(instructions, 'framework.md'));
                symlinkSync('../../.cratis/ai/rules/framework.md', join(instructions, 'framework.instructions.md'));
            }
            const canonical = readFileSync(join(project, '.cratis/ai/rules/framework.md'), 'utf8');
            assert.notEqual(setup(project, true).status, 0);
            const installed = setup(project);
            assert.equal(installed.status, 0, installed.stderr);
            assert.equal(readlinkSync(instructions), `../.cratis/ai/${copilotInstructionsDirectory}`);
            assert.equal(readFileSync(join(project, '.cratis/ai/rules/framework.md'), 'utf8'), canonical);
            assert.throws(() => readlinkSync(join(instructions, 'framework.md')), /ENOENT/);
            assert.ok(lstatSync(join(instructions, 'framework.instructions.md')).isFile());
            assert.equal(setup(project, true).status, 0);
        } finally {
            rmSync(project, { recursive: true, force: true });
        }
    }
});

test('Copilot path and root instructions preserve customized files unless forced', () => {
    for (const adapter of [`.cratis/ai/${copilotInstructionsDirectory}/framework.instructions.md`, '.github/copilot-instructions.md']) {
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
            const diagnostic = adapter.startsWith('.cratis/ai/') ? `${adapter.slice('.cratis/ai/'.length)} is stale` : `${adapter}: expected`;
            assert.ok(checked.stderr.includes(diagnostic), checked.stderr);
            assert.ok(refused.stderr.includes(diagnostic), refused.stderr);
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
        for (const [scope, expected] of [['applyTo: **/*.go', 'applyTo: "**/*.go"'], ['applyTo:\n  - "**/*.go"\n  - "go.mod"', 'applyTo: "**/*.go,go.mod"']]) {
            const canonical = `---\n${scope}\npaths:\n  - "**/*.go"\n---\n# Fixture guidance\n`;
            writeFileSync(join(project, '.cratis/ai/rules/fixture.md'), canonical);
            const installed = setup(project);
            assert.equal(installed.status, 0, installed.stderr);
            const path = join(project, '.github/instructions/fixture.instructions.md');
            const generated = readFileSync(path, 'utf8');
            assert.equal(generated.split('\n').find(line => line.startsWith('applyTo:')), expected);
            assert.match(generated, /generated Copilot instructions/);
            assert.equal(readFileSync(join(project, '.cratis/ai/rules/fixture.md'), 'utf8'), canonical);
            const root = readFileSync(join(project, '.github/copilot-instructions.md'), 'utf8');
            assert.equal(root, readFileSync(join(project, '.cratis/ai/rules/general.md'), 'utf8'));
            assert.throws(() => readFileSync(join(project, '.github/instructions/universal-fixture.instructions.md')), /ENOENT/);
            writeFileSync(path, `${generated}\nStale generated content.\n`);
            assert.notEqual(setup(project, true).status, 0);
            assert.equal(setup(project).status, 0);
            assert.equal(readFileSync(path, 'utf8'), generated);
            assert.equal(setup(project, true).status, 0);
        }
        writeFileSync(join(project, '.cratis/ai/rules/fixture.md'), '---\napplyTo: "**/*.go"\n---\n# Fixture guidance\n');
        assert.equal(setup(project).status, 0, 'quoted applyTo remains a portable generated file');
        assert.ok(lstatSync(join(project, '.github/instructions/fixture.instructions.md')).isFile());
        writeFileSync(join(project, '.cratis/ai/rules/fixture.md'), '# Now universal\n');
        assert.equal(setup(project).status, 0);
        assert.throws(() => readlinkSync(join(project, '.github/instructions/fixture.instructions.md')), /ENOENT/);
        assert.equal(readlinkSync(join(project, '.github/copilot-instructions.md')), '../.cratis/ai/rules/general.md');
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

test('Copilot drift checks detect source changes, missing files and orphans, then regenerate owned outputs', () => {
    const project = fixture();
    try {
        assert.equal(setup(project).status, 0);
        const corpus = join(project, '.cratis/ai');
        const adapter = join(corpus, copilotInstructionsDirectory, 'framework.instructions.md');
        const canonical = join(corpus, 'rules/framework.md');
        const before = readFileSync(adapter, 'utf8');
        writeFileSync(canonical, `${readFileSync(canonical, 'utf8')}\nUpdated path guidance.\n`);
        assert.ok(checkCopilotInstructions(corpus).some(message => message.includes('framework.instructions.md is stale')));
        const checked = setup(project, true);
        assert.notEqual(checked.status, 0);
        assert.match(checked.stderr, /Copilot instruction adapters are out of date:/);
        assert.match(checked.stderr, /framework\.instructions\.md is stale/);
        assert.equal(readFileSync(adapter, 'utf8'), before, '--check reports body drift without regenerating');
        assert.equal(setup(project).status, 0);
        assert.match(readFileSync(adapter, 'utf8'), /Updated path guidance/);
        const orphan = join(corpus, copilotInstructionsDirectory, 'orphan.instructions.md');
        cpSync(adapter, orphan);
        unlinkSync(adapter);
        const drift = checkCopilotInstructions(corpus);
        assert.ok(drift.some(message => message.includes('framework.instructions.md is missing')));
        assert.ok(drift.some(message => message.includes('orphan.instructions.md has no path-scoped rule')));
        assert.notEqual(setup(project, true).status, 0);
        assert.equal(setup(project).status, 0);
        assert.deepEqual(checkCopilotInstructions(corpus), []);
        writeFileSync(orphan, '# User-owned orphan\n');
        assert.notEqual(setup(project).status, 0);
        assert.equal(readFileSync(orphan, 'utf8'), '# User-owned orphan\n');
        assert.equal(setup(project, false, true).status, 0);
        assert.deepEqual(checkCopilotInstructions(corpus), []);
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
            for (const [path, content] of local) assert.equal(readFileSync(join(project, path), 'utf8'), content, path);
        } finally {
            rmSync(project, { recursive: true, force: true });
        }
    }
});

test('setup refuses a directory with local instructions unless explicitly forced', () => {
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
        assert.equal(setup(project, false, true).status, 0);
        assert.equal(readlinkSync(join(project, '.github/instructions')), `../.cratis/ai/${copilotInstructionsDirectory}`);
        assert.equal(setup(project, true).status, 0);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('setup reports an occupied root instruction path without modifying local content', () => {
    const project = fixture();
    try {
        const local = '# Locally owned instructions\n';
        writeFileSync(join(project, 'AGENTS.md'), local);
        const rootConflict = setup(project, true);
        assert.notEqual(rootConflict.status, 0);
        assert.match(rootConflict.stderr, /AGENTS\.md: expected symbolic link/);
        assert.equal(readFileSync(join(project, 'AGENTS.md'), 'utf8'), local);
        const rootRefused = setup(project);
        assert.notEqual(rootRefused.status, 0);
        assert.match(rootRefused.stderr, /AGENTS\.md: expected symbolic link/);
        assert.equal(readFileSync(join(project, 'AGENTS.md'), 'utf8'), local);
        assert.equal(setup(project, false, true).status, 0, '--force replaces explicitly occupied paths');
        assert.equal(readlinkSync(join(project, 'AGENTS.md')), '.cratis/ai/rules/general.md');
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});
