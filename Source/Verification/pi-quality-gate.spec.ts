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
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import registerCratisHooks, { QUALITY_GATE_TOOL_NAME } from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/index.ts';
import { gateTimeoutSeconds, parseGatePlan, runBounded, tailLines, workingTreeFingerprint } from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/quality-gate.ts';

type Handler = (event: unknown, ctx: unknown) => Promise<unknown> | unknown;
type GateTool = {
    name: string;
    executionMode?: string;
    execute: (id: string, params: { timeoutSeconds?: number }, signal: AbortSignal | undefined, onUpdate: ((update: unknown) => void) | undefined, ctx: unknown) => Promise<{ content: Array<{ text: string }>; details?: { status?: string } }>;
};

function bridge() {
    const handlers = new Map<string, Handler>();
    const tools: GateTool[] = [];
    const sent: unknown[] = [];
    registerCratisHooks({
        on: (event: string, handler: Handler) => handlers.set(event, handler),
        registerTool: (tool: GateTool) => tools.push(tool),
        sendMessage: (message: unknown) => sent.push(message),
        sendUserMessage: (message: unknown) => sent.push(message),
    } as unknown as ExtensionAPI);
    const tool = tools.find(candidate => candidate.name === QUALITY_GATE_TOOL_NAME);
    assert.ok(tool, 'the bridge registers the quality gate tool');
    return { handlers, tool, sent };
}

/** A committed scratch repository and a gate configuration whose one gate runs `command` for any changed .txt file. */
function scratch(command: string[]) {
    const workDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.ai-work');
    mkdirSync(workDirectory, { recursive: true });
    const root = mkdtempSync(join(workDirectory, 'cratis-gate-'));
    const git = (...args: string[]) => spawnSync('git', ['-C', root, '-c', 'user.email=gate@cratis.io', '-c', 'user.name=gate', ...args], { encoding: 'utf8' });
    git('init', '-q');
    writeFileSync(join(root, 'README.md'), '# scratch\n');
    git('add', '.');
    git('commit', '-q', '-m', 'initial');
    const gates = join(root, '..', `${root.split('/').pop()}-gates.json`);
    writeFileSync(gates, JSON.stringify({
        enabled: true,
        failFast: true,
        maxOutputLines: 20,
        gates: [{ id: 'scratch-gate', description: 'scratch gate', changed: ['*.txt', '**/*.txt'], workingDirectory: '.', command }],
    }));
    const saved = {
        gates: process.env.CRATIS_HOOKS_GATES,
        skip: process.env.CRATIS_HOOKS_SKIP_GATE,
        timeout: process.env.CRATIS_HOOKS_GATE_TIMEOUT_SECONDS,
        project: process.env.CLAUDE_PROJECT_DIR,
        dryRun: process.env.CRATIS_HOOKS_GATE_DRYRUN,
    };
    process.env.CRATIS_HOOKS_GATES = gates;
    // The gate script locates the repository from CLAUDE_PROJECT_DIR, else from its own location.
    process.env.CLAUDE_PROJECT_DIR = root;
    delete process.env.CRATIS_HOOKS_SKIP_GATE;
    delete process.env.CRATIS_HOOKS_GATE_TIMEOUT_SECONDS;
    delete process.env.CRATIS_HOOKS_GATE_DRYRUN;
    const session = `spec-${Math.random().toString(36).slice(2)}`;
    const ctx = (mode = 'tui', signal?: AbortSignal) => ({ cwd: root, mode, signal, sessionManager: { getSessionId: () => session } });
    return {
        root,
        ctx,
        change: (name = 'change.txt', content = `${Date.now()}\n`) => writeFileSync(join(root, name), content),
        dispose: () => {
            for (const [key, value] of [['CRATIS_HOOKS_GATES', saved.gates], ['CRATIS_HOOKS_SKIP_GATE', saved.skip], ['CRATIS_HOOKS_GATE_TIMEOUT_SECONDS', saved.timeout], ['CLAUDE_PROJECT_DIR', saved.project], ['CRATIS_HOOKS_GATE_DRYRUN', saved.dryRun]] as const) {
                if (value === undefined) delete process.env[key];
                else process.env[key] = value;
            }
            rmSync(root, { recursive: true, force: true });
            rmSync(gates, { force: true });
        },
    };
}

test('the Pi bridge has no automatic gate handler at any turn boundary', () => {
    const { handlers, tool } = bridge();
    assert.deepEqual([...handlers.keys()].sort(), ['session_shutdown', 'tool_call', 'tool_result']);
    assert.equal(tool.executionMode, 'sequential', 'the gate must not run beside an edit in the same batch');
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
        await assert.rejects(() => tool.execute('call', { timeoutSeconds: 1 }, undefined, undefined, repo.ctx()), (error: Error) => {
            assert.match(error.message, /TIMED OUT after 1s/);
            assert.match(error.message, /scratch-gate\.log/);
            assert.match(error.message, /distinctive-gate-output/);
            return true;
        });
    } finally {
        repo.dispose();
    }
});

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

test('a bounded run stops the whole process tree at its deadline', async () => {
    const run = await runBounded('bash', ['-c', 'sleep 600 & echo $!; wait'], { cwd: tmpdir(), timeoutMs: 500, killGraceMs: 500 });
    assert.equal(run.timedOut, true);
    const child = Number(run.stdout.trim());
    assert.ok(child > 0, 'the grandchild pid was printed');
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.throws(() => process.kill(child, 0), 'the grandchild must not outlive the gate');
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
