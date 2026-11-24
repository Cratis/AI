// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** The render-cache staging guard recognises literal `git add` of `.cratis-render/` and nothing broader. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const scripts = resolve(import.meta.dirname, '../../.cratis/ai/hooks/scripts');
const shellGuard = join(scripts, 'cratis-guard-shell-writes.sh');
const classifierFile = join(scripts, 'cratis-guard-render-staging.mjs');
const { classify } = await import(pathToFileURL(classifierFile).href) as { classify: (command: string, cwd?: string) => { reason: string } | undefined };

const refused = [
    'git add .cratis-render',
    'git add .cratis-render/',
    'git add .cratis-render/out/file.cs',
    'git add ./.cratis-render/',
    'git add Source/app/.cratis-render/x.json',
    'git add /work/app/.cratis-render/x.json',
    "git add '.cratis-render/x'",
    'git add ".cratis-render"',
    'git add -f -- .cratis-render/file',
    'git add -A -- Source .cratis-render',
    'git -C app add .cratis-render/x',
    'git -C .cratis-render add .',
    'git -c core.quotepath=off add .cratis-render',
    'git stage .cratis-render',
    'echo ok && git add .cratis-render',
    'FOO=1 git add .cratis-render',
    '/usr/bin/git add .cratis-render',
    'bash -c "git add .cratis-render/"',
    'git add $TARGET .cratis-render/*',
    'DIR=.cratis-render; git add "$DIR"',
    'command -- git add .cratis-render/x',
    'env -- git add .cratis-render/x',
    'env VAR=x git add .cratis-render/x',
    'sudo -n git add .cratis-render/x',
    'nice -n 5 git add .cratis-render',
    'timeout 5 git add .cratis-render',
    "FOO='x y' git add .cratis-render/x",
    'env -u git git add .cratis-render/x',
    'nice -- git add .cratis-render/x',
    'git -C dir add .cratis-render',
    "git add '.cratis-render/x",
    "bash -c 'git add .cratis-render'",
    'bash -lc "git add .cratis-render/x"',
];
const permitted = [
    'git status',
    'git diff -- .cratis-render/',
    'git diff --cached .cratis-render',
    'ls .cratis-render',
    'git add Source/file.ts',
    'git add .cratis-render-notes',
    'git add docs/.cratis-render.md',
    "echo 'git add .cratis-render/'",
    'grep -n "git add .cratis-render" README.md',
    'git commit -m "never git add .cratis-render"',
    '# git add .cratis-render',
    'cratis render',
    'cratis render --force',
    'git add Source/a.ts && ls .cratis-render',
    "printf '%s' 'git add .cratis-render/'",
    'env FOO=1 ls .cratis-render',
    'sudo -n ls .cratis-render',
    "echo '; git add .cratis-render/'",
    'nice -n 5 git add Source/a.ts',
    'command -- git status',
    '',
];

test('literal staging forms of the render cache are refused', () => {
    for (const command of refused) assert.ok(classify(command, '/work/app'), command);
});

test('similar names, quoted text, reads and ordinary or forced rendering are not refused', () => {
    for (const command of permitted) assert.equal(classify(command, '/work/app'), undefined, command);
});

test('a working directory inside the cache refuses any git add there', () => {
    assert.ok(classify('git add .', '/work/app/.cratis-render/out'));
    assert.equal(classify('git status', '/work/app/.cratis-render/out'), undefined);
});

test('the classifier reports an unresolved target literally', () => {
    assert.match(classify('git add $T .cratis-render/*', '')?.reason ?? '', /names the render cache/);
    assert.match(classify('D=.cratis-render; git add "$D"', '')?.reason ?? '', /cannot resolve/);
});

function runShellGuard(command: string, cwd: string, env: NodeJS.ProcessEnv = {}) {
    const result = spawnSync('bash', [shellGuard], {
        cwd, encoding: 'utf8', input: JSON.stringify({ cwd, tool_name: 'Bash', tool_input: { command } }),
        env: { ...process.env, CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0', CLAUDE_PROJECT_DIR: cwd, ...env },
    });
    return { status: result.status, stderr: result.stderr };
}

test('the shell guard refuses explicit staging without a repository or manifest and never runs the command', () => {
    const directory = mkdtempSync(join(tmpdir(), 'render-staging-'));
    try {
        const sentinel = join(directory, 'sentinel');
        const refusal = runShellGuard(`touch ${sentinel}; git add .cratis-render/x`, directory);
        assert.equal(refusal.status, 2, refusal.stderr);
        assert.match(refusal.stderr, /BLOCKED by cratis-guard-shell-writes: this git add names the render cache/);
        assert.match(refusal.stderr, /literal path/);
        assert.equal(existsSync(sentinel), false);
        assert.equal(runShellGuard('git -C app add -f -- ./.cratis-render/', directory).status, 2);
    } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('the shell guard allows unrelated, textual and similarly named commands', () => {
    const directory = mkdtempSync(join(tmpdir(), 'render-staging-'));
    try {
        for (const command of ['git status', 'git diff -- .cratis-render/', 'ls .cratis-render', 'git add Source/file.ts', 'git add .cratis-render-notes', "echo 'git add .cratis-render/'", 'cratis render --force']) {
            const result = runShellGuard(command, directory);
            assert.equal(result.status, 0, `${command}\n${result.stderr}`);
        }
        assert.equal(runShellGuard('', directory).status, 0);
    } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('malformed hook input still fails closed', () => {
    const result = spawnSync('bash', [shellGuard], { encoding: 'utf8', input: '{not json', env: { ...process.env, CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0' } });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /BLOCKED by cratis-guard-shell-writes: parser failed/);
});

test('a candidate refuses when node is unavailable', () => {
    const directory = mkdtempSync(join(tmpdir(), 'render-staging-'));
    try {
        const bash = spawnSync('bash', ['-c', 'command -v bash'], { encoding: 'utf8' }).stdout.trim();
        const jq = spawnSync('bash', ['-c', 'command -v jq'], { encoding: 'utf8' }).stdout.trim();
        const bin = join(directory, 'bin');
        spawnSync('mkdir', ['-p', bin]);
        spawnSync('ln', ['-s', jq, join(bin, 'jq')]);
        const command = 'git add .cratis-render';
        const result = spawnSync(bash, [shellGuard], {
            cwd: directory, encoding: 'utf8', input: JSON.stringify({ cwd: directory, tool_name: 'Bash', tool_input: { command } }),
            env: { PATH: bin, CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0', CLAUDE_PROJECT_DIR: directory },
        });
        assert.equal(result.status, 2, result.stderr);
        assert.match(result.stderr, /node or the render-staging classifier is unavailable/);
        assert.ok(existsSync(classifierFile));
    } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('a scripts directory reached through a symlink still refuses instead of silently allowing', () => {
    const directory = mkdtempSync(join(tmpdir(), 'render-staging-'));
    try {
        const linked = join(directory, 'scripts-link');
        symlinkSync(scripts, linked);
        const result = spawnSync('bash', [join(linked, 'cratis-guard-shell-writes.sh')], {
            cwd: directory, encoding: 'utf8',
            input: JSON.stringify({ cwd: directory, tool_name: 'Bash', tool_input: { command: 'git add .cratis-render/x' } }),
            env: { ...process.env, CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0', CLAUDE_PROJECT_DIR: directory },
        });
        assert.equal(result.status, 2, result.stderr);
        assert.match(result.stderr, /names the render cache/);
    } finally { rmSync(directory, { recursive: true, force: true }); }
});

function runWithoutNode(command: string) {
    const directory = mkdtempSync(join(tmpdir(), 'render-staging-'));
    try {
        const bin = join(directory, 'bin');
        spawnSync('mkdir', ['-p', bin]);
        const jq = spawnSync('bash', ['-c', 'command -v jq'], { encoding: 'utf8' }).stdout.trim();
        symlinkSync(jq, join(bin, 'jq'));
        const bash = spawnSync('bash', ['-c', 'command -v bash'], { encoding: 'utf8' }).stdout.trim();
        return spawnSync(bash, [shellGuard], {
            cwd: directory, encoding: 'utf8', input: JSON.stringify({ cwd: directory, tool_name: 'Bash', tool_input: { command } }),
            env: { PATH: `${bin}:/usr/bin:/bin`, CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0', CLAUDE_PROJECT_DIR: directory },
        });
    } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('without node, commands lacking git or the cache never start node and keep their exit; any git plus cache mention refuses', () => {
    for (const command of ['ls .cratis-render', 'git status', 'git add Source/a.ts', 'echo hello']) {
        const result = runWithoutNode(command);
        assert.equal(result.status, 0, `${command}\n${result.stderr}`);
    }
    const refusals = ['git add .cratis-render/x', 'sudo -n git add .cratis-render/x', 'env -- git add .cratis-render', "bash -c 'git add .cratis-render'", "FOO='x y' git add .cratis-render/x", "echo 'git add .cratis-render/'"];
    for (const command of refusals) {
        const result = runWithoutNode(command);
        assert.equal(result.status, 2, command);
        assert.match(result.stderr, /node or the render-staging classifier is unavailable/);
    }
});
