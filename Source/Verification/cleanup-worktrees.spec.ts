// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * The delivered-work cleanup must be wired in every harness that has hooks, and its own self-test (which plants
 * delivered, dirty, unmerged, brand-new, locked and work-record worktrees) must pass: a cleanup that removes nothing, or removes
 * unfinished work, is worse than none.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { cleanupGithubFixture } from './fixtures/cleanup-github.ts';

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

test('N worktrees share one REST lookup and fresh cache across worktrees; expired stamps refresh', () => {
    const fixture = cleanupGithubFixture();
    try {
        assert.match(fixture.run(), /3 removed/);
        assert.deepEqual(fixture.calls(), ['api repos/example/cleanup/pulls?state=closed&per_page=100']);
        writeFileSync(join(fixture.directory, 'response'), '[]');
        assert.match(fixture.run(undefined, fixture.worktrees[0]), /2 removed/);
        assert.equal(fixture.calls().length, 1);
        writeFileSync(join(fixture.state, 'stamp'), `${Math.floor(Date.now() / 1000) - 901}\n`);
        assert.match(fixture.run(), /0 removed/);
        assert.equal(fixture.calls().length, 2);
    } finally { fixture.dispose(); }
});

for (const failure of ['API rate limit already exceeded', 'network unavailable']) {
    test(`GitHub failure keeps every dependent worktree and throttles retries: ${failure}`, () => {
        const fixture = cleanupGithubFixture();
        try {
            assert.match(fixture.run(), /3 removed/);
            writeFileSync(join(fixture.state, 'stamp'), '1\n');
            writeFileSync(join(fixture.directory, 'fail'), failure);
            assert.match(fixture.run(['--hook']), /0 removed/);
            assert.match(fixture.run(['--hook']), /0 removed/);
            assert.equal(fixture.calls().length, 2);
            fixture.worktrees.forEach(worktree => assert.ok(existsSync(worktree)));
            assert.equal(readFileSync(join(fixture.state, 'failed'), 'utf8'), readFileSync(join(fixture.state, 'stamp'), 'utf8'));
        } finally { fixture.dispose(); }
    });
}

for (const hook of [true, false]) {
    test(`NO_GH skips lookups and manual runs use one batch per run (hook=${hook})`, () => {
        const fixture = cleanupGithubFixture();
        const args = hook ? ['--hook', '--dry-run'] : ['--dry-run'];
        try {
            fixture.env.CRATIS_CLEANUP_NO_GH = '1';
            assert.match(fixture.run(args), /0 removed/);
            assert.equal(fixture.calls().length, 0);
            fixture.env.CRATIS_CLEANUP_NO_GH = '0';
            assert.match(fixture.run(args), /3 removed/);
            assert.match(fixture.run(args), /3 removed/);
            assert.equal(fixture.calls().length, hook ? 1 : 2);
        } finally { fixture.dispose(); }
    });
}

for (const failure of ['API rate limit already exceeded', 'network unavailable', 'invalid JSON', 'invalid shape', 'invalid entry', 'lock held']) {
    test(`a mixed sweep aborts every worktree and branch removal: ${failure}`, () => {
        const fixture = cleanupGithubFixture();
        try {
            fixture.deliver(); // Put ancestry-proven work first, before GitHub-dependent worktrees.
            fixture.git(fixture.repository, 'branch', 'ancestry-only', 'topic-0');
            fixture.git(fixture.repository, 'branch', 'github-dependent', 'topic-1');
            if (failure === 'lock held') mkdirSync(join(fixture.state, 'lock'), { recursive: true });
            else if (failure === 'invalid JSON') writeFileSync(join(fixture.directory, 'response'), '{broken');
            else if (failure === 'invalid shape') writeFileSync(join(fixture.directory, 'response'), '{}');
            else if (failure === 'invalid entry') writeFileSync(join(fixture.directory, 'response'), '[{}]');
            else writeFileSync(join(fixture.directory, 'fail'), failure);
            for (let run = 0; run < 2; run++) {
                assert.match(fixture.run(['--hook']), /GitHub evidence unavailable; 0 removed/);
                fixture.worktrees.forEach(worktree => assert.ok(existsSync(worktree)));
                assert.equal(fixture.git(fixture.repository, 'branch', '--format=%(refname:short)').split('\n').length, 6);
            }
            assert.equal(fixture.calls().length, failure === 'lock held' ? 0 : 1);
            if (failure !== 'lock held') assert.ok(existsSync(join(fixture.state, 'failed')));
        } finally { fixture.dispose(); }
    });
}

test('manual GitHub failure also aborts ancestry-proven removals', () => {
    const fixture = cleanupGithubFixture();
    try {
        fixture.deliver();
        writeFileSync(join(fixture.directory, 'fail'), 'network unavailable');
        assert.match(fixture.run([]), /GitHub evidence unavailable; 0 removed/);
        fixture.worktrees.forEach(worktree => assert.ok(existsSync(worktree)));
        assert.equal(fixture.calls().length, 1);
    } finally { fixture.dispose(); }
});

test('a failed window does not block a sweep that needs only ancestry evidence', () => {
    const fixture = cleanupGithubFixture();
    try {
        writeFileSync(join(fixture.directory, 'fail'), 'API rate limit already exceeded');
        fixture.run(['--hook']);
        fixture.pulls.forEach((_, index) => fixture.deliver(index));
        assert.match(fixture.run(['--hook']), /6 removed/);
        fixture.worktrees.forEach(worktree => assert.equal(existsSync(worktree), false));
        assert.equal(fixture.calls().length, 1);
    } finally { fixture.dispose(); }
});

test('a stale lock is reclaimed and the single batch is cached', () => {
    const fixture = cleanupGithubFixture();
    try {
        const lock = join(fixture.state, 'lock');
        mkdirSync(lock, { recursive: true });
        const expired = new Date(Date.now() - 901_000);
        utimesSync(lock, expired, expired);
        assert.match(fixture.run(), /3 removed/);
        assert.match(fixture.run(), /3 removed/);
        assert.equal(fixture.calls().length, 1);
        assert.equal(existsSync(lock), false);
    } finally { fixture.dispose(); }
});

test('git delivery evidence avoids GitHub entirely', () => {
    const fixture = cleanupGithubFixture();
    try {
        for (const pull of fixture.pulls) fixture.git(fixture.repository, 'merge', '--no-ff', pull.head.ref, '-m', 'delivered', '-s', 'ours');
        fixture.git(fixture.repository, 'update-ref', 'refs/remotes/origin/main', 'main');
        assert.match(fixture.run(), /3 removed/);
        assert.equal(fixture.calls().length, 0);
    } finally { fixture.dispose(); }
});

test('only a merged PR with both the exact head ref and SHA is delivery evidence', () => {
    const fixture = cleanupGithubFixture();
    try {
        const pulls = [
            fixture.pulls[0],
            { ...fixture.pulls[1], merged_at: null },
            { ...fixture.pulls[2], head: { ...fixture.pulls[2].head, sha: fixture.pulls[0].head.sha } },
            { ...fixture.pulls[2], head: { ...fixture.pulls[2].head, ref: 'other-branch' } },
        ];
        writeFileSync(join(fixture.directory, 'response'), JSON.stringify(pulls));
        const output = fixture.run(['--hook']);
        assert.match(output, /2 removed/); // The worktree and its now-unused branch are counted separately.
        assert.equal(existsSync(fixture.worktrees[0]), false);
        assert.ok(existsSync(fixture.worktrees[1]));
        assert.ok(existsSync(fixture.worktrees[2]));
        assert.equal(fixture.calls().length, 1);
    } finally { fixture.dispose(); }
});

test('concurrent hook runs honour the shared lock and published stamp', async () => {
    const fixture = cleanupGithubFixture();
    let pending: Promise<string> | undefined;
    try {
        writeFileSync(join(fixture.directory, 'block'), '');
        pending = fixture.runAsync();
        for (let attempt = 0; attempt < 500 && fixture.calls().length === 0; attempt++) await delay(20);
        assert.equal(fixture.calls().length, 1, 'first run must reach fake gh');
        assert.ok(existsSync(join(fixture.state, 'stamp')), 'stamp must precede the request');
        assert.match(fixture.run(undefined, fixture.worktrees[0]), /0 removed/);
        assert.equal(fixture.calls().length, 1);
        writeFileSync(join(fixture.directory, 'release'), '');
        assert.match(await pending, /3 removed/);
        assert.match(fixture.run(), /3 removed/);
        assert.equal(fixture.calls().length, 1);
    } finally {
        writeFileSync(join(fixture.directory, 'release'), '');
        if (pending) await pending;
        fixture.dispose();
    }
});

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
