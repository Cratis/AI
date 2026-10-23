// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { bridge, scratch } from './pi-quality-gate.fixture.ts';

test('cancelling the gate stops it and reports that nothing was verified', async () => {
    const repo = scratch(['sleep', '600']);
    try {
        const { tool } = bridge();
        repo.change();
        const cancel = new AbortController();
        const updates: unknown[] = [];
        setTimeout(() => cancel.abort(), 1500);
        await assert.rejects(
            () => tool.execute('call', {}, cancel.signal, update => updates.push(update), repo.ctx()),
            /cancelled.*Nothing was verified/,
        );
        assert.ok(updates.length > 0, 'the running gate reports progress');
    } finally {
        repo.dispose();
    }
});

test('session shutdown awaits escalation of a TERM-resistant gate descendant', async () => {
    const repo = scratch(['bash', '-c', 'trap "" TERM; echo $$ > "$1"; while :; do sleep 1; done', '_', 'gate-child.pid']);
    const controller = new AbortController();
    const childFile = join(repo.root, 'gate-child.pid');
    try {
        repo.change();
        const { tool, handlers } = bridge();
        const execution = tool.execute('call', {}, controller.signal, undefined, repo.ctx());
        const cancelled = assert.rejects(execution, /cancelled.*Nothing was verified/);
        const started = Date.now();
        while (!existsSync(childFile) && Date.now() - started < 5_000) {
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        assert.ok(existsSync(childFile), 'the gate descendant must be running before shutdown');
        const child = Number(readFileSync(childFile, 'utf8').trim());
        let finished = false;
        const shutdown = Promise.resolve(handlers.get('session_shutdown')?.({}, repo.ctx())).then(() => { finished = true; });
        await new Promise(resolve => setTimeout(resolve, 100));
        assert.equal(finished, false, 'shutdown must wait for SIGKILL escalation before Pi exits');
        await shutdown;
        await cancelled;
        const state = spawnSync('ps', ['-p', String(child), '-o', 'stat='], { encoding: 'utf8' });
        assert.ok(state.status !== 0 || state.stdout.trim().startsWith('Z'), `the gate descendant survived shutdown: ${state.stdout.trim()}`);
    } finally {
        controller.abort();
        repo.dispose();
    }
});

test('a failing explicit gate is an error; a passing explicit gate verifies the current dirty tree', async () => {
    const failing = scratch(['false']);
    try {
        const { tool } = bridge();
        failing.change();
        await assert.rejects(() => tool.execute('call', {}, undefined, undefined, failing.ctx()), /QUALITY GATE FAILED: scratch-gate/);
    } finally {
        failing.dispose();
    }

    const passing = scratch(['true']);
    try {
        const { tool } = bridge();
        passing.change();
        const result = await tool.execute('call', {}, undefined, undefined, passing.ctx());
        assert.equal(result.details?.status, 'passed');
        assert.match(result.content[0].text, /passed .*scratch-gate/);
        passing.change('second.txt');
        const second = await tool.execute('call', {}, undefined, undefined, passing.ctx());
        assert.equal(second.details?.status, 'passed', 'explicit invocation considers all dirty files without a per-turn cache');
        assert.match(second.content[0].text, /scratch-gate/);
    } finally {
        passing.dispose();
    }
});

test('a rejected Pi gate plan preserves the script diagnostic and configuration remedy', async () => {
    const repo = scratch(['/bin/true']);
    try {
        for (const directory of ['a', 'b']) {
            mkdirSync(join(repo.root, directory));
            writeFileSync(join(repo.root, directory, 'package.json'), '{}');
        }
        const config = process.env.CRATIS_HOOKS_GATES;
        assert.ok(config);
        writeFileSync(config, JSON.stringify({ gates: [{
            id: 'scratch-gate', changed: ['*.txt'], workingDirectoryFrom: ['**/package.json'],
            command: ['/bin/true'],
        }] }));
        repo.change('uncontained.txt');
        const { tool } = bridge();
        await assert.rejects(() => tool.execute('call', {}, undefined, undefined, repo.ctx()), (error: Error) => {
            assert.match(error.message, /dry run could not be completed \(exit 2\)/);
            assert.match(error.message, /UNVERIFIED — no containing project for uncontained\.txt/);
            assert.match(error.message, /Configure workingDirectory/);
            assert.match(error.message, /Nothing was verified/);
            return true;
        });
    } finally {
        repo.dispose();
    }
});

test('a known gate failure keeps its stderr without starting a post-run fingerprint or accepting a late abort', async () => {
    const repo = scratch(['bash', '-c', 'echo distinctive-gate-failure >&2; exit 2']);
    const shim = mkdtempSync(join(dirname(repo.root), 'gate-git-shim-'));
    const originalPath = process.env.PATH;
    const git = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
    const firstFingerprint = join(shim, 'first-fingerprint');
    const postFingerprint = join(shim, 'post-fingerprint');
    try {
        repo.change();
        writeFileSync(join(shim, 'git'), `#!/bin/sh\nif [ "\${GIT_OPTIONAL_LOCKS:-}" = 0 ] && [ "\${1:-}" = rev-parse ] && [ "\${2:-}" = --show-toplevel ]; then\n    if [ -f "${firstFingerprint}" ]; then\n        : > "${postFingerprint}"\n        sleep 2\n    else\n        : > "${firstFingerprint}"\n    fi\nfi\nexec "${git}" "$@"\n`);
        chmodSync(join(shim, 'git'), 0o755);
        process.env.PATH = `${shim}:${originalPath}`;
        const { tool } = bridge();
        const cancel = new AbortController();
        let finished = false;
        const lateAbort = (async () => {
            while (!finished && !existsSync(postFingerprint)) await new Promise(resolve => setTimeout(resolve, 10));
            if (existsSync(postFingerprint)) cancel.abort();
        })();
        let failure: unknown;
        try {
            await tool.execute('call', {}, cancel.signal, undefined, repo.ctx());
        } catch (error) {
            failure = error;
        } finally {
            finished = true;
            await lateAbort;
        }
        assert.ok(existsSync(firstFingerprint), 'the pre-run fingerprint must have completed');
        assert.equal(existsSync(postFingerprint), false, 'a failed gate must not start a post-run fingerprint');
        assert.equal(cancel.signal.aborted, false, 'no late abort was needed after the known failure');
        assert.ok(failure instanceof Error, 'the gate must reject');
        assert.match(failure.message, /QUALITY GATE FAILED: scratch-gate[\s\S]*distinctive-gate-failure/);
    } finally {
        process.env.PATH = originalPath;
        repo.dispose();
        rmSync(shim, { recursive: true, force: true });
    }
});

test('no applicable gate is reported as no verification, not a pass', async () => {
    const repo = scratch(['true']);
    try {
        const { tool } = bridge();
        const result = await tool.execute('call', {}, undefined, undefined, repo.ctx());
        assert.equal(result.details?.status, 'no-applicable-gates');
        assert.match(result.content[0].text, /nothing was verified/);
    } finally {
        repo.dispose();
    }
});

test('the gate honors the skip escape hatch without claiming a pass', async () => {
    const repo = scratch(['true']);
    try {
        process.env.CRATIS_HOOKS_SKIP_GATE = '1';
        const { tool } = bridge();
        const result = await tool.execute('call', {}, undefined, undefined, repo.ctx());
        assert.equal(result.details?.status, 'skipped');
        assert.match(result.content[0].text, /nothing was verified/);
    } finally {
        repo.dispose();
    }
});
