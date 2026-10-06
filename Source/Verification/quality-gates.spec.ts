// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Behavior fixtures for the shipped quality gates.
 *
 * The shipped `quality-gates.json` is data that every consuming repository runs unchanged, so what it does in a
 * repository that is not this one matters: a managed corpus update must not run the repository's application
 * gates, and a gate that invokes a package script the repository does not define must be a no-op, not a failure.
 * Each case drives the real gate script in dry-run mode against a throwaway repository.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const scripts = join(repositoryRoot, '.cratis', 'ai', 'hooks', 'scripts');

/** Dry-run the shipped gates against a committed scratch repository holding `files` as uncommitted changes. */
function plan(
    committed: Record<string, string>,
    changed: Record<string, string>,
    links: Record<string, string> = {},
    options: { dryrun?: boolean; expectedStatus?: number } = {},
): string {
    const root = mkdtempSync(join(tmpdir(), 'cratis-shipped-gates-'));
    try {
        const git = (...args: string[]) => spawnSync('git', ['-C', root, '-c', 'user.email=gate@cratis.io', '-c', 'user.name=gate', ...args], { encoding: 'utf8' });
        const write = (files: Record<string, string>) => {
            for (const [path, content] of Object.entries(files)) {
                mkdirSync(dirname(join(root, path)), { recursive: true });
                writeFileSync(join(root, path), content);
            }
        };
        git('init', '-q');
        write({ 'README.md': '# scratch\n', ...committed });
        for (const [path, target] of Object.entries(links)) {
            mkdirSync(dirname(join(root, path)), { recursive: true });
            symlinkSync(target, join(root, path));
        }
        git('add', '.');
        git('commit', '-q', '-m', 'initial');
        write(changed);
        const result = spawnSync(process.env.CRATIS_GATE_SPEC_SHELL ?? 'bash', [join(scripts, 'cratis-quality-gate.sh')], {
            input: '',
            encoding: 'utf8',
            env: {
                ...process.env,
                CLAUDE_PROJECT_DIR: root,
                CRATIS_HOOKS_GATES: join(scripts, 'quality-gates.json'),
                CRATIS_HOOKS_GATE_DRYRUN: options.dryrun === false ? '0' : '1',
                CRATIS_HOOKS_SKIP_GATE: '',
            },
        });
        assert.equal(result.status, options.expectedStatus ?? 0, result.stderr);
        return result.stderr;
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

// (?![\w-]) rather than \b: a gate id must not match a longer id that extends it with a hyphen.
const ran = (output: string, id: string) => new RegExp(`RUN\\s+${id}(?![\\w-])`).test(output);
const noOp = (output: string, id: string) => new RegExp(`NO-OP\\s+${id}(?![\\w-])`).test(output);

test('a managed corpus or adapter update triggers no application gate', () => {
    const output = plan(
        { 'package.json': JSON.stringify({ scripts: { 'lint:ci': 'x', 'g:compile': 'x', test: 'x' } }) },
        {
            '.cratis/ai/harnesses/pi/extensions/cratis-hooks/quality-gate.ts': 'export {};\n',
            '.pi/extensions/x.ts': 'export {};\n',
            '.claude/hooks/x.ts': 'export {};\n',
        },
    );
    assert.match(output, /dry run complete — 0 gate\(s\) would run/);
});

test('an application source change still triggers the frontend gates next to a managed update', () => {
    const output = plan(
        { 'package.json': JSON.stringify({ scripts: { 'lint:ci': 'x', 'g:compile': 'x', test: 'x' } }) },
        { '.cratis/ai/harnesses/x.ts': 'export {};\n', 'Source/App/a.ts': 'export {};\n' },
    );
    assert.ok(ran(output, 'frontend-lint'));
    assert.ok(ran(output, 'frontend-compile'));
    assert.ok(ran(output, 'frontend-specs'));
});

test('the compile gates are no-ops when the repository does not define their scripts', () => {
    const output = plan(
        { 'package.json': JSON.stringify({ scripts: { 'lint:ci': 'x', compile: 'x', test: 'x' } }) },
        { 'Source/App/a.ts': 'export {};\n' },
    );
    assert.ok(ran(output, 'frontend-lint'));
    assert.ok(noOp(output, 'frontend-compile'), output);
    assert.match(output, /script 'g:compile' is not defined/);
    assert.ok(noOp(output, 'frontend-compile-specs'), output);
    assert.match(output, /script 'g:compile:specs' is not defined/);
});

test('a compile gate runs when the root package.json defines its global script', () => {
    const output = plan(
        {
            'package.json': JSON.stringify({ scripts: { 'g:compile': 'x', 'g:compile:specs': 'x' } }),
            'Source/App/package.json': JSON.stringify({ scripts: { compile: 'yarn g:compile' } }),
        },
        { 'Source/App/a.ts': 'export {};\n' },
    );
    assert.ok(ran(output, 'frontend-compile'), output);
    assert.ok(ran(output, 'frontend-compile-specs'), output);
});

const frontendPackage = JSON.stringify({ scripts: { 'lint:ci': 'x', 'g:compile': 'x', 'g:compile:specs': 'x', test: 'x' } });
const harnessPackage = '.cratis/ai/harnesses/pi/extensions/package.json';
const installedCorpus = {
    '.cratis/ai.manifest.json': JSON.stringify({ Files: [{ Destination: 'harnesses/pi/extensions/package.json' }] }),
    [harnessPackage]: frontendPackage,
};
const harnessLinks = {
    '.agents/package.json': '../.cratis/ai/harnesses/pi/extensions/package.json',
    '.pi/extensions': '../.cratis/ai/harnesses/pi/extensions',
    '.claude/extensions': '../.cratis/ai/harnesses/pi/extensions',
    '.opencode/extensions': '../.cratis/ai/harnesses/pi/extensions',
    '.codex/extensions': '../.cratis/ai/harnesses/pi/extensions',
    '.cursor/extensions': '../.cratis/ai/harnesses/pi/extensions',
    '.github/agents': '../.cratis/ai/harnesses/pi/extensions',
    'adapter/package.json': '../.pi/extensions/package.json',
};
const frontendGates = ['frontend-lint', 'frontend-compile', 'frontend-compile-specs', 'frontend-specs'];

for (const folder of ['ContractTests/ProxyComparison', 'ContractTests/observables/frontend']) {
    test(`an installed corpus and harness links do not displace the affected authored package in ${folder}`, () => {
        const output = plan(
            {
                ...installedCorpus,
                'ContractTests/ProxyComparison/package.json': frontendPackage,
                'ContractTests/observables/frontend/package.json': frontendPackage,
            },
            { [`${folder}/view.ts`]: 'export {};\n' },
            harnessLinks,
        );
        for (const gate of frontendGates) assert.ok(ran(output, gate), output);
        assert.equal((output.match(new RegExp(`cwd: ${folder}\\)`, 'g')) ?? []).length, 4, output);
        assert.doesNotMatch(output, /cwd: (?:\.cratis|\.agents|adapter)/);
    });
}

test('a consuming library with only installed packages reports an empty frontend plan', () => {
    const output = plan(installedCorpus, { 'ContractTests/fixture.ts': 'export {};\n' }, harnessLinks);
    for (const gate of frontendGates) {
        assert.ok(!ran(output, gate), output);
        assert.ok(noOp(output, gate), output);
    }
    assert.match(output, /dry run complete — 0 gate\(s\) would run/);
    assert.match(output, /no gates selected — product verification was not performed/);
});

test('the owning AI repository can discover its authored harness package without an install manifest', () => {
    const output = plan({ [harnessPackage]: frontendPackage }, { 'Source/Verification/example.ts': 'export {};\n' });
    for (const gate of frontendGates) assert.ok(ran(output, gate), output);
    assert.equal((output.match(/cwd: \.cratis\/ai\/harnesses\/pi\/extensions/g) ?? []).length, 4, output);
});

for (const folder of ['.agents', '.cratis/custom', '.cratis/ai-product', '.codex', 'harnesses/pi/extensions']) {
    test(`an authored package in ${folder} is not excluded by its name`, () => {
        const output = plan(
            { ...installedCorpus, [`${folder}/package.json`]: frontendPackage },
            { 'Source/example.ts': 'export {};\n' },
        );
        for (const gate of frontendGates) assert.ok(ran(output, gate), output);
        assert.ok(output.includes(`cwd: ${folder})`), output);
    });
}

test('a root package symlink into the installed corpus cannot override an authored package', () => {
    const output = plan(
        { ...installedCorpus, 'Source/Client/package.json': frontendPackage },
        { 'Source/Client/view.ts': 'export {};\n' },
        { 'package.json': harnessPackage },
    );
    for (const gate of frontendGates) assert.ok(ran(output, gate), output);
    assert.equal((output.match(/cwd: Source\/Client/g) ?? []).length, 4, output);
});

test('discovery never runs a package reached through a symlink outside the task-owning repository', () => {
    const outside = mkdtempSync(join(tmpdir(), 'cratis-unrelated-package-'));
    try {
        writeFileSync(join(outside, 'package.json'), frontendPackage);
        const output = plan({}, { 'Source/example.ts': 'export {};\n' }, { 'package.json': join(outside, 'package.json') });
        for (const gate of frontendGates) assert.ok(!ran(output, gate), output);
        assert.match(output, /no gates selected — product verification was not performed/);
    } finally {
        rmSync(outside, { recursive: true, force: true });
    }
});

const overrideFile = '.cratis/ai/quality-gates.project.json';
const docsPackage = '.github/scripts/docs-verification/package.json';
const workbenchPackage = 'Source/Workbench/package.json';

test('a README change in one package cannot redirect frontend gates triggered by another', () => {
    const output = plan(
        { [docsPackage]: frontendPackage, [workbenchPackage]: frontendPackage },
        { '.github/scripts/docs-verification/README.md': '# docs\n', 'Source/Workbench/Web/a.ts': 'export {};\n' },
    );
    assert.equal((output.match(/cwd: Source\/Workbench/g) ?? []).length, 4, output);
    assert.doesNotMatch(output, /cwd: \.github/);
});

test('excluded frontend changes never influence package discovery', () => {
    const output = plan(
        { [docsPackage]: frontendPackage, [workbenchPackage]: frontendPackage },
        {
            '.github/scripts/docs-verification/dist/a.ts': 'export {};\n',
            '.github/scripts/docs-verification/bin/b.ts': 'export {};\n',
            '.github/scripts/docs-verification/obj/c.ts': 'export {};\n',
            'Source/Workbench/Web/a.ts': 'export {};\n',
        },
    );
    assert.equal((output.match(/cwd: Source\/Workbench/g) ?? []).length, 4, output);
    assert.doesNotMatch(output, /cwd: \.github/);
});

test('the deepest containing package wins over its parent and the root package', () => {
    const output = plan(
        { 'package.json': frontendPackage, 'Source/package.json': frontendPackage, [workbenchPackage]: frontendPackage },
        { 'Source/Workbench/Web/a.ts': 'export {};\n' },
    );
    assert.equal((output.match(/cwd: Source\/Workbench\)/g) ?? []).length, 4, output);
    assert.match(output, /dry run complete — 4 gate\(s\) would run/);
});

test('frontend gates execute once for every package holding triggering changes', () => {
    const outside = mkdtempSync(join(tmpdir(), 'cratis-gate-invocations-'));
    const calls = join(outside, 'calls');
    try {
        plan(
            {
                [docsPackage]: frontendPackage,
                [workbenchPackage]: frontendPackage,
                [overrideFile]: JSON.stringify({ gates: frontendGates.map(id => ({
                    id,
                    command: ['/bin/sh', '-c', 'printf "%s\\n" "$PWD" >> "$1"', 'gate', calls],
                })) }),
            },
            {
                '.github/scripts/docs-verification/a.ts': 'export {};\n',
                'Source/Workbench/Web/a.ts': 'export {};\n',
                'Source/Workbench/Web/b.ts': 'export {};\n',
            },
            {},
            { dryrun: false },
        );
        const invocations = readFileSync(calls, 'utf8').trim().split('\n');
        assert.equal(invocations.length, 8);
        assert.equal(invocations.filter(path => path.endsWith('/.github/scripts/docs-verification')).length, 4);
        assert.equal(invocations.filter(path => path.endsWith('/Source/Workbench')).length, 4);
    } finally {
        rmSync(outside, { recursive: true, force: true });
    }
});

test('a failure in the second affected package remains a blocking gate failure', () => {
    const output = plan(
        {
            [docsPackage]: frontendPackage,
            [workbenchPackage]: frontendPackage,
            [overrideFile]: JSON.stringify({ gates: frontendGates.map(id => ({
                id,
                command: ['/bin/sh', '-c', 'case "$PWD" in */Source/Workbench) exit 17 ;; esac'],
            })) }),
        },
        { '.github/scripts/docs-verification/a.ts': 'export {};\n', 'Source/Workbench/Web/a.ts': 'export {};\n' },
        {},
        { dryrun: false, expectedStatus: 2 },
    );
    assert.match(output, /QUALITY GATE FAILED: frontend-lint \(exit 17\)/);
    assert.match(output, /cwd: Source\/Workbench/);
});

test('multiple packages with no containing project report unverified changes and block', () => {
    const output = plan(
        { [docsPackage]: frontendPackage, [workbenchPackage]: frontendPackage },
        { 'Other/a.ts': 'export {};\n' },
        {},
        { expectedStatus: 2 },
    );
    assert.match(output, /UNVERIFIED — no containing project for Other\/a.ts/);
    assert.ok(!ran(output, 'frontend-lint'), output);
});

test('physical discovery refuses an external target containing a directory symlink followed by dot-dot', () => {
    const outside = mkdtempSync(join(tmpdir(), 'cratis-physical-package-'));
    try {
        mkdirSync(join(outside, 'child'));
        writeFileSync(join(outside, 'payload.json'), frontendPackage);
        const output = plan(
            { 'payload.json': frontendPackage },
            { 'adapter/view.ts': 'export {};\n' },
            { escape: join(outside, 'child'), 'adapter/package.json': '../escape/../payload.json' },
        );
        for (const gate of frontendGates) assert.ok(!ran(output, gate), output);
        assert.match(output, /no gates selected — product verification was not performed/);
    } finally {
        rmSync(outside, { recursive: true, force: true });
    }
});

test('physical discovery refuses a managed target containing a directory symlink followed by dot-dot', () => {
    const output = plan(
        {
            ...installedCorpus,
            'payload.json': frontendPackage,
            '.cratis/ai/payload.json': frontendPackage,
            '.cratis/ai/child/README.md': '# child\n',
        },
        { 'adapter/view.ts': 'export {};\n' },
        { escape: '.cratis/ai/child', 'adapter/package.json': '../escape/../payload.json' },
    );
    for (const gate of frontendGates) assert.ok(!ran(output, gate), output);
    assert.match(output, /no gates selected — product verification was not performed/);
});

test('an override that replaces only the command still runs when the repository lacks the managed script', () => {
    const output = plan(
        {
            'package.json': JSON.stringify({ scripts: { 'lint:ci': 'x', compile: 'x', test: 'x' } }),
            [overrideFile]: JSON.stringify({
                gates: [{ id: 'frontend-compile', workingDirectory: '.', command: ['yarn', 'workspace', 'app', 'run', 'check'] }],
            }),
        },
        { 'Source/App/a.ts': 'export {};\n' },
    );
    assert.ok(ran(output, 'frontend-compile'), output);
    assert.match(output, /\$ yarn workspace app run check/);
    assert.ok(!noOp(output, 'frontend-compile'), output);
    // The sibling gate that was not overridden keeps its managed requirement.
    assert.ok(noOp(output, 'frontend-compile-specs'), output);
});

test('an override that states its own requires replaces the managed requirements whole', () => {
    const output = plan(
        {
            'package.json': JSON.stringify({ scripts: { 'lint:ci': 'x', compile: 'x', test: 'x' } }),
            [overrideFile]: JSON.stringify({
                gates: [{ id: 'frontend-compile', workingDirectory: '.', requires: { packageScripts: ['check'] }, command: ['yarn', 'check'] }],
            }),
        },
        { 'Source/App/a.ts': 'export {};\n' },
    );
    assert.ok(noOp(output, 'frontend-compile'), output);
    assert.match(output, /script 'check' is not defined/);
});
