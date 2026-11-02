// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Installed-layout proof: the real Cratis CLI installs and updates the corpus into disposable consumers from local
 * source snapshots, and the same deny/allow matrix is replayed through every installed entry point (the secrets
 * guard, the Claude settings command, the Codex dispatcher and the Pi bridge with an in-memory API stub).
 *
 * Opt-in. The spec skips explicitly unless CRATIS_GUARD_CLI_PROOF names the absolute path of the CLI executable.
 * A skip is never shipment evidence. Commands are only ever sent as hook JSON on stdin; none is executed. The CLI
 * is always run with an argv array, a local CRATIS_AI_SOURCE, --source, closed stdin and an isolated HOME.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { repositoryRoot, restrictedRows } from './guard-security.fixture.ts';

const cli = process.env.CRATIS_GUARD_CLI_PROOF ?? '';
// Skip only when the variable is absent. A value that is not an absolute path to an existing executable file is a
// failed prerequisite, not a skip: the proof must never pass vacuously.
const skip = cli === '' ? 'set CRATIS_GUARD_CLI_PROOF to the absolute path of the Cratis CLI to run the installed-layout proof (skipped; this is not shipment evidence)' : false;

function requireCli(): void {
    assert.ok(isAbsolute(cli), 'CRATIS_GUARD_CLI_PROOF must be an absolute path');
    assert.ok(existsSync(cli), 'CRATIS_GUARD_CLI_PROOF must name an existing file');
    assert.ok(statSync(cli).isFile(), 'CRATIS_GUARD_CLI_PROOF must name a file');
    assert.ok((statSync(cli).mode & 0o111) !== 0, 'CRATIS_GUARD_CLI_PROOF must be executable');
}

const helpers = ['cratis-guard-secrets.sh', 'cratis-guard-writes.sh', 'hook-lib.sh', 'cratis-shell-parser.mjs', 'cratis-guard-secrets.mjs'];
const BLOCK = 'block';
const ALLOW = 'allow';

// Commands are hook input only. The matrix pairs each refusal with a legitimate neighbor.
const shellMatrix: Array<[string, string]> = [
    [BLOCK, 'kubectl get pods -o json'],
    [ALLOW, 'kubectl get pods -o name'],
    [BLOCK, 'bash -c "printenv"'],
    [ALLOW, 'bash -c "echo hi"'],
    [BLOCK, 'echo "$(printenv)"'],
    [ALLOW, 'echo "$(date)"'],
    [BLOCK, 'eval "$(ssh-agent -s)"'],
    [ALLOW, 'git status'],
];
for (const finding of ['R2-1', 'R2-2', 'R2-3', 'R2-4', 'R2-5', 'R2-6', 'G-1']) {
    const row = restrictedRows.find(entry => entry.finding === finding);
    assert.ok(row, `${finding} must have a real refusal/neighbor pair`);
    shellMatrix.push([BLOCK, `echo 'installed_guard_input_sentinel'; ${row.command}`], [ALLOW, row.neighbor]);
}

const sha256 = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');

function runCli(directory: string, home: string, source: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
    const result = spawnSync(cli, args, {
        cwd: directory,
        encoding: 'utf8',
        input: '',
        timeout: 240_000,
        env: { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, '.config'), CRATIS_AI_SOURCE: source, CI: '1' },
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function snapshot(target: string, markHelper: boolean): string {
    // Candidate corpus from the working tree, without dependency, build or Git internals.
    mkdirSync(target, { recursive: true });
    cpSync(repositoryRoot, target, {
        recursive: true,
        filter: source => !/(^|\/)(node_modules|bin|obj|\.git|\.ai-work|\.worktrees)(\/|$)/.test(relative(repositoryRoot, source)),
    });
    if (markHelper) {
        const helper = join(target, '.cratis/ai/hooks/scripts/hook-lib.sh');
        writeFileSync(helper, `${readFileSync(helper, 'utf8')}# before-snapshot marker\n`);
    }
    return target;
}

function hookResult(root: string, script: string, command: string): string {
    const result = spawnSync('bash', [join(root, '.cratis/ai/hooks/scripts', script)], {
        cwd: root,
        encoding: 'utf8',
        input: JSON.stringify({ cwd: root, tool_name: 'Bash', tool_input: { command } }),
        env: { ...process.env, CRATIS_HOOKS_ALLOW_SECRET_READS: '0', CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0', CLAUDE_PROJECT_DIR: root },
    });
    if (result.status === 2) {
        assert.equal(result.stdout, '');
        assert.match(result.stderr, /BLOCKED by cratis-guard-secrets/);
        assert.match(result.stderr, /Use instead: /);
        assert.ok(!result.stderr.includes('installed_guard_input_sentinel'));
        assert.ok(!result.stderr.includes('cratis-guard-secrets: clean'));
    }
    if (result.status === 0) assert.equal(result.stdout + result.stderr, '');
    return result.status === 0 ? ALLOW : result.status === 2 ? BLOCK : `unexpected:${result.status}`;
}

function assertManaged(root: string, label: string): void {
    for (const helper of helpers) {
        const path = join(root, '.cratis/ai/hooks/scripts', helper);
        assert.ok(existsSync(path), `${label}: ${helper} installed`);
        const text = readFileSync(path, 'utf8');
        assert.match(text, /cratis-ai-managed/, `${label}: ${helper} carries the managed marker`);
        if (helper.endsWith('.sh')) assert.ok(text.split('\n', 1)[0].startsWith('#!') && text.split('\n', 1)[0].includes('bash'), `${label}: ${helper} keeps its bash shebang`);
    }
    for (const link of ['.claude/hooks', '.pi/extensions']) {
        const path = join(root, link);
        assert.ok(existsSync(path), `${label}: ${link} exists`);
        if (lstatSync(path).isSymbolicLink()) {
            const target = realpathSync(path);
            assert.ok(target.startsWith(realpathSync(root)), `${label}: ${link} resolves inside the fixture (${readlinkSync(path)})`);
        }
    }
    const manifest = JSON.parse(readFileSync(join(root, '.cratis/ai.manifest.json'), 'utf8')) as unknown;
    const text = JSON.stringify(manifest);
    for (const helper of helpers) assert.ok(text.includes(helper), `${label}: the manifest owns ${helper}`);
}

function assertMatrix(root: string, label: string): void {
    for (const [expected, command] of shellMatrix) {
        assert.equal(hookResult(root, 'cratis-guard-secrets.sh', command), expected, `${label}: direct secrets guard: ${command}`);
    }
}

async function assertCodex(root: string, label: string): Promise<void> {
    const bridge = join(root, '.cratis/ai/harnesses/codex/hooks.mjs');
    assert.ok(existsSync(bridge), `${label}: the installed Codex dispatcher exists`);
    const { shellGuard } = await import(`${pathToFileURL(bridge).href}?${Date.now()}`) as { shellGuard(input: string, options: { scriptsDirectory: string }): Promise<{ decision?: string; permissionDecision?: string } | undefined> };
    for (const [expected, command] of shellMatrix) {
        const outcome = await shellGuard(JSON.stringify({ cwd: root, session_id: 'layout', hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } }), { scriptsDirectory: join(root, '.cratis/ai/hooks/scripts') });
        const denied = JSON.stringify(outcome ?? {}).includes('deny') || JSON.stringify(outcome ?? {}).includes('block');
        assert.equal(denied ? BLOCK : ALLOW, expected, `${label}: Codex dispatcher: ${command}`);
    }
}

async function assertPi(root: string, label: string): Promise<void> {
    const extension = join(root, '.cratis/ai/harnesses/pi/extensions/cratis-hooks/index.ts');
    assert.ok(existsSync(extension), `${label}: the installed Pi bridge exists`);
    const registerHooks = (await import(`${pathToFileURL(extension).href}?${Date.now()}`) as { default(api: ExtensionAPI): void }).default;
    const handlers = new Map<string, (event: unknown, ctx: unknown) => Promise<unknown> | unknown>();
    registerHooks({ on: (event: string, handler: (event: unknown, ctx: unknown) => Promise<unknown> | unknown) => handlers.set(event, handler), registerTool: () => {} } as unknown as ExtensionAPI);
    const toolCall = handlers.get('tool_call');
    assert.ok(toolCall, `${label}: the installed Pi bridge registers a tool_call handler`);
    const ctx = { cwd: root, signal: undefined };
    for (const [expected, command] of shellMatrix) {
        const outcome = await toolCall({ toolName: 'bash', input: { command } }, ctx) as { block?: boolean } | undefined;
        assert.equal(outcome?.block === true ? BLOCK : ALLOW, expected, `${label}: Pi bash bridge: ${command}`);
    }
    const protectedWrite = await toolCall({ toolName: 'write', input: { path: join(root, '.env'), content: 'X=1\n' } }, ctx) as { block?: boolean } | undefined;
    assert.equal(protectedWrite?.block, true, `${label}: Pi write of an environment file is refused`);
    const ordinary = await toolCall({ toolName: 'write', input: { path: join(root, 'notes.md'), content: '' } }, ctx);
    assert.equal(ordinary, undefined, `${label}: Pi write of an ordinary file with empty content passes`);
}

function assertWrites(root: string, label: string): void {
    const run = (file: string, content: string): number | null => spawnSync('bash', [join(root, '.cratis/ai/hooks/scripts/cratis-guard-writes.sh')], {
        cwd: root, encoding: 'utf8', input: JSON.stringify({ cwd: root, tool_name: 'Write', tool_input: { file_path: file, content } }),
        env: { ...process.env, CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0' },
    }).status;
    assert.equal(run(join(root, '.env'), 'X=1\n'), 2, `${label}: a protected target is refused`);
    assert.equal(run(join(root, 'notes.md'), 'ordinary\n'), 0, `${label}: an ordinary target is allowed`);
}

function assertSettingsCommand(root: string, label: string): void {
    const settingsPath = join(root, '.claude/settings.json');
    assert.ok(existsSync(settingsPath), `${label}: the installed Claude settings exist`);
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as { hooks?: Record<string, Array<{ matcher?: string; hooks?: Array<{ command?: string }> }>> };
    const commands = (settings.hooks?.PreToolUse ?? []).flatMap(group => (group.hooks ?? []).map(hook => hook.command ?? '')).filter(command => command.includes('cratis-guard-secrets.sh'));
    assert.ok(commands.length > 0, `${label}: the Claude settings wire the secrets guard`);
    for (const configured of commands) {
        for (const [expected, command] of shellMatrix) {
            const result = spawnSync('bash', ['-c', configured], {
                cwd: root, encoding: 'utf8', input: JSON.stringify({ cwd: root, tool_name: 'Bash', tool_input: { command } }),
                env: { ...process.env, CLAUDE_PROJECT_DIR: root, CRATIS_HOOKS_ALLOW_SECRET_READS: '0' },
            });
            assert.equal(result.status === 0 ? ALLOW : result.status === 2 ? BLOCK : `unexpected:${result.status}`, expected, `${label}: Claude settings command: ${command}`);
        }
    }
}

function hashes(root: string): Record<string, string> {
    return Object.fromEntries(helpers.map(helper => [helper, sha256(join(root, '.cratis/ai/hooks/scripts', helper))]));
}

test('the real CLI installs and updates the hardened guards and every installed entry point enforces the same matrix', { skip }, async () => {
    requireCli();
    const work = mkdtempSync(join(realpathSync(tmpdir()), 'cratis-guard-layout-'));
    try {
        const home = join(work, 'home');
        mkdirSync(home, { recursive: true });
        const patched = snapshot(join(work, 'source-patched'), false);
        const before = snapshot(join(work, 'source-before'), true);
        assert.notEqual(sha256(join(before, '.cratis/ai/hooks/scripts/hook-lib.sh')), sha256(join(patched, '.cratis/ai/hooks/scripts/hook-lib.sh')), 'the before snapshot differs in managed bytes');

        const installArgs = (source: string) => ['ai', 'install', '--source', source, '--harnesses', 'claude,codex,pi', '--profiles', 'cratis/documentation', '--languages', 'typescript'];
        const fresh = join(work, 'fresh-consumer');
        const updated = join(work, 'updated-consumer');
        for (const consumer of [fresh, updated]) {
            mkdirSync(consumer, { recursive: true });
            assert.equal(spawnSync('git', ['init', '-q'], { cwd: consumer }).status, 0);
        }

        const freshInstall = runCli(fresh, home, patched, installArgs(patched));
        assert.equal(freshInstall.status, 0, `fresh install failed (a producer problem, not repaired here): ${freshInstall.stderr.slice(0, 400)}`);
        const seed = runCli(updated, home, before, installArgs(before));
        assert.equal(seed.status, 0, `seed install failed: ${seed.stderr.slice(0, 400)}`);
        const beforeHashes = hashes(updated);
        const update = runCli(updated, home, patched, ['ai', 'update', '--source', patched]);
        assert.equal(update.status, 0, `update failed: ${update.stderr.slice(0, 400)}`);
        assert.notEqual(hashes(updated)['hook-lib.sh'], beforeHashes['hook-lib.sh'], 'update replaced the managed helper bytes');

        for (const [label, root] of [['fresh', fresh], ['updated', updated]] as const) {
            assertManaged(root, label);
            assertMatrix(root, label);
            assertSettingsCommand(root, label);
            assertWrites(root, label);
            await assertCodex(root, label);
            await assertPi(root, label);
            const status = runCli(root, home, patched, ['ai', 'status', '--source', patched]);
            assert.equal(status.status, 0, `${label}: status after the hooks ran: ${status.stderr.slice(0, 200)}`);
            const report = JSON.parse(status.stdout) as { modifiedFiles?: unknown[] };
            assert.deepEqual(report.modifiedFiles, [], `${label}: running the hooks leaves no managed drift`);
            assert.ok(readdirSync(join(root, '.cratis/ai/hooks/scripts')).includes('cratis-shell-parser.mjs'));
        }
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
});

// Meta check, only when the proof is not requested: a set-but-invalid CLI path must FAIL the proof, never skip it.
test('an invalid CRATIS_GUARD_CLI_PROOF fails the installed-layout proof instead of skipping it', { skip: cli === '' ? false : 'only meaningful when the proof is not requested' }, () => {
    for (const invalid of ['relative/cratis', '/nonexistent/cratis-cli-proof']) {
        // The child inherits this run's loader flags, and must not inherit the test runner's own child-mode marker: with it
        // set, a failing test still exits 0 and the check below would be vacuous.
        const { NODE_TEST_CONTEXT: _context, ...inherited } = process.env;
        const child = spawnSync(process.execPath, [...process.execArgv.filter(argument => argument !== '--test'), '--test', '--test-name-pattern', 'the real CLI installs', join(import.meta.dirname, 'guard-installed-layout.spec.ts')], {
            encoding: 'utf8', cwd: import.meta.dirname, env: { ...inherited, CRATIS_GUARD_CLI_PROOF: invalid },
        });
        assert.notEqual(child.status, 0, `an invalid proof path (${invalid}) must fail`);
    }
});
