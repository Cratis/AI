// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { isNotRepositoryError, runBounded, workingTreeFingerprint } from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/quality-gate.ts';
import { bridge, scratch } from './pi-quality-gate.fixture.ts';

test('a bounded run stops the whole process tree at its deadline', async () => {
    const run = await runBounded('bash', ['-c', 'sleep 600 & echo $!; wait'], { cwd: tmpdir(), timeoutMs: 500, killGraceMs: 500 });
    assert.equal(run.timedOut, true);
    const child = Number(run.stdout.trim());
    assert.ok(child > 0, 'the grandchild pid was printed');
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.throws(() => process.kill(child, 0), 'the grandchild must not outlive the gate');
});

test('a bounded run decodes UTF-8 split across stdout and stderr chunks without changing raw callbacks', async () => {
    const chunks: Buffer[] = [];
    const run = await runBounded(process.execPath, ['-e', `
        process.stdout.write(Buffer.from([0xe2]));
        process.stderr.write(Buffer.from([0xf0, 0x9f]));
        setTimeout(() => {
            process.stdout.write(Buffer.from([0x82, 0xac]));
            process.stderr.write(Buffer.from([0x98, 0x80]));
        }, 100);
    `], { cwd: tmpdir(), timeoutMs: 2_000, onStdout: chunk => chunks.push(Buffer.from(chunk)) });
    assert.equal(run.code, 0);
    assert.equal(run.stdout, '€');
    assert.equal(run.stderr, '😀');
    assert.equal(run.stdoutTruncated, false);
    assert.ok(chunks.length >= 2, 'the multibyte character was split between stdout data events');
    assert.deepEqual(Buffer.concat(chunks), Buffer.from('€'));
    const incomplete = await runBounded(process.execPath, ['-e', `
        process.stdout.write(Buffer.from([0xe2]));
        process.stderr.write(Buffer.from([0xf0]));
    `], { cwd: tmpdir(), timeoutMs: 2_000 });
    assert.equal(incomplete.code, 0);
    assert.equal(incomplete.stdout, '�', 'the stdout decoder flushes an incomplete character at EOF');
    assert.equal(incomplete.stderr, '�', 'the stderr decoder flushes an incomplete character at EOF');
});

test('an inherited dry-run flag never reports a verified gate', async () => {
    const repo = scratch(['true']);
    try {
        const { tool } = bridge();
        repo.change();
        process.env.CRATIS_HOOKS_GATE_DRYRUN = '1';
        const result = await tool.execute('call', {}, undefined, undefined, repo.ctx());
        assert.equal(result.details?.status, 'dry-run');
        assert.match(result.content[0].text, /NOT VERIFIED/);
    } finally {
        repo.dispose();
    }
});

test('both of Git\'s discovery failures mean not a repository, and a broken GIT_DIR does not', () => {
    assert.equal(isNotRepositoryError('fatal: not a git repository (or any of the parent directories): .git\n'), true);
    assert.equal(isNotRepositoryError('fatal: not a git repository (or any parent up to mount point /tmp)\nStopping at filesystem boundary (GIT_DISCOVERY_ACROSS_FILESYSTEM not set).\n'), true);
    assert.equal(isNotRepositoryError("fatal: not a git repository: '/repo/missing-git-dir'\n"), false);
    assert.equal(isNotRepositoryError('fatal: detected dubious ownership in repository at \'/repo\'\n'), false);
});

test('failed fingerprints are unknown, not evidence that the working tree was unchanged', async () => {
    const repo = scratch(['true']);
    try {
        const aborted = new AbortController();
        aborted.abort();
        assert.deepEqual(await workingTreeFingerprint(repo.root, 1000, aborted.signal), { kind: 'unknown' });
        assert.deepEqual(await workingTreeFingerprint(tmpdir()), { kind: 'not-repository' });
        const originalGitDir = process.env.GIT_DIR;
        try {
            process.env.GIT_DIR = join(repo.root, 'missing-git-dir');
            assert.deepEqual(await workingTreeFingerprint(repo.root), { kind: 'unknown' }, 'a broken Git environment is not a non-repository');
        } finally {
            if (originalGitDir === undefined) delete process.env.GIT_DIR;
            else process.env.GIT_DIR = originalGitDir;
        }
        repo.change();
        const { tool } = bridge();
        const savedGitDir = process.env.GIT_DIR;
        try {
            process.env.GIT_DIR = join(repo.root, 'missing-git-dir');
            await assert.rejects(() => tool.execute('call', {}, undefined, undefined, repo.ctx()), /nothing was verified|could not be completed/i);
        } finally {
            if (savedGitDir === undefined) delete process.env.GIT_DIR;
            else process.env.GIT_DIR = savedGitDir;
        }
    } finally {
        repo.dispose();
    }
});

test('planning-time removal of the triggering edit cannot claim the planned gate executed', async () => {
    const repo = scratch(['true']);
    const shim = mkdtempSync(join(dirname(repo.root), 'gate-git-shim-'));
    const originalPath = process.env.PATH;
    const git = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
    try {
        repo.change();
        const wrapper = join(shim, 'git');
        writeFileSync(wrapper, `#!/bin/sh\nif [ "\${CRATIS_HOOKS_GATE_DRYRUN:-0}" = 1 ] && [ "\${3:-}" = ls-files ]; then\n    "${git}" "$@"\n    rm -f "${join(repo.root, 'change.txt')}"\nelse\n    exec "${git}" "$@"\nfi\n`);
        chmodSync(wrapper, 0o755);
        process.env.PATH = `${shim}:${originalPath}`;
        const { tool } = bridge();
        const updates: Array<{ details?: { status?: string; gates?: string[] } }> = [];
        await assert.rejects(() => tool.execute('call', {}, undefined, update => updates.push(update as typeof updates[number]), repo.ctx()), /older tree; this tree is NOT VERIFIED/);
        assert.ok(updates.some(update => update.details?.status === 'running' && update.details.gates?.includes('scratch-gate')), 'the dry run must actually have planned a gate');
        assert.equal(existsSync(join(repo.root, 'change.txt')), false);
    } finally {
        process.env.PATH = originalPath;
        repo.dispose();
        rmSync(shim, { recursive: true, force: true });
    }
});

test('a gate cannot verify edits made while it ran, even when its command succeeds', async () => {
    const repo = scratch(['sleep', '1']);
    try {
        const { tool } = bridge();
        repo.change();
        let changed = false;
        let scheduled = false;
        await assert.rejects(() => tool.execute('call', {}, undefined, update => {
            if (!scheduled && (update as { details?: { status?: string } }).details?.status === 'running') {
                scheduled = true;
                setTimeout(() => {
                    changed = true;
                    repo.change('change.txt', 'external edit while gate ran\n');
                }, 350);
            }
        }, repo.ctx()), /older tree; this tree is NOT VERIFIED/);
        assert.equal(changed, true);
    } finally {
        repo.dispose();
    }
});

test('lossy textconv cannot hide an edit to an already-dirty tracked file during a gate', async () => {
    const repo = scratch(['sleep', '1']);
    const git = (...args: string[]) => {
        const run = spawnSync('git', ['-C', repo.root, '-c', 'user.email=gate@cratis.io', '-c', 'user.name=gate', ...args], { encoding: 'utf8' });
        assert.equal(run.status, 0, `git ${args.join(' ')}: ${run.stderr}`);
        return run.stdout;
    };
    try {
        writeFileSync(join(repo.root, '.gitattributes'), 'change.txt diff=lossy\n');
        repo.change('change.txt', 'baseline\n');
        git('add', '.gitattributes', 'change.txt');
        git('commit', '-q', '-m', 'track textconv fixture');
        git('config', 'diff.lossy.textconv', "sed 's/[0-9]//g'");
        // Git's abbreviated index line can also collide, leaving textconv's lossy patch identical.
        git('config', 'core.abbrev', '4');
        repo.change('change.txt', 'dirty59\n');
        const initial = await workingTreeFingerprint(repo.root);
        assert.equal(initial.kind, 'ok');
        const textconvDiff = git('diff', 'HEAD', '--no-relative', '--no-ext-diff', '--binary', '--ignore-submodules=none');
        assert.match(textconvDiff, /dirty/);
        repo.change('change.txt', 'dirty288\n');
        assert.equal(git('diff', 'HEAD', '--no-relative', '--no-ext-diff', '--binary', '--ignore-submodules=none'), textconvDiff, 'the configured driver hides the changed raw bytes');
        const changed = await workingTreeFingerprint(repo.root);
        assert.equal(changed.kind, 'ok');
        assert.notDeepEqual(changed, initial, 'raw tracked bytes must change the fingerprint');

        repo.change('change.txt', 'dirty59\n');
        const { tool } = bridge();
        let edited = false;
        await assert.rejects(() => tool.execute('call', {}, undefined, update => {
            if (!edited && (update as { details?: { status?: string } }).details?.status === 'running') {
                edited = true;
                setTimeout(() => repo.change('change.txt', 'dirty288\n'), 350);
            }
        }, repo.ctx()), /older tree; this tree is NOT VERIFIED/);
        assert.equal(edited, true, 'the gate must have run while the tracked file changed');
    } finally {
        repo.dispose();
    }
});

test('a successful gate that generated a source file leaves the new tree unverified', async () => {
    const repo = scratch(['bash', '-c', 'printf generated > generated.txt']);
    try {
        repo.change();
        const { tool } = bridge();
        await assert.rejects(() => tool.execute('call', {}, undefined, undefined, repo.ctx()), /older tree; this tree is NOT VERIFIED/);
    } finally {
        repo.dispose();
    }
});

test('planning reports progress immediately and respects cancellation before starting a gate', async () => {
    const repo = scratch(['true']);
    try {
        repo.change();
        const { tool } = bridge();
        const controller = new AbortController();
        const updates: unknown[] = [];
        await assert.rejects(() => tool.execute('call', {}, controller.signal, update => {
            updates.push(update);
            controller.abort();
        }, repo.ctx()), /cancelled.*Nothing was verified/);
        assert.equal((updates[0] as { details: { status: string } }).details.status, 'planning');
    } finally {
        repo.dispose();
    }
});
