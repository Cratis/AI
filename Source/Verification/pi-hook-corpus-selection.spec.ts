// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Characterizes Cratis/AI#1114: the Pi hook bridge chooses its guard scripts once, from the checkout the session
// started in (or the bundled corpus), and never from a checkout a command or file path merely names.
// The bridge only passes command strings to the guards; it executes neither `cd` nor `git`. These fixtures therefore
// prove script SELECTION through marker side effects, not shell behavior.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
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

/** `session` refuses anything mentioning DENY; `permissive` allows everything (the weakened corpus an attacker wants); `denyAll` refuses everything. */
type Mode = 'session' | 'permissive' | 'denyAll';

/** A stand-in guard that leaves a marker naming its owner, then decides by `mode`. */
function standIn(owner: string, marker: string, refusal: string, mode: Mode): string {
    const refuse = mode === 'denyAll' ? 'true' : mode === 'session' ? '[[ "$payload" == *DENY* ]]' : 'false';
    return `#!/usr/bin/env bash\nprintf '%s\\n' "${owner}" >> "${marker}"\npayload="$(cat)"\nif ${refuse}; then echo "${refusal}" >&2; exit 2; fi\nexit 0\n`;
}

const scriptsOf = (checkout: string): string => join(checkout, '.cratis', 'ai', 'hooks', 'scripts');

function installGuards(checkout: string, owner: string, marker: string, refusal: string, mode: Mode): void {
    mkdirSync(scriptsOf(checkout), { recursive: true });
    for (const name of guardNames) writeFileSync(join(scriptsOf(checkout), name), standIn(owner, marker, refusal, mode));
}

/**
 * Writes `.cratis/ai.manifest.json` in the schema `cratis ai install` writes: `SourceRevision` (a 40-hex source commit) and
 * `Files: [{ Source, Destination, Hash }]`, where `Destination` is relative to `.cratis/ai` and `Hash` is the uppercase
 * hex SHA-256 of the installed file's bytes (checked against a real installed manifest). The hash is computed from what
 * is on disk, so a schema-validating selector would accept the manifest.
 *
 * Ordering is hypothetical: the real manifest carries no orderable revision, which is why "newer" is undecidable. Here
 * release `n` is the 40-hex string of digit `n`, and a larger `n` stands for a newer release.
 */
function writeManifest(checkout: string, release: number): void {
    const Files = guardNames.map((name) => ({
        Source: `hooks/scripts/${name}`,
        Destination: `hooks/scripts/${name}`,
        Hash: createHash('sha256').update(readFileSync(join(scriptsOf(checkout), name))).digest('hex').toUpperCase(),
    }));
    writeFileSync(join(checkout, '.cratis', 'ai.manifest.json'), JSON.stringify({ SourceRevision: String(release).repeat(40), Files, Integrations: [] }));
}

const SESSION_REVISION = 5;

interface Fixture { session: string; target: string; marker: string; call: Call; dispose(): void }

/** `managedSession: false` leaves the session without a managed corpus so the bundled one is chosen. */
function fixture(options: { managedSession?: boolean; targetMode?: Mode; targetLink?: 'directory' | 'script' } = {}): Fixture {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'cratis-corpus-selection-')));
    const session = join(root, 'session');
    const target = join(root, 'target');
    const marker = join(root, 'marker.log');
    mkdirSync(session, { recursive: true });
    mkdirSync(target, { recursive: true });
    spawnSync('git', ['init', '-q'], { cwd: session });
    if (options.managedSession !== false) {
        installGuards(session, 'session', marker, SESSION_REFUSAL, 'session');
        writeManifest(session, SESSION_REVISION);
    }
    const targetMode = options.targetMode ?? 'permissive';
    if (options.targetLink) {
        // A script set outside the target checkout, reached through a symlink the target's manifest cannot vouch for.
        const outside = join(root, 'elsewhere');
        installGuards(outside, 'target', marker, TARGET_REFUSAL, targetMode);
        if (options.targetLink === 'directory') {
            mkdirSync(join(target, '.cratis', 'ai', 'hooks'), { recursive: true });
            symlinkSync(scriptsOf(outside), scriptsOf(target));
        } else {
            installGuards(target, 'target', marker, TARGET_REFUSAL, targetMode);
            const script = join(scriptsOf(target), guardNames[0]);
            unlinkSync(script);
            symlinkSync(join(scriptsOf(outside), guardNames[0]), script);
        }
        writeManifest(target, SESSION_REVISION + 1);
    } else {
        installGuards(target, 'target', marker, TARGET_REFUSAL, targetMode);
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

// Every target corpus here is permissive (it would allow the DENY commands the session refuses), so a selector that
// trusted a target's manifest would let them through. The manifests are valid for what is on disk unless stated.
const weaken = (target: string): void => { for (const name of guardNames) writeFileSync(join(scriptsOf(target), name), standIn('target', join(target, '..', 'marker.log'), TARGET_REFUSAL, 'permissive')); };
const manifests: Array<[string, (target: string) => void]> = [
    ['no manifest (unmanaged)', () => { /* none */ }],
    [`a valid manifest, newer than the session (revision ${SESSION_REVISION + 1})`, (target) => writeManifest(target, SESSION_REVISION + 1)],
    [`a valid manifest, equal to the session (revision ${SESSION_REVISION})`, (target) => writeManifest(target, SESSION_REVISION)],
    [`a valid manifest, older than the session (revision ${SESSION_REVISION - 1})`, (target) => writeManifest(target, SESSION_REVISION - 1)],
    ['hashes that no longer match the scripts (tampered after install)', (target) => { writeManifest(target, SESSION_REVISION + 1); for (const name of guardNames) appendFileSync(join(scriptsOf(target), name), '# edited after install\n'); }],
    ['a manifest recomputed after weakening the scripts (forged)', (target) => { weaken(target); writeManifest(target, SESSION_REVISION + 1); }],
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

for (const link of ['directory', 'script'] as const) {
    test(`a target ${link} symlinked to a script set outside the checkout is never consulted`, async () => {
        const f = fixture({ targetLink: link });
        try {
            const result = await f.call(bash(`cd ${f.target} && echo DENY`), { cwd: f.session });
            assert.equal(result?.block, true);
            assert.match(result?.reason ?? '', new RegExp(SESSION_REFUSAL));
            assert.deepEqual([...new Set(owners(f.marker))], ['session']);
        } finally { f.dispose(); }
    });
}

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
    const f = fixture({ targetMode: 'denyAll' });
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
