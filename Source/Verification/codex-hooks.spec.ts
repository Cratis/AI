// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const bridge = join(root, '.cratis/ai/harnesses/codex/hooks.mjs');
const { shellGuard } = await import(pathToFileURL(bridge).href);
const store = 'cratis-guard-store-mutations.sh';
const pullRequest = 'cratis-guard-pr-body.sh';
function payload(command = 'git status') {
    return { cwd: root, session_id: 'codex-test', hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } };
}
function fixture(first = 'exit 0', second = 'exit 0') {
    const directory = mkdtempSync(join(tmpdir(), 'codex-hooks-'));
    writeFileSync(join(directory, store), first, { mode: 0o644 });
    writeFileSync(join(directory, pullRequest), second, { mode: 0o644 });
    return { directory, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}
function native(input: unknown, env: NodeJS.ProcessEnv = {}) {
    return spawnSync(process.execPath, [bridge], {
        cwd: root, encoding: 'utf8', timeout: 25000, input: typeof input === 'string' ? input : JSON.stringify(input),
        env: { ...process.env, CRATIS_HOOKS_ALLOW_STORE_MUTATIONS: '0', ...env },
    });
}
function denied(result: { code: number; output: { hookSpecificOutput: { permissionDecision: string } } }) {
    assert.equal(result.code, 2);
    assert.equal(result.output.hookSpecificOutput.permissionDecision, 'deny');
}

test('native Codex schema matches normalized Bash only and has no automatic lifecycle actions', () => {
    const template = JSON.parse(readFileSync(join(root, '.cratis/ai/harnesses/codex/hooks.json'), 'utf8'));
    assert.deepEqual(Object.keys(template.hooks), ['PreToolUse']);
    const entries = template.hooks.PreToolUse;
    assert.equal(entries.length, 1);
    assert.equal(entries[0].matcher, '^Bash$');
    assert.equal(entries[0].hooks.length, 1);
    assert.equal(entries[0].hooks[0].timeout, 30);
    const command = entries[0].hooks[0].command;
    const nested = join(root, 'Source/Verification');
    const result = spawnSync('bash', ['-c', command], { cwd: nested, encoding: 'utf8', input: JSON.stringify({ ...payload(), cwd: nested }) });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
});

test('native adapter allows read-only neighbors and blocks mutations without executing command text', () => {
    for (const command of ['git status', 'cratis chronicle observers list -o plain', 'cratis chronicle --help']) {
        const result = native(payload(command));
        assert.equal(result.status, 0, result.stderr);
    }
    for (const command of ['cratis chronicle observers replay my-observer --yes', 'cratis chronicle future-command', 'CRATIS_HOOKS_ALLOW_STORE_MUTATIONS=1 cratis chronicle jobs stop a --yes']) {
        const result = native(payload(command));
        assert.equal(result.status, 2, result.stderr);
        assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'deny');
    }
    assert.equal(native(payload('cratis chronicle observers replay a --yes'), { CRATIS_HOOKS_ALLOW_STORE_MUTATIONS: '1' }).status, 0);
    const f = fixture();
    try {
        const marker = join(f.directory, 'must-not-exist');
        assert.equal(native(payload(`touch '${marker}'`)).status, 0);
        assert.equal(existsSync(marker), false, 'only guards run, never pending shell text');
    } finally { f.cleanup(); }
});

test('malformed input and unnormalized or patch tools explicitly deny', () => {
    for (const input of ['', '{', 'null', '[]', '{}', { ...payload(), tool_name: 'exec_command' },
        { ...payload(), tool_name: 'apply_patch' }, { ...payload(), hook_event_name: 'Stop' },
        { ...payload(), session_id: '' }, { ...payload(), cwd: 'relative' }, { ...payload(), cwd: '/does-not-exist-codex' },
        { ...payload(), tool_input: {} }, { ...payload(), tool_input: { command: 123 } }]) {
        const result = native(input);
        assert.equal(result.status, 2, result.stderr);
        assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'deny');
    }
});

test('missing managed guard, spawn failure, signals and unexpected nonzero all explicitly deny', async () => {
    const f = fixture();
    try {
        const input = JSON.stringify(payload());
        denied(await shellGuard(input, { scriptsDirectory: f.directory, executable: '/nonexistent-codex-bash' }));
        for (const script of ['exit 1', 'exit 127', 'kill -TERM $$']) {
            writeFileSync(join(f.directory, store), script);
            denied(await shellGuard(input, { scriptsDirectory: f.directory }));
        }
        rmSync(join(f.directory, pullRequest));
        denied(await shellGuard(input, { scriptsDirectory: f.directory }));
    } finally { f.cleanup(); }
});

test('denial is final even when a later guard would allow; both guards receive canonical payload', async () => {
    const f = fixture();
    try {
        const later = join(f.directory, 'later');
        writeFileSync(join(f.directory, pullRequest), `printf ran > '${later}'\nexit 0`);
        for (const script of ['exit 2', `printf '%s' '{"hookSpecificOutput":{"permissionDecision":"deny","permissionDecisionReason":"fixture denial"}}'`]) {
            writeFileSync(join(f.directory, store), script);
            denied(await shellGuard(JSON.stringify(payload()), { scriptsDirectory: f.directory }));
            assert.equal(existsSync(later), false);
        }
        for (const guard of [store, pullRequest]) writeFileSync(join(f.directory, guard), `pwd > '${join(f.directory, guard)}.cwd'\ncat > '${join(f.directory, guard)}.json'`);
        assert.equal((await shellGuard(JSON.stringify(payload()), { scriptsDirectory: f.directory })).code, 0);
        for (const guard of [store, pullRequest]) {
            assert.equal(readFileSync(join(f.directory, `${guard}.cwd`), 'utf8').trim(), root);
            assert.deepEqual(JSON.parse(readFileSync(join(f.directory, `${guard}.json`), 'utf8')), payload());
        }
    } finally { f.cleanup(); }
});

test('deadline kills the task-owned process group even if a child ignores TERM and holds pipes', async () => {
    const f = fixture();
    const marker = join(f.directory, 'escaped');
    try {
        writeFileSync(join(f.directory, store), `(trap '' TERM; sleep 2; printf escaped > '${marker}') &\nwait`);
        const started = Date.now();
        const result = await shellGuard(JSON.stringify(payload()), { scriptsDirectory: f.directory, timeoutMs: 100 });
        denied(result);
        assert.match(result.reason, /deadline/);
        assert.ok(Date.now() - started < 2000, 'internal deadline returns before native timeout');
        await new Promise(accept => setTimeout(accept, 2200));
        assert.equal(existsSync(marker), false, 'descendant cannot continue after hook returns');
    } finally { f.cleanup(); }
});

test('an exited leader cannot leave descendants behind or hold hook pipes forever', async () => {
    const f = fixture();
    const marker = join(f.directory, 'escaped');
    try {
        writeFileSync(join(f.directory, store), `(trap '' TERM; sleep 2; printf escaped > '${marker}') &\nexit 1`);
        denied(await shellGuard(JSON.stringify(payload()), { scriptsDirectory: f.directory }));
        await new Promise(accept => setTimeout(accept, 2200));
        assert.equal(existsSync(marker), false);
    } finally { f.cleanup(); }
});

test('warnings survive without child allow decisions overriding permissions; malformed output denies', async () => {
    const f = fixture();
    try {
        writeFileSync(join(f.directory, store), `printf '%s' '{"systemMessage":"unchecked fixture","hookSpecificOutput":{"permissionDecision":"allow","updatedInput":{"command":"bad"}}}'`);
        const result = await shellGuard(JSON.stringify(payload()), { scriptsDirectory: f.directory });
        assert.equal(result.code, 0);
        assert.equal(result.output.hookSpecificOutput.additionalContext, 'unchecked fixture');
        assert.equal(result.output.hookSpecificOutput.permissionDecision, undefined);
        writeFileSync(join(f.directory, store), 'printf not-json');
        denied(await shellGuard(JSON.stringify(payload()), { scriptsDirectory: f.directory }));
    } finally { f.cleanup(); }
});

test('managed scripts run through Bash even without execute permission', async () => {
    const f = fixture();
    try {
        const scripts = join(root, '.cratis/ai/hooks/scripts');
        for (const file of [store, 'hook-lib.sh', 'cratis-store-mutations.json']) {
            copyFileSync(join(scripts, file), join(f.directory, file));
            chmodSync(join(f.directory, file), 0o644);
        }
        denied(await shellGuard(JSON.stringify(payload('cratis chronicle observers replay a --yes')), { scriptsDirectory: f.directory }));
    } finally { f.cleanup(); }
});
