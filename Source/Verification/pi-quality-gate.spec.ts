// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * The Pi quality gate must never freeze a session between prompts.
 *
 * Pi awaits `agent_settled` handlers and defers the next prompt until they finish. The bridge must not
 * request or run the gate automatically at any turn boundary, including turns with edits. The gate runs
 * only as an explicit tool, with a deadline and cancellation, and a timeout, a
 * cancellation or a failure is always an error: never a pass. These fixtures prove each of those against the
 * real gate script, driven by a throwaway repository and a gate configuration whose command never finishes.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { bridge, scratch } from './pi-quality-gate.fixture.ts';

test('the Pi bridge has no automatic gate handler at any turn boundary', () => {
    const { handlers, tool } = bridge();
    assert.deepEqual([...handlers.keys()].sort(), ['session_shutdown', 'session_start', 'tool_call', 'tool_result']);
    assert.equal(tool.executionMode, 'sequential', 'the gate must not run beside an edit in the same batch');
});

test('the tool description identifies both configuration paths and how replacements merge', () => {
    const { tool } = bridge();
    assert.match(tool.description, /Shipped defaults: \.cratis\/ai\/hooks\/scripts\/quality-gates\.json/);
    assert.match(tool.description, /project overrides: \.cratis\/ai\/quality-gates\.project\.json, shallow-merged by gate id/);
    assert.match(tool.description, /command without requires drops inherited packageScripts/);
    assert.match(tool.description, /CRATIS_HOOKS_GATES replaces the defaults; project overrides still merge over it/);
});

test('a per-gate timeout is a named tool failure and kills TERM-resistant descendants', async () => {
    const repo = scratch(['bash', '-c', 'bash -c \'trap "" TERM; echo $$ > child.pid; while :; do sleep 1; done\' & wait'], {
        timeoutSeconds: 1, timeoutHint: 'dotnet test Affected.Specs.csproj --configuration Debug --no-build',
    });
    try {
        repo.change();
        const { tool } = bridge();
        await assert.rejects(() => tool.execute('call', { timeoutSeconds: 15 }, undefined, undefined, repo.ctx()), (error: Error) => {
            assert.match(error.message, /QUALITY GATE TIMED OUT: scratch-gate after 1s/);
            assert.match(error.message, /NOT VERIFIED/);
            assert.match(error.message, /Run a narrower command instead: dotnet test Affected\.Specs\.csproj/);
            return true;
        });
        const child = Number(readFileSync(join(repo.root, 'child.pid'), 'utf8').trim());
        const state = spawnSync('ps', ['-p', String(child), '-o', 'stat='], { encoding: 'utf8' });
        assert.ok(state.status !== 0 || state.stdout.trim().startsWith('Z'), `the test host survived its gate deadline: ${state.stdout.trim()}`);
    } finally {
        repo.dispose();
    }
});

test('cancellation also stops commands running with their own per-gate deadline', async () => {
    const repo = scratch(['bash', '-c', 'echo $$ > child.pid; exec sleep 600'], { timeoutSeconds: 120 });
    const controller = new AbortController();
    try {
        repo.change();
        const { tool } = bridge();
        const execution = tool.execute('call', { timeoutSeconds: 15 }, controller.signal, undefined, repo.ctx());
        const cancelled = assert.rejects(execution, /cancelled.*Nothing was verified/);
        const started = Date.now();
        while (!existsSync(join(repo.root, 'child.pid')) && Date.now() - started < 5_000) {
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        assert.ok(existsSync(join(repo.root, 'child.pid')), 'the timed command must start before cancellation');
        const child = Number(readFileSync(join(repo.root, 'child.pid'), 'utf8').trim());
        controller.abort();
        await cancelled;
        assert.throws(() => process.kill(child, 0), 'the timed command must not escape Pi cancellation');
    } finally {
        controller.abort();
        repo.dispose();
    }
});

test('read-only turns and edits never request or run the full gate', async () => {
    const repo = scratch(['sleep', '600']);
    try {
        const { handlers, sent } = bridge();
        assert.equal(handlers.has('agent_end'), false);
        assert.equal(handlers.has('input'), false);
        assert.equal(await handlers.get('tool_call')?.({ toolName: 'read', input: { path: join(repo.root, 'README.md') } }, repo.ctx()), undefined);
        assert.equal(await handlers.get('tool_call')?.({ toolName: 'write', input: { path: join(repo.root, 'change.txt'), content: 'x' } }, repo.ctx()), undefined);
        repo.change();
        assert.equal(await handlers.get('tool_call')?.({ toolName: 'edit', input: { path: join(repo.root, 'change.txt'), edits: [] } }, repo.ctx()), undefined);
        assert.equal(sent.length, 0, 'no follow-up turns are requested even after editing');
    } finally {
        repo.dispose();
    }
});

test('a gate that outlives its deadline is stopped and reported as timed out, never as a pass', async () => {
    const repo = scratch(['sleep', '600']);
    try {
        const { tool } = bridge();
        repo.change();
        const started = Date.now();
        await assert.rejects(
            () => tool.execute('call', { timeoutSeconds: 1 }, undefined, undefined, repo.ctx()),
            (error: Error) => {
                assert.match(error.message, /TIMED OUT after 1s/);
                assert.match(error.message, /not a pass/);
                return true;
            },
        );
        assert.ok(Date.now() - started < 20_000, 'the timeout bounds the run');
    } finally {
        repo.dispose();
    }
});

test('a timed-out gate includes its bounded log tail and log path', async () => {
    const repo = scratch(['bash', '-c', 'echo distinctive-gate-output; exec sleep 600']);
    try {
        const { tool } = bridge();
        repo.change();
        // The gate needs time to start and write its log before the deadline; 1 s is too short on a loaded machine.
        await assert.rejects(() => tool.execute('call', { timeoutSeconds: 5 }, undefined, undefined, repo.ctx()), (error: Error) => {
            assert.match(error.message, /TIMED OUT after 5s/);
            assert.match(error.message, /scratch-gate\.log/);
            assert.match(error.message, /distinctive-gate-output/);
            return true;
        });
    } finally {
        repo.dispose();
    }
});

test('a timeout identifies the gate and directory rather than a per-directory log suffix', async () => {
    const repo = scratch(['/bin/sh', '-c', 'case "$PWD" in */b) echo second-package-output; exec sleep 600 ;; esac']);
    try {
        for (const directory of ['a', 'b']) {
            mkdirSync(join(repo.root, directory));
            writeFileSync(join(repo.root, directory, 'package.json'), '{}');
            repo.change(`${directory}/change.txt`);
        }
        const config = process.env.CRATIS_HOOKS_GATES;
        assert.ok(config);
        writeFileSync(config, JSON.stringify({ gates: [{
            id: 'scratch-gate', changed: ['**/*.txt'], workingDirectoryFrom: ['**/package.json'],
            command: ['/bin/sh', '-c', 'case "$PWD" in */b) echo second-package-output; exec sleep 600 ;; esac'],
        }] }));
        const { tool } = bridge();
        await assert.rejects(() => tool.execute('call', { timeoutSeconds: 2 }, undefined, undefined, repo.ctx()), (error: Error) => {
            assert.match(error.message, /while running 'scratch-gate' \(cwd: b\)/);
            assert.match(error.message, /scratch-gate-2\.log/);
            assert.match(error.message, /second-package-output/);
            assert.doesNotMatch(error.message, /while running 'scratch-gate-2'/);
            return true;
        });
    } finally {
        repo.dispose();
    }
});

