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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const scripts = join(repositoryRoot, '.cratis', 'ai', 'hooks', 'scripts');

/** Dry-run the shipped gates against a committed scratch repository holding `files` as uncommitted changes. */
function plan(committed: Record<string, string>, changed: Record<string, string>): string {
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
        git('add', '.');
        git('commit', '-q', '-m', 'initial');
        write(changed);
        const result = spawnSync('bash', [join(scripts, 'cratis-quality-gate.sh')], {
            input: '',
            encoding: 'utf8',
            env: {
                ...process.env,
                CLAUDE_PROJECT_DIR: root,
                CRATIS_HOOKS_GATES: join(scripts, 'quality-gates.json'),
                CRATIS_HOOKS_GATE_DRYRUN: '1',
                CRATIS_HOOKS_SKIP_GATE: '',
            },
        });
        assert.equal(result.status, 0, result.stderr);
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

const overrideFile = '.cratis/ai/quality-gates.project.json';

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
