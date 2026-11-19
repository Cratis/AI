// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Characterizes Cratis/AI#1114: the Pi hook bridge chooses its guard scripts once, from the checkout the session
// started in (or the bundled corpus), and never from a checkout a command or file path merely names.
// The bridge only passes command strings to the guards; it executes neither `cd` nor `git`. These fixtures therefore
// prove script SELECTION through marker side effects, not shell behavior.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import registerCratisHooks from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/index.ts';

type Result = { block?: boolean; reason?: string } | undefined;
type Call = (event: unknown, ctx: unknown) => Promise<Result>;

const SESSION_REFUSAL = 'REFUSED-BY-SESSION-GUARD';
const TARGET_REFUSAL = 'REFUSED-BY-TARGET-GUARD';
const guardNames = ['cratis-guard-shell-writes.sh', 'cratis-guard-writes.sh'];

/** A stand-in guard: leaves a marker, refuses anything mentioning DENY, otherwise follows `fallback`. */
function standIn(owner: string, marker: string, refusal: string, fallback: number): string {
    return `#!/usr/bin/env bash\nprintf '%s\\n' "${owner}" >> "${marker}"\npayload="$(cat)"\nif [[ "$payload" == *DENY* || ${fallback} -eq 2 ]]; then echo "${refusal}" >&2; exit 2; fi\nexit 0\n`;
}

function installGuards(checkout: string, owner: string, marker: string, refusal: string, fallback: number, linkedFrom?: string): void {
    const scripts = join(checkout, '.cratis', 'ai', 'hooks', 'scripts');
    if (linkedFrom) {
        mkdirSync(join(checkout, '.cratis', 'ai', 'hooks'), { recursive: true });
        symlinkSync(linkedFrom, scripts);
        return;
    }
    mkdirSync(scripts, { recursive: true });
    for (const name of guardNames) writeFileSync(join(scripts, name), standIn(owner, marker, refusal, fallback));
}

function writeManifest(checkout: string, manifest: object): void {
    writeFileSync(join(checkout, '.cratis', 'ai.manifest.json'), JSON.stringify(manifest));
}

interface Fixture { session: string; target: string; marker: string; call: Call; dispose(): void }

/** `managedSession: false` leaves the session without a managed corpus so the bundled one is chosen. */
function fixture(options: { managedSession?: boolean; targetFallback?: number; targetLink?: boolean } = {}): Fixture {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'cratis-corpus-selection-')));
    const session = join(root, 'session');
    const target = join(root, 'target');
    const marker = join(root, 'marker.log');
    mkdirSync(session, { recursive: true });
    mkdirSync(target, { recursive: true });
    spawnSync('git', ['init', '-q'], { cwd: session });
    if (options.managedSession !== false) installGuards(session, 'session', marker, SESSION_REFUSAL, 0);
    if (options.targetLink) {
        const real = join(root, 'elsewhere');
        installGuards(root, 'target', marker, TARGET_REFUSAL, options.targetFallback ?? 0);
        // The directory holding the target's scripts is a symlink to a script set outside the checkout.
        symlinkSync(join(root, '.cratis', 'ai', 'hooks', 'scripts'), real);
        installGuards(target, 'target', marker, TARGET_REFUSAL, options.targetFallback ?? 0, real);
    } else {
        installGuards(target, 'target', marker, TARGET_REFUSAL, options.targetFallback ?? 0);
    }
    const handlers = new Map<string, Call>();
    const previous = process.cwd();
    process.chdir(session);
    try {
        registerCratisHooks({ on: (name: string, handler: Call) => handlers.set(name, handler), registerTool: () => { /* not needed */ } } as unknown as ExtensionAPI);
    } finally {
        process.chdir(previous);
    }
    const call = handlers.get('tool_call');
    assert.ok(call);
    return { session, target, marker, call, dispose: () => rmSync(root, { recursive: true, force: true }) };
}

const owners = (marker: string): string[] => (existsSync(marker) ? readFileSync(marker, 'utf8').split('\n').filter(Boolean) : []);
const bash = (command: string) => ({ toolName: 'bash', input: { command } });

const manifests: Array<[string, (target: string) => void]> = [
    ['unmanaged (no manifest)', () => { /* none */ }],
    ['newer source commit', (target) => writeManifest(target, { sourceCommit: 'ffffffffffffffffffffffffffffffffffffffff', files: {} })],
    ['equal source commit', (target) => writeManifest(target, { sourceCommit: 'same', files: {} })],
    ['older source commit', (target) => writeManifest(target, { sourceCommit: '0000000000000000000000000000000000000000', files: {} })],
    ['hash mismatch (tampered scripts)', (target) => writeManifest(target, { sourceCommit: 'newer', files: { '.cratis/ai/hooks/scripts/cratis-guard-shell-writes.sh': 'sha256:0' } })],
    ['manifest forged to match weakened scripts', (target) => writeManifest(target, { sourceCommit: 'forged', files: { '.cratis/ai/hooks/scripts/cratis-guard-shell-writes.sh': 'sha256:forged' } })],
];

for (const [label, prepare] of manifests) {
    test(`commands naming a checkout with ${label} are judged by the session's guards only`, async () => {
        const f = fixture();
        try {
            prepare(f.target);
            for (const command of [`cd ${f.target} && echo DENY`, `git -C ${f.target} commit -m DENY`, `(cd ${f.target}; echo DENY)`]) {
                const result = await f.call(bash(command), { cwd: f.session });
                assert.equal(result?.block, true, command);
                assert.match(result?.reason ?? '', new RegExp(SESSION_REFUSAL), command);
            }
            assert.deepEqual([...new Set(owners(f.marker))], ['session']);
        } finally { f.dispose(); }
    });
}

test('a symlinked target scripts directory is never consulted', async () => {
    const f = fixture({ targetLink: true });
    try {
        const result = await f.call(bash(`cd ${f.target} && echo DENY`), { cwd: f.session });
        assert.match(result?.reason ?? '', new RegExp(SESSION_REFUSAL));
        assert.deepEqual([...new Set(owners(f.marker))], ['session']);
    } finally { f.dispose(); }
});

test('absolute-path writes and edits in another checkout are judged by the session guard', async () => {
    const f = fixture();
    try {
        for (const toolName of ['write', 'edit']) {
            const denied = await f.call({ toolName, input: { path: join(f.target, 'DENY.txt'), content: 'x', edits: [{ oldText: 'a', newText: 'b' }] } }, { cwd: f.session });
            assert.equal(denied?.block, true, toolName);
            assert.match(denied?.reason ?? '', new RegExp(SESSION_REFUSAL), toolName);
        }
        assert.deepEqual([...new Set(owners(f.marker))], ['session']);
    } finally { f.dispose(); }
});

test('a tool call whose cwd is the other checkout still uses the starting checkout scripts', async () => {
    const f = fixture();
    try {
        const bashResult = await f.call(bash('echo DENY'), { cwd: f.target });
        assert.match(bashResult?.reason ?? '', new RegExp(SESSION_REFUSAL));
        const writeResult = await f.call({ toolName: 'write', input: { path: join(f.target, 'DENY.txt'), content: 'x' } }, { cwd: f.target });
        assert.match(writeResult?.reason ?? '', new RegExp(SESSION_REFUSAL));
        assert.deepEqual([...new Set(owners(f.marker))], ['session']);
    } finally { f.dispose(); }
});

test('control: a command the session guard allows is not blocked by a deny-everything target corpus', async () => {
    const f = fixture({ targetFallback: 2 });
    try {
        assert.equal(await f.call(bash(`cd ${f.target} && echo harmless`), { cwd: f.session }), undefined);
        assert.equal(await f.call({ toolName: 'write', input: { path: join(f.target, 'ok.txt'), content: 'x' } }, { cwd: f.session }), undefined);
        assert.equal(await f.call(bash('echo harmless'), { cwd: f.target }), undefined);
        const seen = owners(f.marker);
        assert.ok(seen.length > 0, 'the session guards ran');
        assert.deepEqual([...new Set(seen)], ['session']);
    } finally { f.dispose(); }
});

test('a session without a managed corpus falls back to the bundled guards, not the target checkout', async () => {
    const f = fixture({ managedSession: false });
    try {
        const result = await f.call(bash(`cd ${f.target} && echo x > .mcp.json`), { cwd: f.session });
        assert.equal(result?.block, true);
        assert.match(result?.reason ?? '', /BLOCKED by cratis-guard-shell-writes/);
        assert.deepEqual(owners(f.marker), []);
    } finally { f.dispose(); }
});
