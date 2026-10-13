// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * The delivered-work cleanup must be wired in every harness that has hooks, and its own self-test (which plants
 * delivered, dirty, unmerged, brand-new, locked and work-record worktrees) must pass: a cleanup that removes nothing, or removes
 * unfinished work, is worse than none.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const corpus = join(repositoryRoot, '.cratis', 'ai');
const script = join(corpus, 'hooks', 'scripts', 'cratis-cleanup-worktrees.sh');

test('the cleanup self-test passes', () => {
    const result = spawnSync('bash', [script, '--self-test'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /self-test: \d+ checks passed/);
});

const cleanupCases = [
    { name: 'keeps ignored work records by default', records: 'nonempty', args: [], kept: true, reason: 'has untracked work records (.ai-work/)' },
    { name: 'keeps work records in a dry run', records: 'nonempty', args: ['--dry-run'], kept: true, reason: 'has untracked work records (.ai-work/)' },
    { name: 'removes work records with manual opt-in', records: 'nonempty', args: ['--include-work-records'], kept: false },
    { name: 'ignores opt-in in hook mode', records: 'nonempty', args: ['--include-work-records', '--hook'], kept: true, reason: 'has untracked work records (.ai-work/)' },
    { name: 'removes a worktree with an empty records directory', records: 'empty', args: [], kept: false },
    { name: 'keeps a locked worktree despite opt-in', records: 'nonempty', args: ['--include-work-records'], locked: true, kept: true, reason: 'locked' },
    { name: 'keeps a locked detached worktree despite opt-in', records: 'nonempty', args: ['--include-work-records'], locked: true, detached: true, kept: true, reason: 'locked' },
    { name: 'keeps uncommitted changes despite opt-in', records: 'nonempty', args: ['--include-work-records'], dirty: true, kept: true, reason: 'delivered but has uncommitted changes' },
];

for (const scenario of cleanupCases) {
    test(`cleanup ${scenario.name}`, () => {
        const fixture = mkdtempSync(join(tmpdir(), 'cleanup-worktrees-'));
        const repository = join(fixture, 'repository');
        const worktree = join(fixture, 'worktree');
        const env = {
            ...process.env,
            GIT_AUTHOR_NAME: 'Cleanup spec', GIT_AUTHOR_EMAIL: 'cleanup@example.com',
            GIT_COMMITTER_NAME: 'Cleanup spec', GIT_COMMITTER_EMAIL: 'cleanup@example.com',
            CRATIS_CLEANUP_NO_GH: '1', CRATIS_HOOKS_SKIP_CLEANUP: '0',
        };
        const git = (cwd: string, ...args: string[]) => {
            const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
            assert.equal(result.status, 0, result.stdout + result.stderr);
            return result.stdout;
        };
        try {
            git(fixture, 'init', '--bare', '-b', 'main', 'origin.git');
            git(fixture, 'clone', join(fixture, 'origin.git'), repository);
            writeFileSync(join(repository, 'base'), 'base\n');
            git(repository, 'add', 'base');
            git(repository, 'commit', '-m', 'base');
            git(repository, 'push', 'origin', 'main');
            git(repository, 'worktree', 'add', '-b', 'delivered', worktree);
            writeFileSync(join(worktree, 'delivered'), 'delivered\n');
            git(worktree, 'add', 'delivered');
            git(worktree, 'commit', '-m', 'delivered');
            git(repository, 'merge', '--no-ff', 'delivered', '-m', 'merge delivered');
            git(repository, 'push', 'origin', 'main');
            writeFileSync(join(repository, '.git', 'info', 'exclude'), '.ai-work/\n');
            mkdirSync(join(worktree, '.ai-work'));
            const record = join(worktree, '.ai-work', '.handoff');
            if (scenario.records === 'nonempty') writeFileSync(record, 'Keep this handoff\n');
            if (scenario.detached) git(worktree, 'checkout', '--detach');
            if (scenario.locked) git(repository, 'worktree', 'lock', '--reason', 'long-lived', worktree);
            if (scenario.dirty) writeFileSync(join(worktree, 'untracked'), 'unfinished work\n');
            const result = spawnSync('bash', [script, '--no-fetch', ...scenario.args], {
                cwd: repository, env, encoding: 'utf8',
                input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: repository }),
            });
            assert.equal(result.status, 0, result.stdout + result.stderr);
            assert.equal(existsSync(worktree), scenario.kept, result.stdout + result.stderr);
            if (scenario.reason) assert.ok((result.stdout + result.stderr).includes(`: ${scenario.reason}`), result.stdout + result.stderr);
            if (scenario.kept && scenario.records === 'nonempty') assert.equal(readFileSync(record, 'utf8'), 'Keep this handoff\n');
            if (!scenario.detached) {
                const branches = git(repository, 'branch', '--format=%(refname:short)');
                assert.equal(branches.split('\n').includes('delivered'), scenario.kept);
            }
        } finally {
            rmSync(fixture, { recursive: true, force: true });
        }
    });
}

test('hook mode ignores commands that deliver no work', () => {
    const result = spawnSync('bash', [script, '--hook'], {
        input: JSON.stringify({ hook_event_name: 'PostToolUse', cwd: repositoryRoot, tool_input: { command: 'ls -la' } }),
        encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), '');
});

test('Claude runs it after a Bash command and at session start', () => {
    const settings = JSON.parse(readFileSync(join(corpus, 'hooks', 'settings.template.json'), 'utf8'));
    const commands = (event: string) => JSON.stringify(settings.hooks[event] ?? []);
    assert.match(commands('SessionStart'), /cratis-cleanup-worktrees\.sh --hook/);
    const post = settings.hooks.PostToolUse.find((entry: { matcher: string }) => entry.matcher === 'Bash');
    assert.match(JSON.stringify(post), /cratis-cleanup-worktrees\.sh --hook/);
});

test('Pi runs it after a Bash result and at session start', () => {
    const extension = readFileSync(join(corpus, 'harnesses', 'pi', 'extensions', 'cratis-hooks', 'index.ts'), 'utf8');
    assert.match(extension, /pi\.on\("session_start"[\s\S]*sweepDelivered\("SessionStart"/);
    assert.match(extension, /sweepDelivered\("PostToolUse"/);
});

test('ship-changes ends with the cleanup for harnesses that have no hook', () => {
    const prompt = readFileSync(join(corpus, 'prompts', 'ship-changes.prompt.md'), 'utf8');
    assert.match(prompt, /## Cleanup[\s\S]*cratis-cleanup-worktrees\.sh/);
});
