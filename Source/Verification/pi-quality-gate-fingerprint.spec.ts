// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import { gateTimeoutSeconds, latestGateLog, parseGatePlan, runBounded, tailLines, workingTreeFingerprint } from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/quality-gate.ts';
import { bridge, scratch } from './pi-quality-gate.fixture.ts';

test('a TERM-resistant descendant is killed even if the parent exits and closes its redirected pipes', async () => {
    const run = await runBounded('bash', ['-c', "bash -c 'trap \"\" TERM; while :; do :; done' >/dev/null 2>&1 & echo $!; wait"], {
        cwd: tmpdir(), timeoutMs: 300, killGraceMs: 300,
    });
    assert.equal(run.timedOut, true);
    const child = Number(run.stdout.trim());
    assert.ok(child > 0);
    // On some CI kernels an orphan remains as a zombie until init reaps it: it can no longer execute.
    await new Promise(resolve => setTimeout(resolve, 150));
    const state = spawnSync('ps', ['-p', String(child), '-o', 'stat='], { encoding: 'utf8' });
    assert.ok(state.status !== 0 || state.stdout.trim().startsWith('Z'), `the resistant descendant is still running: ${state.stdout.trim()}`);
});

test('gate log tails bound reads and single oversized lines', () => {
    const repo = scratch(['true']);
    try {
        const file = join(repo.root, 'gate.log');
        writeFileSync(file, `old\n${'x'.repeat(2_000_000)}\nlast\n`);
        const tail = tailLines(file, 3);
        assert.ok(tail.length <= 65_600, 'the returned tail must remain bounded');
        assert.match(tail, /last$/);
        assert.doesNotMatch(tail, /old/);
    } finally {
        repo.dispose();
    }
});

test('an overflowing Git status is unknown rather than a fingerprint of only its retained tail', async () => {
    const repo = scratch(['true']);
    try {
        // Each path is below Git's component limit, but the combined -z status exceeds 256 KiB.
        for (let index = 0; index < 2100; index++) {
            writeFileSync(join(repo.root, `item-${String(index).padStart(4, '0')}-${'x'.repeat(126)}.txt`), 'x');
        }
        const status = await runBounded('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: repo.root, timeoutMs: 15_000 });
        assert.equal(status.code, 0);
        assert.equal(status.stdoutTruncated, true, 'the Git output must genuinely exceed the retained cap');
        assert.deepEqual(await workingTreeFingerprint(repo.root), { kind: 'unknown' });
    } finally {
        repo.dispose();
    }
});

test('same-size untracked content edits with restored mtime require a new explicit gate run', async () => {
    const repo = scratch(['true']);
    try {
        const { tool } = bridge();
        const file = join(repo.root, 'change.txt');
        const fixed = new Date('2020-01-01T00:00:00.000Z');
        writeFileSync(file, 'aaaa');
        utimesSync(file, fixed, fixed);
        const verified = await workingTreeFingerprint(repo.root);
        assert.equal(verified.kind, 'ok');
        assert.equal((await tool.execute('call', {}, undefined, undefined, repo.ctx())).details?.status, 'passed');
        const original = statSync(file);
        writeFileSync(file, 'bbbb');
        utimesSync(file, fixed, fixed);
        assert.equal(statSync(file).size, original.size);
        assert.equal(statSync(file).mtimeMs, original.mtimeMs);
        const changed = await workingTreeFingerprint(repo.root);
        assert.equal(changed.kind, 'ok');
        assert.notDeepEqual(changed, verified, 'content, not only metadata, is part of the digest');
        assert.equal((await tool.execute('call', {}, undefined, undefined, repo.ctx())).details?.status, 'passed', 'the new bytes require an explicit new run');
    } finally {
        repo.dispose();
    }
});

test('porcelain v2 rename source paths are not mistaken for status records', async () => {
    const repo = scratch(['true']);
    const git = (...args: string[]) => {
        const run = spawnSync('git', ['-C', repo.root, '-c', 'user.email=gate@cratis.io', '-c', 'user.name=gate', ...args], { encoding: 'utf8' });
        assert.equal(run.status, 0, `git ${args.join(' ')}: ${run.stderr}`);
    };
    try {
        writeFileSync(join(repo.root, '? missing.txt'), 'one');
        writeFileSync(join(repo.root, '1 .M S..U missing.txt'), 'two');
        git('add', '.');
        git('commit', '-q', '-m', 'track oddly named paths');
        git('mv', '? missing.txt', 'first.txt');
        git('mv', '1 .M S..U missing.txt', 'second.txt');
        assert.equal((await workingTreeFingerprint(repo.root)).kind, 'ok', 'rename source paths are not independent status records');
    } finally {
        repo.dispose();
    }
});

test('unmerged paths are unknown until conflicts are resolved', async () => {
    const repo = scratch(['true']);
    const git = (...args: string[]) => spawnSync('git', ['-C', repo.root, '-c', 'user.email=gate@cratis.io', '-c', 'user.name=gate', ...args], { encoding: 'utf8' });
    try {
        assert.equal(git('switch', '-q', '-c', 'alternate').status, 0);
        writeFileSync(join(repo.root, 'README.md'), 'alternate contents\n');
        assert.equal(git('commit', '-qam', 'alternate edit').status, 0);
        assert.equal(git('switch', '-q', '-').status, 0);
        writeFileSync(join(repo.root, 'README.md'), 'original contents\n');
        assert.equal(git('commit', '-qam', 'original edit').status, 0);
        assert.equal(git('merge', 'alternate').status, 1, 'the fixture must produce a real conflict');
        const status = git('status', '--porcelain=v2', '-z');
        assert.equal(status.status, 0);
        assert.ok(status.stdout.split('\0').some(entry => entry.startsWith('u ')), 'the fixture must include a porcelain v2 conflict record');
        const fingerprint = await workingTreeFingerprint(repo.root);
        assert.equal(fingerprint.kind, 'unknown');
        assert.match(fingerprint.kind === 'unknown' ? fingerprint.reason ?? '' : '', /unmerged paths; resolve conflicts/);
        const { tool } = bridge();
        await assert.rejects(() => tool.execute('call', {}, undefined, undefined, repo.ctx()), /unmerged paths; resolve conflicts.*Nothing was verified/);
    } finally {
        repo.dispose();
    }
});

test('a clean unstaged submodule pointer bump changes the fingerprint without blocking verification', async () => {
    const repo = scratch(['true']);
    const nestedSource = mkdtempSync(join(dirname(repo.root), 'gate-submodule-source-'));
    const git = (cwd: string, ...args: string[]) => {
        const run = spawnSync('git', ['-C', cwd, '-c', 'user.email=gate@cratis.io', '-c', 'user.name=gate', ...args], { encoding: 'utf8' });
        assert.equal(run.status, 0, `git ${args.join(' ')}: ${run.stderr}`);
        return run.stdout;
    };
    try {
        git(nestedSource, 'init', '-q');
        writeFileSync(join(nestedSource, 'nested.txt'), 'one');
        git(nestedSource, 'add', 'nested.txt');
        git(nestedSource, 'commit', '-q', '-m', 'nested initial');
        git(repo.root, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', nestedSource, 'nested');
        git(repo.root, 'add', '.gitmodules', 'nested');
        git(repo.root, 'commit', '-q', '-m', 'track nested');
        const initial = await workingTreeFingerprint(repo.root);
        assert.equal(initial.kind, 'ok');
        writeFileSync(join(repo.root, 'nested', 'nested.txt'), 'two');
        git(join(repo.root, 'nested'), 'add', 'nested.txt');
        git(join(repo.root, 'nested'), 'commit', '-q', '-m', 'bump nested pointer');
        assert.match(git(repo.root, 'status', '--porcelain=v2', '--ignore-submodules=none'), / SC\.\. /, 'the submodule is pointer-only changed, not dirty');
        const bumped = await workingTreeFingerprint(repo.root);
        assert.equal(bumped.kind, 'ok');
        assert.notDeepEqual(bumped, initial, 'the unstaged gitlink diff changes the fingerprint');
    } finally {
        repo.dispose();
        rmSync(nestedSource, { recursive: true, force: true });
    }
});

test('dirty tracked submodules cannot be verified even when Git is configured to ignore them', async () => {
    const repo = scratch(['true']);
    const nestedSource = mkdtempSync(join(dirname(repo.root), 'gate-submodule-source-'));
    const git = (cwd: string, ...args: string[]) => {
        const run = spawnSync('git', ['-C', cwd, '-c', 'user.email=gate@cratis.io', '-c', 'user.name=gate', ...args], { encoding: 'utf8' });
        assert.equal(run.status, 0, `git ${args.join(' ')}: ${run.stderr}`);
    };
    try {
        git(nestedSource, 'init', '-q');
        writeFileSync(join(nestedSource, 'nested.txt'), 'one');
        git(nestedSource, 'add', 'nested.txt');
        git(nestedSource, 'commit', '-q', '-m', 'nested initial');
        git(repo.root, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', nestedSource, 'nested');
        git(repo.root, 'add', '.gitmodules', 'nested');
        git(repo.root, 'commit', '-q', '-m', 'track nested');
        git(repo.root, 'config', 'diff.ignoreSubmodules', 'all');
        git(repo.root, 'config', 'submodule.nested.ignore', 'all');
        repo.change();
        const clean = await workingTreeFingerprint(repo.root);
        assert.equal(clean.kind, 'ok', 'a clean tracked submodule must not block normal verification');
        const { tool } = bridge();
        assert.equal((await tool.execute('call', {}, undefined, undefined, repo.ctx())).details?.status, 'passed');
        writeFileSync(join(repo.root, 'nested', 'nested.txt'), 'two');
        const dirty = await workingTreeFingerprint(repo.root);
        assert.equal(dirty.kind, 'unknown');
        assert.match(dirty.kind === 'unknown' ? dirty.reason ?? '' : '', /dirty tracked submodule/);
        await assert.rejects(() => tool.execute('call', {}, undefined, undefined, repo.ctx()), /dirty tracked submodule.*Nothing was verified/);
        writeFileSync(join(repo.root, 'nested', 'nested.txt'), 'new contents');
        assert.equal((await workingTreeFingerprint(repo.root)).kind, 'unknown', 'another nested content edit is still unverified');
        git(join(repo.root, 'nested'), 'restore', 'nested.txt');
        writeFileSync(join(repo.root, 'nested', 'untracked.txt'), 'untracked nested content');
        const untracked = await workingTreeFingerprint(repo.root);
        assert.equal(untracked.kind, 'unknown');
        assert.match(untracked.kind === 'unknown' ? untracked.reason ?? '' : '', /dirty tracked submodule/);
    } finally {
        repo.dispose();
        rmSync(nestedSource, { recursive: true, force: true });
    }
});

test('touching identical untracked content does not invalidate a passing gate', async () => {
    const repo = scratch(['bash', '-c', 'touch change.txt']);
    try {
        repo.change('change.txt', 'identical content');
        const fixed = new Date('2020-01-01T00:00:00.000Z');
        utimesSync(join(repo.root, 'change.txt'), fixed, fixed);
        const { tool } = bridge();
        assert.equal((await tool.execute('call', {}, undefined, undefined, repo.ctx())).details?.status, 'passed');
    } finally {
        repo.dispose();
    }
});

test('the gate binds planning and execution to the fingerprinted root, even in a subdirectory', async () => {
    const repo = scratch(['true']);
    try {
        repo.change();
        mkdirSync(join(repo.root, 'subdir'));
        process.env.CLAUDE_PROJECT_DIR = tmpdir();
        const { tool } = bridge();
        const result = await tool.execute('call', {}, undefined, undefined, { ...repo.ctx(), cwd: join(repo.root, 'subdir') });
        assert.equal(result.details?.status, 'passed');
        assert.match(result.content[0].text, /scratch-gate/);
    } finally {
        repo.dispose();
    }
});

test('subdirectory fingerprints include already-dirty tracked files outside the subdirectory with diff.relative enabled', async () => {
    const repo = scratch(['true']);
    const git = (...args: string[]) => spawnSync('git', ['-C', repo.root, ...args], { encoding: 'utf8' });
    try {
        const subdir = join(repo.root, 'subdir');
        mkdirSync(subdir);
        const configured = git('config', 'diff.relative', 'true');
        assert.equal(configured.status, 0, configured.stderr);
        const outside = join(repo.root, 'README.md');
        writeFileSync(outside, 'outside one\n');
        const initial = await workingTreeFingerprint(subdir);
        assert.equal(initial.kind, 'ok');
        const omitted = spawnSync('git', ['diff', 'HEAD', '--no-ext-diff', '--binary', '--ignore-submodules=none'], { cwd: subdir, encoding: 'utf8' });
        assert.equal(omitted.status, 0, omitted.stderr);
        assert.equal(omitted.stdout, '', 'diff.relative omits the tracked change outside cwd without --no-relative');
        writeFileSync(outside, 'outside two\n');
        const changed = await workingTreeFingerprint(subdir);
        assert.equal(changed.kind, 'ok');
        assert.notDeepEqual(changed, initial, 'different outside tracked bytes must invalidate the already-dirty fingerprint');
    } finally {
        repo.dispose();
    }
});

test('a non-repository cannot claim the gate was verified', async () => {
    const repo = scratch(['true']);
    try {
        const { tool } = bridge();
        await assert.rejects(() => tool.execute('call', {}, undefined, undefined, { ...repo.ctx(), cwd: tmpdir() }), /not in a Git repository; nothing was verified/);
    } finally {
        repo.dispose();
    }
});

test('unborn HEAD cannot fingerprint already-staged files as unchanged', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cratis-gate-unborn-'));
    try {
        assert.equal(spawnSync('git', ['init', '-q', root]).status, 0);
        writeFileSync(join(root, 'staged.txt'), 'one');
        assert.equal(spawnSync('git', ['-C', root, 'add', 'staged.txt']).status, 0);
        writeFileSync(join(root, 'staged.txt'), 'two');
        writeFileSync(join(root, 'change.txt'), 'trigger');
        const fingerprint = await workingTreeFingerprint(root);
        assert.equal(fingerprint.kind, 'unknown');
        assert.match(fingerprint.kind === 'unknown' ? fingerprint.reason ?? '' : '', /no initial commit/);
        const repo = scratch(['true']);
        try {
            const { tool } = bridge();
            await assert.rejects(() => tool.execute('call', {}, undefined, undefined, { ...repo.ctx(), cwd: root }), /HEAD has no initial commit.*Nothing was verified/);
        } finally {
            repo.dispose();
        }
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('nested untracked repositories are refused with the offending entry named', async () => {
    const repo = scratch(['true']);
    try {
        const nested = join(repo.root, 'nested');
        mkdirSync(nested);
        assert.equal(spawnSync('git', ['init', '-q', nested]).status, 0);
        writeFileSync(join(nested, 'change.txt'), 'unsafe nested change');
        const fingerprint = await workingTreeFingerprint(repo.root);
        assert.equal(fingerprint.kind, 'unknown');
        assert.match(fingerprint.kind === 'unknown' ? fingerprint.reason ?? '' : '', /nested\//);
        const { tool } = bridge();
        await assert.rejects(() => tool.execute('call', {}, undefined, undefined, repo.ctx()), /nested\//);
    } finally {
        repo.dispose();
    }
});

test('an untracked symlink hashes its link text without following a target outside the repository', async () => {
    const repo = scratch(['true']);
    const external = join(dirname(repo.root), `${basename(repo.root)}-external.txt`);
    try {
        writeFileSync(external, 'outside one');
        const link = join(repo.root, 'link.txt');
        symlinkSync(external, link);
        const initial = await workingTreeFingerprint(repo.root);
        assert.equal(initial.kind, 'ok');
        writeFileSync(external, 'outside two');
        assert.deepEqual(await workingTreeFingerprint(repo.root), initial, 'target contents outside the repository are not read');
        rmSync(link);
        symlinkSync(`${external}-different`, link);
        assert.notDeepEqual(await workingTreeFingerprint(repo.root), initial, 'a new symlink target changes the fingerprint');
    } finally {
        repo.dispose();
        rmSync(external, { force: true });
    }
});

test('a multi-directory plan displays each gate once with its distinct package count', () => {
    const output = [
        'cratis-quality-gate: RUN   frontend-lint lint',
        '                            $ yarn lint:ci   (cwd: a)',
        'cratis-quality-gate: RUN   frontend-lint lint',
        '                            $ yarn lint:ci   (cwd: b)',
        'cratis-quality-gate: RUN   frontend-lint lint',
        '                            $ yarn lint:ci   (cwd: c)',
        'cratis-quality-gate: RUN   frontend-lint lint',
        '                            $ yarn lint:ci   (cwd: c)',
        'cratis-quality-gate: RUN   frontend-compile compile',
        '                            $ yarn g:compile   (cwd: a)',
        'cratis-quality-gate: RUN   frontend-compile compile',
        '                            $ yarn g:compile   (cwd: b)',
    ].join('\n');
    assert.deepEqual(parseGatePlan(output), ['frontend-lint (3 packages)', 'frontend-compile (2 packages)']);
});

test('per-directory log identity retains the actual gate id and cwd, including ids ending in numbers', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cratis-gate-log-display-'));
    const file = join(directory, 'frontend-lint-2-3.log');
    try {
        writeFileSync(file, 'cratis-quality-gate: LOG frontend-lint-2 (cwd: Source/Client)\ncommand output\n');
        assert.deepEqual(latestGateLog(directory, Date.now() - 1000), { gate: 'frontend-lint-2', cwd: 'Source/Client', file });
        writeFileSync(file, 'legacy command output\n');
        assert.deepEqual(latestGateLog(directory, Date.now() - 1000), { gate: 'frontend-lint-2-3', file });
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

test('gate timeouts and dry-run plans are parsed defensively', () => {
    assert.equal(gateTimeoutSeconds(undefined, undefined), 300);
    assert.equal(gateTimeoutSeconds(undefined, '120'), 120);
    assert.equal(gateTimeoutSeconds(30, '120'), 30, 'an explicit request wins over the environment');
    assert.equal(gateTimeoutSeconds(undefined, 'soon'), 300);
    assert.equal(gateTimeoutSeconds(999_999, undefined), 600);
    assert.equal(gateTimeoutSeconds(undefined, '999999'), 600, 'environment overrides obey the same cap');
    assert.equal(gateTimeoutSeconds(0, undefined), 1);
    assert.deepEqual(
        parseGatePlan('cratis-quality-gate: SKIP  frontend-lint (no matching change)\ncratis-quality-gate: RUN   backend-build-debug dotnet build\n                            $ dotnet build   (cwd: .)\ncratis-quality-gate: RUN   backend-specs dotnet test\n'),
        ['backend-build-debug', 'backend-specs'],
    );
    assert.deepEqual(parseGatePlan(''), []);
});
