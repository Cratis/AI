// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Behavior fixtures for the store-mutation guard and the Pi bridge that drives it.
 *
 * The guard fails closed, so the dangerous failure is the quiet one: a mutating command that slips through because
 * it was spelled differently. Each table pairs commands that must be refused with their nearest harmless
 * neighbors, so a guard that blocks every `cratis` command fails these tests as surely as one that blocks none.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import registerCratisHooks from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/index.ts';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const scripts = join(repositoryRoot, '.cratis', 'ai', 'hooks', 'scripts');
const guard = join(scripts, 'cratis-guard-store-mutations.sh');
const dataFile = join(scripts, 'cratis-store-mutations.json');

const BLOCK = 'block';
const ALLOW = 'allow';

interface CommandLists {
    verifiedAgainst: string;
    group: string;
    readOnly: Array<{ command: string; reason: string }>;
    mutating: Array<{ command: string; effect: string }>;
}

function runGuard(command: string, env: NodeJS.ProcessEnv = {}, script: string = guard): { verdict: string; code: number | null; stderr: string } {
    const result = spawnSync('bash', [script], {
        input: JSON.stringify({ cwd: repositoryRoot, tool_name: 'Bash', tool_input: { command } }),
        encoding: 'utf8',
        env: { ...process.env, CRATIS_HOOKS_ALLOW_STORE_MUTATIONS: '0', CRATIS_HOOKS_STORE_MUTATIONS: '', ...env },
    });
    return { verdict: result.status === 2 ? BLOCK : ALLOW, code: result.status, stderr: result.stderr };
}

function assertVerdicts(cases: Array<[expected: string, command: string]>, env: NodeJS.ProcessEnv = {}, script: string = guard): void {
    for (const [expected, command] of cases) {
        const { verdict, code, stderr } = runGuard(command, env, script);
        assert.ok(code === 0 || code === 2, `${command}\nexited ${code}, which is neither allow nor block\n${stderr}`);
        assert.equal(verdict, expected, `${command}\n${stderr}`);
        if (expected === BLOCK) assert.match(stderr, /BLOCKED by cratis-guard-store-mutations/);
    }
}

test('the store-mutation guard refuses chronicle mutations and allows read-only inspection', () => {
    assertVerdicts([
        [ALLOW, 'cratis chronicle observers list --namespace default'],
        [ALLOW, 'cratis chronicle failed-partitions show abc -o json'],
        [BLOCK, 'cratis chronicle observers replay my-obs --yes'],
        [BLOCK, 'cratis chronicle observers retry-partition x y'],
        [BLOCK, 'cratis chronicle observers clear-quarantine x'],
        [BLOCK, 'cratis chronicle jobs stop 1 -y'],
        [BLOCK, 'cratis chronicle recommendations perform r1'],
        [BLOCK, 'cratis chronicle users remove bob'],
        [BLOCK, 'cratis chronicle users add bob'],
        [ALLOW, 'cratis chronicle observers replay --help'],
        [ALLOW, 'cratis chronicle diagnose'],
        [ALLOW, 'cratis chronicle auth status -o json'],
        [ALLOW, 'cratis chronicle read-models get Accounts 42 -o json-compact'],
        [BLOCK, 'cratis chronicle workbench'],
        [BLOCK, 'cratis chronicle Observers Replay x'],
    ]);
});

test('the store-mutation guard fails closed for commands it does not know', () => {
    assertVerdicts([
        [BLOCK, 'cratis chronicle some-future-command'],
        [BLOCK, 'cratis chronicle observers'],
        [BLOCK, 'cratis chronicle'],
        [BLOCK, 'cratis --server chronicle://prod chronicle observers replay x'],
        [BLOCK, 'cratis chronicle --server=chronicle://prod observers replay x'],
        [BLOCK, 'cratis chronicle -n default observers replay x'],
        [BLOCK, 'cratis chronicle observers -y replay x'],
        [BLOCK, 'cratis --unknown-option chronicle observers list'],
        [BLOCK, 'cratis $GROUP observers replay x'],
        [ALLOW, 'cratis chronicle observers replay x --version'],
        [BLOCK, "cratis chronicle observers replay x '--help'"],
        [ALLOW, 'cratis chronicle observers list --server=chronicle://prod'],
        [ALLOW, 'cratis --version'],
        [ALLOW, 'cratis --help'],
    ]);
});

test('the store-mutation guard finds cratis in every command position and nowhere else', () => {
    assertVerdicts([
        [ALLOW, 'cd ~/repos/cratis/Chronicle && ls'],
        [ALLOW, 'cat /x/cratis.json'],
        [BLOCK, 'cratis chronicle events tail && cratis chronicle observers replay o1 --yes'],
        [BLOCK, 'CHRONICLE_CONNECTION_STRING=chronicle://a:b@prod:35000 cratis chronicle jobs resume 3'],
        [ALLOW, 'rtk proxy cratis chronicle observers list'],
        [BLOCK, 'rtk proxy cratis chronicle observers replay x'],
        [ALLOW, 'echo $(cratis chronicle namespaces list -q)'],
        [BLOCK, 'echo "$(cratis chronicle observers replay x --yes)"'],
        [BLOCK, 'echo `cratis chronicle observers replay x`'],
        [BLOCK, "bash -c 'cratis chronicle observers replay x'"],
        [BLOCK, 'sh -c "cratis chronicle observers replay x"'],
        [BLOCK, "eval 'cratis chronicle observers replay x'"],
        [BLOCK, '(cd /tmp; cratis chronicle observers replay x)'],
        [BLOCK, 'ls | cratis chronicle observers replay x'],
        [BLOCK, 'cratis chronicle observers replay x 2>&1 | tee out.log'],
        [ALLOW, 'cratis chronicle observers list 2>&1 | head -n 5'],
        [BLOCK, '/opt/homebrew/bin/cratis chronicle observers replay x'],
        [BLOCK, 'sudo -u ops timeout 30 cratis chronicle observers replay x'],
        [BLOCK, 'env -i PATH=/usr/bin cratis chronicle observers replay x'],
        [BLOCK, 'xargs -I{} cratis chronicle observers replay {} < ids.txt'],
        [BLOCK, "ssh prod 'cratis chronicle observers replay x'"],
        [BLOCK, 'for o in a b; do cratis chronicle observers replay $o --yes; done'],
        [BLOCK, 'if true; then cratis chronicle jobs stop 1; fi'],
        [BLOCK, 'cratis chronicle observers replay x \\\n  --yes'],
        [BLOCK, 'diff <(cratis chronicle observers replay x) b'],
        [BLOCK, "echo 'cratis chronicle observers replay x --yes' | bash"],
        [BLOCK, "bash <<'EOF'\ncratis chronicle observers replay x --yes\nEOF"],
        [BLOCK, "bash <<< 'cratis chronicle observers replay x'"],
        [ALLOW, "cat <<< 'cratis chronicle observers replay x'"],
        [ALLOW, 'echo cratis chronicle observers replay'],
        [ALLOW, "grep -rn 'cratis chronicle observers replay' .cratis"],
        [ALLOW, '# cratis chronicle observers replay x\nls'],
        [ALLOW, 'git commit -m "$(cat <<\'EOF\'\nGuard store mutations\n\ncratis chronicle observers replay x --yes is now blocked\nEOF\n)"'],
    ]);
});

test('the store-mutation guard leaves every other cratis group alone', () => {
    assertVerdicts([
        [ALLOW, 'cratis context show'],
        [ALLOW, 'cratis ai update'],
        [ALLOW, 'cratis screenplay validate ./plays'],
        [ALLOW, 'cratis llm-context'],
    ]);
});

test('the escape hatch comes from the harness environment, never from the command', () => {
    const replay = 'cratis chronicle observers replay my-obs --yes';
    assert.equal(runGuard(replay).verdict, BLOCK);
    assert.equal(runGuard(replay, { CRATIS_HOOKS_ALLOW_STORE_MUTATIONS: '1' }).verdict, ALLOW);
    assert.equal(runGuard(`CRATIS_HOOKS_ALLOW_STORE_MUTATIONS=1 ${replay}`).verdict, BLOCK);
    assert.equal(runGuard(`export CRATIS_HOOKS_ALLOW_STORE_MUTATIONS=1; ${replay}`).verdict, BLOCK);
});

test('the block message names the effect and tells the agent to stop and ask', () => {
    const { stderr } = runGuard('cratis chronicle observers replay my-obs --yes');
    assert.match(stderr, /cratis chronicle observers replay: replays an observer/);
    assert.match(stderr, /Do not retry this/);
    assert.match(stderr, /the exact command you intended to run/);
    assert.match(stderr, /cratis context show/);
    assert.match(stderr, /what it changes and why/);
    assert.match(stderr, /ask the user/);
    assert.match(stderr, /CRATIS_HOOKS_ALLOW_STORE_MUTATIONS=1/);
    const unknown = runGuard('cratis chronicle some-future-command').stderr;
    assert.match(unknown, /some-future-command: not on the read-only allowlist/);
    const secret = runGuard('CHRONICLE_CONNECTION_STRING=chronicle://client:hunter2@prod:35000 cratis chronicle jobs resume 3').stderr;
    assert.doesNotMatch(secret, /hunter2/, 'the message must never echo a credential from the command');
});

test('unreadable command lists refuse every chronicle command and nothing else', () => {
    const env = { CRATIS_HOOKS_STORE_MUTATIONS: join(tmpdir(), 'cratis-store-mutations-does-not-exist.json') };
    assertVerdicts([
        [BLOCK, 'cratis chronicle observers list'],
        [ALLOW, 'cratis context show'],
        [ALLOW, 'ls -la'],
    ], env);
    assert.match(runGuard('cratis chronicle observers list', env).stderr, /could not be read/);
});

test('malformed shipped or local lists fail closed rather than silently losing policy', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cratis-store-guard-invalid-'));
    try {
        for (const file of ['hook-lib.sh', 'cratis-guard-store-mutations.sh', 'cratis-store-mutations.json']) copyFileSync(join(scripts, file), join(directory, file));
        const copy = join(directory, 'cratis-guard-store-mutations.sh');
        writeFileSync(join(directory, 'cratis-store-mutations.local.json'), '{invalid');
        assertVerdicts([[BLOCK, 'cratis chronicle observers list'], [ALLOW, 'cratis context show']], {}, copy);
        assert.match(runGuard('cratis chronicle observers list', {}, copy).stderr, /cratis-store-mutations\.local\.json/);
        rmSync(join(directory, 'cratis-store-mutations.local.json'));
        writeFileSync(join(directory, 'cratis-store-mutations.json'), '[]');
        assertVerdicts([[BLOCK, 'cratis chronicle observers list'], [ALLOW, 'cratis ai update']], {}, copy);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

test('a local list can tighten the shipped lists but never make a known mutation read-only', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cratis-store-guard-'));
    try {
        for (const file of ['hook-lib.sh', 'cratis-guard-store-mutations.sh', 'cratis-store-mutations.json']) copyFileSync(join(scripts, file), join(directory, file));
        writeFileSync(join(directory, 'cratis-store-mutations.local.json'), JSON.stringify({
            readOnly: [
                { command: 'some-future-command', reason: 'a newer CLI command this repository classified' },
                { command: 'observers replay', reason: 'an attempt to loosen a known mutation' },
            ],
            mutating: [{ command: 'users list', effect: 'this repository treats listing users as sensitive' }],
        }));
        const copy = join(directory, 'cratis-guard-store-mutations.sh');
        assertVerdicts([
            [ALLOW, 'cratis chronicle some-future-command'],
            [BLOCK, 'cratis chronicle observers replay x'],
            [BLOCK, 'cratis chronicle users list'],
            [ALLOW, 'cratis chronicle observers list'],
        ], {}, copy);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

test('every command list entry is justified, unique, and agrees with the skill', () => {
    const lists = JSON.parse(readFileSync(dataFile, 'utf8')) as CommandLists;
    const readOnly = lists.readOnly.map(entry => entry.command);
    const mutating = lists.mutating.map(entry => entry.command);
    assert.ok(readOnly.length > 0 && mutating.length > 0, 'both lists must be populated');
    for (const entry of lists.readOnly) assert.ok(entry.reason?.trim(), `read-only '${entry.command}' records no reason`);
    for (const entry of lists.mutating) assert.ok(entry.effect?.trim(), `mutating '${entry.command}' records no effect`);
    assert.equal(new Set(readOnly).size, readOnly.length, 'read-only commands must be unique');
    assert.equal(new Set(mutating).size, mutating.length, 'mutating commands must be unique');
    assert.deepEqual(readOnly.filter(command => mutating.includes(command)), [], 'no command may be both read-only and mutating');

    // Every mutation the operations skill names must be one the guard knows by name, not only by failing closed.
    const skill = readFileSync(join(repositoryRoot, '.cratis', 'ai', 'skills', 'cratis-chronicle-cli-operations', 'SKILL.md'), 'utf8');
    const section = skill.slice(skill.indexOf('These commands mutate the running store:'), skill.indexOf('Before any of them:'));
    const named = [...section.matchAll(/`chronicle ([a-z-]+) ([a-z-]+)`(?:, `([a-z-]+)`)?(?:, `([a-z-]+)`)?(?:,\s+`([a-z-]+)`)?/g)]
        .flatMap(match => [match[2], match[3], match[4], match[5]].filter(Boolean).map(command => `${match[1]} ${command}`));
    assert.ok(named.length >= 14, `expected the skill to name at least 14 mutations, found ${named.length}`);
    for (const command of named) assert.ok(mutating.includes(command), `the skill names '${command}' as a mutation, but the guard does not list it`);
});

test('the command lists match the chronicle commands of the CLI they were verified against', t => {
    const lists = JSON.parse(readFileSync(dataFile, 'utf8')) as CommandLists;
    const version = spawnSync('cratis', ['--version'], { encoding: 'utf8', timeout: 30000 });
    if (version.error || version.status !== 0) {
        t.skip('the cratis CLI is not installed, so the lists cannot be compared with its catalog');
        return;
    }
    const installed = `cratis ${version.stdout.trim()}`;
    if (installed !== lists.verifiedAgainst) {
        t.skip(`installed ${installed} differs from verifiedAgainst ${lists.verifiedAgainst}; reclassify against it and update verifiedAgainst`);
        return;
    }
    const catalog = spawnSync('cratis', ['llm-context'], { encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
    assert.equal(catalog.status, 0, catalog.stderr);
    interface Node { name: string; commands?: Node[]; subGroups?: Node[] }
    const group = (JSON.parse(catalog.stdout) as { commandGroups: Node[] }).commandGroups.find(node => node.name === lists.group);
    assert.ok(group, `the CLI has no '${lists.group}' group`);
    const paths = (node: Node, prefix: string[]): string[] => [
        ...(node.commands ?? []).map(command => [...prefix, command.name].join(' ')),
        ...(node.subGroups ?? []).flatMap(child => paths(child, [...prefix, child.name])),
    ];
    const actual = paths(group, []).sort();
    const classified = [...lists.readOnly.map(entry => entry.command), ...lists.mutating.map(entry => entry.command)].sort();
    assert.deepEqual(classified, actual, 'every CLI command must be classified exactly once, and every entry must still exist');
});

test('the Pi bridge runs shell commands through the store-mutation guard', async () => {
    const saved = process.env.CRATIS_HOOKS_ALLOW_STORE_MUTATIONS;
    delete process.env.CRATIS_HOOKS_ALLOW_STORE_MUTATIONS;
    const project = mkdtempSync(join(tmpdir(), 'cratis-store-guard-pi-'));
    // The scratch project holds no .cratis/ai/hooks/scripts, so the bridge falls back to the bundled corpus scripts.
    const handlers = new Map<string, (event: unknown, ctx: unknown) => Promise<unknown> | unknown>();
    registerCratisHooks({ on: (event: string, handler: (event: unknown, ctx: unknown) => unknown) => handlers.set(event, handler) } as unknown as ExtensionAPI);
    const toolCall = handlers.get('tool_call');
    assert.ok(toolCall, 'the bridge registers a tool_call handler');
    const ctx = { cwd: project, signal: undefined };
    try {
        const replay = await toolCall({ toolName: 'bash', input: { command: 'cratis chronicle observers replay my-obs --yes' } }, ctx) as { block?: boolean; reason?: string } | undefined;
        assert.equal(replay?.block, true, 'a replay through Pi must be refused');
        assert.match(replay?.reason ?? '', /BLOCKED by cratis-guard-store-mutations/);
        const list = await toolCall({ toolName: 'bash', input: { command: 'cratis chronicle observers list -o plain' } }, ctx);
        assert.equal(list, undefined, 'read-only inspection through Pi must pass');
        const unrelated = await toolCall({ toolName: 'bash', input: { command: 'git status' } }, ctx);
        assert.equal(unrelated, undefined, 'a command that does not mention cratis must pass');
        const read = await toolCall({ toolName: 'read', input: { path: 'cratis chronicle observers replay x' } }, ctx);
        assert.equal(read, undefined, 'only the bash tool is a shell command');
    } finally {
        if (saved !== undefined) process.env.CRATIS_HOOKS_ALLOW_STORE_MUTATIONS = saved;
        rmSync(project, { recursive: true, force: true });
    }
});
