// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * The delivered-work cleanup must be wired in every harness that has hooks, and its own self-test (which plants
 * delivered, dirty, unmerged, brand-new, locked, live-held and work-record worktrees) must pass: a cleanup that removes nothing, or removes
 * unfinished work, is worse than none.
 */

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { cleanupGithubFixture } from './fixtures/cleanup-github.ts';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const corpus = join(repositoryRoot, '.cratis', 'ai');
const script = join(corpus, 'hooks', 'scripts', 'cratis-cleanup-worktrees.sh');

test('the cleanup self-test passes', () => {
    const result = spawnSync('bash', [script, '--self-test'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /self-test: \d+ checks passed/);
});

const optIn = '--include-work-records=<worktree>';
const unarchivedReason = 'has ignored/untracked files; archive or remove them first';
const cleanupCases = [
    { name: 'keeps ignored work records by default', records: 'nonempty', args: [], kept: true, reason: 'has work records (.ai-work/)' },
    { name: 'keeps work records in a dry run', records: 'nonempty', args: ['--dry-run'], kept: true, reason: 'has work records (.ai-work/)' },
    { name: 'keeps ignored work records despite opt-in', records: 'nonempty', args: [optIn], kept: true, reason: unarchivedReason },
    { name: 'removes clean tracked work records with scoped manual opt-in', records: 'tracked', args: [optIn], kept: false },
    { name: 'keeps other worktrees records outside the opt-in scope', records: 'tracked', args: [optIn], otherRecords: true, kept: false },
    { name: 'ignores opt-in in hook mode', records: 'tracked', args: [optIn, '--hook'], kept: true, reason: 'has work records (.ai-work/)' },
    { name: 'rejects bare opt-in', records: 'nonempty', args: ['--include-work-records'], kept: true, exit: 2, reason: '--include-work-records requires an explicit worktree path' },
    { name: 'removes a worktree with an empty records directory', records: 'empty', args: [], kept: false },
    { name: 'keeps a locked worktree despite opt-in', records: 'tracked', args: [optIn], locked: true, kept: true, reason: 'locked' },
    { name: 'keeps a locked detached worktree despite opt-in', records: 'tracked', args: [optIn], locked: true, detached: true, kept: true, reason: 'locked' },
    { name: 'keeps uncommitted changes despite opt-in', records: 'tracked', args: [optIn], dirty: true, kept: true, reason: 'delivered but has uncommitted changes' },
    { name: 'keeps ignored output', records: 'empty', args: [], ignored: true, kept: true, reason: unarchivedReason },
    { name: 'keeps untracked output', records: 'empty', args: [], untracked: true, kept: true, reason: unarchivedReason },
    { name: 'keeps a live cwd holder', records: 'empty', args: [], holder: 'cwd', kept: true, reason: 'live' },
    { name: 'reports a live cwd holder in dry-run', records: 'empty', args: ['--dry-run'], holder: 'cwd', kept: true, reason: 'live' },
    { name: 'keeps a live open-file holder', records: 'empty', args: [], holder: 'file', kept: true, reason: 'live' },
    { name: 'keeps a live holder despite opt-in', records: 'tracked', args: [optIn], holder: 'cwd', kept: true, reason: 'live' },
    { name: 'keeps a cwd holder with fixed lsof output', records: 'empty', args: [], tool: 'lsof-cwd', kept: true, reason: 'live process' },
    { name: 'keeps a file holder with fixed lsof output', records: 'empty', args: [], tool: 'lsof-file', kept: true, reason: 'live process' },
    { name: 'removes an unused worktree with lsof fallback', records: 'empty', args: [], tool: 'lsof-clear', kept: false },
    { name: 'fails closed without a holder tool', records: 'empty', args: [], tool: 'missing', kept: true, reason: 'no holder check tool available' },
    { name: 'fails closed after three lsof errors', records: 'empty', args: [], tool: 'lsof-error', attempts: 3, kept: true, reason: 'holder check failed (lsof)' },
    { name: 'fails closed when pi-holders errors', records: 'empty', args: [], tool: 'pi-error', kept: true, reason: 'live holder or failed holder check (pi-holders)' },
    { name: 'keeps an ancestor whose cwd is inside the worktree', records: 'empty', args: [], ancestor: true, kept: true, reason: 'live ' },
    { name: 'keeps an ancestor cwd with fixed lsof output', records: 'empty', args: [], ancestor: true, tool: 'lsof-cwd', kept: true, reason: 'live process' },
    { name: 'excludes the cleanup script own open file', records: 'empty', args: [], ownScript: true, kept: false },
    { name: 'real-lsof smoke excludes the cleanup script own file', records: 'empty', args: [], ownScript: true, tool: 'lsof-real', kept: false },
    { name: 'accepts a validated clear pi-holders report', records: 'empty', args: [], tool: 'pi-clear', kept: false },
    { name: 'falls back to lsof when pi-holders has no JSON parser', records: 'empty', args: [], tool: 'pi-no-jq', kept: false },
    { name: 'fails closed without a JSON parser or lsof', records: 'empty', args: [], tool: 'pi-no-jq-no-lsof', kept: true, reason: 'no holder check tool available' },
    { name: 'fails closed on malformed pi-holders JSON', records: 'empty', args: [], tool: 'pi-invalid', kept: true, reason: 'live holder or invalid/ambiguous holder check' },
    { name: 'fails closed on unknown pi-holders status', records: 'empty', args: [], tool: 'pi-unknown', kept: true, reason: 'live holder or invalid/ambiguous holder check' },
    { name: 'fails closed on ambiguous pi-holders results', records: 'empty', args: [], tool: 'pi-ambiguous', kept: true, reason: 'live holder or invalid/ambiguous holder check' },
    { name: 'fails closed on inconsistent pi-holders exit and status', records: 'empty', args: [], tool: 'pi-inconsistent', kept: true, reason: 'live holder or invalid/ambiguous holder check' },
    { name: 'fails closed on unparseable lsof output', records: 'empty', args: [], tool: 'lsof-invalid', attempts: 3, kept: true, reason: 'holder check failed (path inspection: ' },
    { name: 'ignores unrelated lsof FD-info errors without a type', records: 'empty', args: [], tool: 'lsof-noise', attempts: 1, kept: false },
    { name: 'still keeps a holder alongside unrelated lsof noise', records: 'empty', args: [], tool: 'lsof-noise-holder', kept: true, reason: 'live process' },
    { name: 'fails closed on target lsof FD-info errors', records: 'empty', args: [], tool: 'lsof-target-error', attempts: 3, kept: true, reason: 'holder check failed (path inspection: ' },
    { name: 'fails closed on lsof errors that hide the file path', records: 'empty', args: [], tool: 'lsof-no-path-error', attempts: 3, kept: true, reason: 'holder check failed (path inspection: ' },
    { name: 'retries incomplete lsof listings up to three times', records: 'empty', args: [], tool: 'lsof-retry', attempts: 3, kept: false },
    { name: 'rechecks ignored output created during the holder check', records: 'empty', args: [], tool: 'lsof-create-ignored', kept: true, reason: unarchivedReason },
    { name: 'does not match sibling wt-10 when checking wt-1', records: 'empty', args: [], tool: 'lsof-prefix', prefixSibling: true, kept: false },
    { name: 'ignores known kernel and network names and revoked descriptors', records: 'empty', args: [], tool: 'lsof-kernel', kept: false },
    { name: 'ignores routing socket descriptors with empty names', records: 'empty', args: [], tool: 'lsof-rte-empty', attempts: 1, kept: false },
    { name: 'ignores routing socket descriptors with non-path names', records: 'empty', args: [], tool: 'lsof-rte-name', attempts: 1, kept: false },
    { name: 'ignores network driver descriptors with empty names', records: 'empty', args: [], tool: 'lsof-ndrv-empty', attempts: 1, kept: false },
    { name: 'ignores network driver descriptors with non-path names', records: 'empty', args: [], tool: 'lsof-ndrv-name', attempts: 1, kept: false },
    { name: 'fails closed on routing socket types used as cwd', records: 'empty', args: [], tool: 'lsof-rte-cwd', attempts: 3, kept: true, reason: 'holder check failed (path inspection: unrecognised cwd rte ' },
    { name: 'fails closed on routing socket types without a descriptor', records: 'empty', args: [], tool: 'lsof-rte-no-descriptor', attempts: 3, kept: true, reason: 'holder check failed (path inspection: unrecognised  rte ' },
    { name: 'fails closed on empty names without a type', records: 'empty', args: [], tool: 'lsof-empty-no-type', attempts: 3, kept: true, reason: 'holder check failed (path inspection: unrecognised 45  ' },
    { name: 'keeps routing socket descriptors with paths under the target', records: 'empty', args: [], tool: 'lsof-rte-path', kept: true, reason: 'live process holds worktree (45:' },
    { name: 'ignores Linux anonymous kernel and network names', records: 'empty', args: [], tool: 'lsof-linux', attempts: 1, kept: false },
    { name: 'keeps a cwd holder alongside Linux anonymous objects', records: 'empty', args: [], tool: 'lsof-linux-cwd', kept: true, reason: 'live process holds worktree (cwd:' },
    { name: 'keeps a file holder alongside Linux anonymous objects', records: 'empty', args: [], tool: 'lsof-linux-file', kept: true, reason: 'live process holds worktree (3:' },
    { name: 'fails closed on target errors alongside Linux anonymous objects', records: 'empty', args: [], tool: 'lsof-linux-target-error', attempts: 3, kept: true, reason: 'holder check failed (path inspection: ' },
    { name: 'fails closed on Linux pseudo-names used as cwd', records: 'empty', args: [], tool: 'lsof-linux-pseudo-cwd', attempts: 3, kept: true, reason: 'holder check failed (path inspection: unrecognised cwd ' },
    { name: 'fails closed on Linux pseudo-names without a type', records: 'empty', args: [], tool: 'lsof-linux-no-type', attempts: 3, kept: true, reason: 'holder check failed (path inspection: ' },
    { name: 'fails closed on Linux pseudo-names without a descriptor', records: 'empty', args: [], tool: 'lsof-linux-no-descriptor', attempts: 3, kept: true, reason: 'holder check failed (path inspection: ' },
    { name: 'fails closed on truncated eventpoll names used as cwd', records: 'empty', args: [], tool: 'lsof-linux-truncated-cwd', attempts: 3, kept: true, reason: 'holder check failed (path inspection: unrecognised cwd ' },
    { name: 'fails closed on truncated eventpoll names with trailing junk', records: 'empty', args: [], tool: 'lsof-linux-truncated-junk', attempts: 3, kept: true, reason: 'holder check failed (path inspection: unrecognised ' },
    { name: 'fails closed on unknown Linux FIFO names', records: 'empty', args: [], tool: 'lsof-linux-unknown', attempts: 3, kept: true, reason: 'holder check failed (path inspection: unrecognised ' },
    { name: 'keeps filesystem socket names under the target', records: 'empty', args: [], tool: 'lsof-socket', kept: true, reason: 'live process' },
    { name: 'fails closed on unknown lsof types with empty names', records: 'empty', args: [], tool: 'lsof-unknown', attempts: 3, kept: true, reason: 'holder check failed (path inspection: unrecognised 3 UNKNOWN ' },
    { name: 'fails closed on ambiguous lsof hard-link names', records: 'empty', args: [], tool: 'lsof-ambiguous', hardlink: true, kept: true, reason: 'ambiguous holder check' },
];

function linkTools(bin: string, tools: string[]) {
    for (const executable of tools) {
        const located = spawnSync('bash', ['-c', 'command -v "$1"', 'bash', executable], { encoding: 'utf8' });
        assert.equal(located.status, 0, `fixture requires ${executable}`);
        symlinkSync(located.stdout.trim(), join(bin, executable));
    }
}

const clearHolderReport = `printf '{"status":"clear","paths":[{"path":"%s","resolved":"%s","held":false,"holders":[],"ambiguous":0}]}\\n' "$2" "$2"`;
const clearLsofReport = 'printf "p1\\nfcwd\\ntDIR\\nn/\\n"';
const noisyLsofReport = `${clearLsofReport}\nprintf "p2\\nf9\\nn/unrelated FD info error: Operation not permitted\\n"`;
const incompleteTargetReport = `${clearLsofReport}\nprintf "p2\\nf9\\nn%s FD info error: Operation not permitted\\n" "$CLEANUP_TEST_WORKTREE"`;
const linuxKernelRecords = [
    ['FIFO', 'pipe:[123]'],
    ['FIFO', 'pipe'],
    ['sock', 'socket:[456]'],
    ['a_inode', 'anon_inode:[eventfd]'],
    ['a_inode', '[eventpoll]'],
    ['a_inode', '[eventpoll:6,7,12]'],
    ['a_inode', '[eventpoll:6,7,1...'],
    ['a_inode', '[eventpoll:6,7,...'],
    ['a_inode', 'anon_inode:[eventpoll:6,7...'],
    ['a_inode', '[eventfd:13]'],
    ['REG', 'anon_inode:[io_uring]'],
    ['a_inode', 'anon_inode:inotify'],
    ['a_inode', 'inotify'],
    ['unix', 'type=STREAM'],
    ['unix', 'type=STREAM (CONNECTED)'],
    ['unix', 'type=DGRAM (UNCONNECTED)'],
    ['netlink', 'NETLINK'],
    ['netlink', 'KOBJECT_UEVENT'],
    ['sock', 'protocol: TCPv6'],
].map(([type, name], index) => `f${index + 3}\\nt${type}\\nn${name}\\n`).join('');
const linuxLsofReport = `${clearLsofReport}\nprintf "p2\\n${linuxKernelRecords}"`;
const holderToolScripts: Record<string, string> = {
    'pi-error': 'exit 3',
    'lsof-error': 'exit 3',
    'pi-clear': clearHolderReport,
    'pi-no-jq': 'exit 3',
    'pi-no-jq-no-lsof': 'exit 3',
    'pi-invalid': 'echo invalid',
    'pi-unknown': clearHolderReport.replace('"clear"', '"unknown"'),
    'pi-ambiguous': clearHolderReport.replace('"ambiguous":0', '"ambiguous":1'),
    'pi-inconsistent': `${clearHolderReport}\nexit 1`,
    'lsof-clear': clearLsofReport,
    'lsof-cwd': 'printf "p1\\nfcwd\\ntDIR\\nn%s\\n" "$CLEANUP_TEST_WORKTREE"',
    'lsof-file': 'printf "p1\\nf3\\ntREG\\nn%s/delivered\\n" "$CLEANUP_TEST_WORKTREE"',
    'lsof-invalid': 'echo invalid',
    'lsof-noise': noisyLsofReport,
    'lsof-noise-holder': `${noisyLsofReport}\nprintf "p2\\nfcwd\\ntDIR\\nn%s\\n" "$CLEANUP_TEST_WORKTREE"`,
    'lsof-target-error': incompleteTargetReport,
    'lsof-no-path-error': `${clearLsofReport}\nprintf "p2\\nf9\\nnFD info error: Operation not permitted\\n"`,
    'lsof-retry': `if [ "$attempt" -lt 3 ]; then\n${incompleteTargetReport}\nelse\n${clearLsofReport}\nfi`,
    'lsof-create-ignored': `echo output > "$CLEANUP_TEST_WORKTREE/ignored-output"\n${clearLsofReport}`,
    'lsof-prefix': 'printf "p1\\nfcwd\\ntDIR\\nn%s\\n" "$CLEANUP_TEST_OTHER"',
    'lsof-kernel': 'printf "p1\\nf3\\ntPIPE\\nn->0x1234\\nf4\\ntNPOLICY\\nn\\nf5\\nn(revoked)\\nf6\\ntunix\\nn->0x5678\\nf11\\ntunix\\nn->(none)\\nf12\\ntunix\\nnlocal-address-token\\nf7\\ntKQUEUE\\nncount=0, state=0xa\\nf8\\ntIPv4\\nn127.0.0.1:80\\nf9\\ntsystm\\nn[ctl com.apple.netsrc]\\nf10\\ntCHAN\\nnuser-packet-pool\\n"',
    'lsof-rte-empty': 'printf "p1\\nf45\\ntrte\\nn\\n"',
    'lsof-rte-name': 'printf "p1\\nf45\\ntrte\\nnrouting-socket\\n"',
    'lsof-ndrv-empty': 'printf "p1\\nf45\\ntndrv\\nn\\n"',
    'lsof-ndrv-name': 'printf "p1\\nf45\\ntndrv\\nnnetwork-driver\\n"',
    'lsof-rte-cwd': 'printf "p1\\nfcwd\\ntrte\\nn\\n"',
    'lsof-rte-no-descriptor': 'printf "p1\\ntrte\\nn\\n"',
    'lsof-empty-no-type': 'printf "p1\\nf45\\nn\\n"',
    'lsof-rte-path': 'printf "p1\\nf45\\ntrte\\nn%s/socket\\n" "$CLEANUP_TEST_WORKTREE"',
    'lsof-linux': linuxLsofReport,
    'lsof-linux-cwd': `${linuxLsofReport}\nprintf "p3\\nfcwd\\ntDIR\\nn%s\\n" "$CLEANUP_TEST_WORKTREE"`,
    'lsof-linux-file': `${linuxLsofReport}\nprintf "p3\\nf3\\ntREG\\nn%s/delivered\\n" "$CLEANUP_TEST_WORKTREE"`,
    'lsof-linux-target-error': `${linuxLsofReport}\nprintf "p3\\nf9\\nn%s FD info error: Operation not permitted\\n" "$CLEANUP_TEST_WORKTREE"`,
    'lsof-linux-pseudo-cwd': `${clearLsofReport}\nprintf "p2\\nfcwd\\ntFIFO\\nnpipe:[123]\\n"`,
    'lsof-linux-no-type': `${clearLsofReport}\nprintf "p2\\nf3\\nnpipe:[123]\\n"`,
    'lsof-linux-no-descriptor': `${clearLsofReport}\nprintf "p2\\ntFIFO\\nnpipe:[123]\\n"`,
    'lsof-linux-truncated-cwd': `${clearLsofReport}\nprintf "p2\\nfcwd\\ntDIR\\nn[eventpoll:6,7...\\n"`,
    'lsof-linux-truncated-junk': `${clearLsofReport}\nprintf "p2\\nf3\\nta_inode\\nn[eventpoll:6,7...x\\n"`,
    'lsof-linux-unknown': `${clearLsofReport}\nprintf "p2\\nf3\\ntFIFO\\nnunknown-pipe\\n"`,
    'lsof-socket': 'printf "p1\\nf3\\ntunix\\nn%s/socket\\n" "$CLEANUP_TEST_WORKTREE"',
    'lsof-unknown': 'printf "p1\\nf3\\ntUNKNOWN\\nn\\n"',
    'lsof-ambiguous': 'printf "p1\\nf3\\ntREG\\nn%s/delivered\\n" "$CLEANUP_TEST_WORKTREE"',
};

function writeToolStub(stub: { bin: string; tool: string; content: string }) {
    const { bin, tool, content } = stub;
    const counter = tool === 'lsof' ? `attempt=1
if [ -n "$CLEANUP_TEST_ATTEMPTS" ]; then
    if [ -f "$CLEANUP_TEST_ATTEMPTS" ]; then read -r attempt < "$CLEANUP_TEST_ATTEMPTS"; attempt=$((attempt + 1)); fi
    printf '%s\\n' "$attempt" > "$CLEANUP_TEST_ATTEMPTS"
fi
` : '';
    writeFileSync(join(bin, tool), `#!/bin/bash\n${counter}${content}\n`, { mode: 0o755 });
}

function holderToolPath(directory: string, tool: string) {
    const bin = join(directory, 'bin');
    mkdirSync(bin);
    const tools = ['bash', 'git', 'awk', 'mktemp', 'rm', 'grep', 'sed', 'find', 'du', 'cat', 'ps', 'stat'];
    if (tool === 'lsof-real') tools.push('lsof');
    if (tool.startsWith('pi-') && !tool.startsWith('pi-no-jq')) tools.push('jq');
    linkTools(bin, tools);
    const stub = holderToolScripts[tool];
    if (stub) writeToolStub({ bin, tool: tool.startsWith('pi-') ? 'pi-holders' : 'lsof', content: stub });
    if (tool === 'pi-no-jq') writeToolStub({ bin, tool: 'lsof', content: clearLsofReport });
    return bin;
}

for (const scenario of cleanupCases) {
    test(`cleanup ${scenario.name}`, async () => {
        const fixture = mkdtempSync(join(tmpdir(), 'cleanup-worktrees-'));
        const repository = join(fixture, 'repository');
        const worktree = join(fixture, scenario.prefixSibling ? 'wt-1' : 'worktree');
        const env: NodeJS.ProcessEnv = {
            ...process.env,
            GIT_AUTHOR_NAME: 'Cleanup spec', GIT_AUTHOR_EMAIL: 'cleanup@example.com',
            GIT_COMMITTER_NAME: 'Cleanup spec', GIT_COMMITTER_EMAIL: 'cleanup@example.com',
            CRATIS_CLEANUP_NO_GH: '1', CRATIS_HOOKS_SKIP_CLEANUP: '0',
        };
        const git = (cwd: string, ...args: string[]) => {
            const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
            assert.equal(result.status, 0, result.stdout + result.stderr);
            return result.stdout;
        };
        let holder: ReturnType<typeof spawn> | undefined;
        try {
            git(fixture, 'init', '--bare', '-b', 'main', 'origin.git');
            git(fixture, 'clone', join(fixture, 'origin.git'), repository);
            git(repository, 'config', 'core.excludesFile', '/dev/null');
            writeFileSync(join(repository, 'base'), 'base\n');
            git(repository, 'add', 'base');
            git(repository, 'commit', '-m', 'base');
            git(repository, 'push', 'origin', 'main');
            git(repository, 'worktree', 'add', '-b', 'delivered', worktree);
            writeFileSync(join(worktree, 'delivered'), scenario.ownScript ? readFileSync(script, 'utf8') : 'delivered\n');
            git(worktree, 'add', 'delivered');
            mkdirSync(join(worktree, '.ai-work'));
            const record = join(worktree, '.ai-work', '.handoff');
            if (scenario.records !== 'empty') writeFileSync(record, 'Keep this handoff\n');
            if (scenario.records === 'tracked') git(worktree, 'add', '.ai-work');
            git(worktree, 'commit', '-m', 'delivered');
            git(repository, 'merge', '--no-ff', 'delivered', '-m', 'merge delivered');
            git(repository, 'push', 'origin', 'main');
            writeFileSync(join(repository, '.git', 'info', 'exclude'), '.ai-work/\nignored-output\n');
            const other = join(fixture, 'worktree-other');
            if (scenario.otherRecords) git(repository, 'worktree', 'add', '-b', 'other', other, 'delivered');
            if (scenario.detached) git(worktree, 'checkout', '--detach');
            if (scenario.locked) git(repository, 'worktree', 'lock', '--reason', 'long-lived', worktree);
            if (scenario.dirty) writeFileSync(join(worktree, 'delivered'), 'unfinished work\n');
            if (scenario.ignored) writeFileSync(join(worktree, 'ignored-output'), 'build output\n');
            if (scenario.untracked) writeFileSync(join(worktree, 'untracked'), 'unfinished work\n');
            if (scenario.hardlink) linkSync(join(worktree, 'delivered'), join(fixture, 'shared-delivered'));
            if (scenario.holder) {
                const command = scenario.holder === 'cwd' ? 'printf ready; exec sleep 120' : 'exec 3< "$1"; printf ready; exec sleep 120';
                holder = spawn('bash', ['-c', command, 'holder', join(worktree, 'delivered')], { cwd: scenario.holder === 'cwd' ? worktree : repository });
                assert.ok(holder.stdout);
                await once(holder.stdout, 'data');
            }
            if (scenario.tool) env.PATH = holderToolPath(fixture, scenario.tool);
            env.CLEANUP_TEST_WORKTREE = realpathSync(worktree);
            env.CLEANUP_TEST_OTHER = join(realpathSync(fixture), 'wt-10');
            env.CLEANUP_TEST_ATTEMPTS = join(fixture, 'lsof-attempts');
            const selectedScript = scenario.ownScript ? join(worktree, 'delivered') : script;
            const args = scenario.args.map(argument => argument.replace('<worktree>', worktree));
            const command = scenario.ancestor
                ? ['-c', '(cd "$1" && bash "$2" --no-fetch "${@:3}"); status=$?; exit "$status"', 'ancestor', repository, selectedScript, ...args]
                : [selectedScript, '--no-fetch', ...args];
            const result = spawnSync('bash', command, {
                cwd: scenario.ancestor ? worktree : repository, env, encoding: 'utf8',
                input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: repository }),
            });
            assert.equal(result.status, scenario.exit ?? 0, result.stdout + result.stderr);
            assert.equal(existsSync(worktree), scenario.kept, result.stdout + result.stderr);
            if (scenario.attempts) assert.equal(Number(readFileSync(env.CLEANUP_TEST_ATTEMPTS, 'utf8')), scenario.attempts);
            if (scenario.reason) assert.ok((result.stdout + result.stderr).includes(`: ${scenario.reason}`), result.stdout + result.stderr);
            if (scenario.kept && scenario.records !== 'empty') assert.equal(readFileSync(record, 'utf8'), 'Keep this handoff\n');
            if (scenario.otherRecords) assert.equal(readFileSync(join(other, '.ai-work', '.handoff'), 'utf8'), 'Keep this handoff\n');
            if (!scenario.detached) {
                const branches = git(repository, 'branch', '--format=%(refname:short)');
                assert.equal(branches.split('\n').includes('delivered'), scenario.kept);
            }
        } finally {
            if (holder) {
                const exited = once(holder, 'exit');
                holder.kill();
                await exited;
            }
            rmSync(fixture, { recursive: true, force: true });
        }
    });
}

test('N worktrees share one REST lookup and fresh cache across worktrees; expired stamps refresh', () => {
    const fixture = cleanupGithubFixture();
    try {
        assert.match(fixture.run(), /3 removed/);
        assert.deepEqual(fixture.calls(), ['api repos/example/cleanup/pulls?state=closed&per_page=100']);
        writeFileSync(join(fixture.directory, 'response'), '[]');
        assert.match(fixture.run(undefined, fixture.worktrees[0]), /2 removed/);
        assert.equal(fixture.calls().length, 1);
        writeFileSync(join(fixture.state, 'stamp'), `${Math.floor(Date.now() / 1000) - 901}\n`);
        assert.match(fixture.run(), /0 removed/);
        assert.equal(fixture.calls().length, 2);
    } finally { fixture.dispose(); }
});

for (const failure of ['API rate limit already exceeded', 'network unavailable']) {
    test(`GitHub failure keeps every dependent worktree and throttles retries: ${failure}`, () => {
        const fixture = cleanupGithubFixture();
        try {
            assert.match(fixture.run(), /3 removed/);
            writeFileSync(join(fixture.state, 'stamp'), '1\n');
            writeFileSync(join(fixture.directory, 'fail'), failure);
            assert.match(fixture.run(['--hook']), /0 removed/);
            assert.match(fixture.run(['--hook']), /0 removed/);
            assert.equal(fixture.calls().length, 2);
            fixture.worktrees.forEach(worktree => assert.ok(existsSync(worktree)));
            assert.equal(readFileSync(join(fixture.state, 'failed'), 'utf8'), readFileSync(join(fixture.state, 'stamp'), 'utf8'));
        } finally { fixture.dispose(); }
    });
}

for (const hook of [true, false]) {
    test(`NO_GH skips lookups and manual runs use one batch per run (hook=${hook})`, () => {
        const fixture = cleanupGithubFixture();
        const args = hook ? ['--hook', '--dry-run'] : ['--dry-run'];
        try {
            fixture.env.CRATIS_CLEANUP_NO_GH = '1';
            assert.match(fixture.run(args), /0 removed/);
            assert.equal(fixture.calls().length, 0);
            fixture.env.CRATIS_CLEANUP_NO_GH = '0';
            assert.match(fixture.run(args), /3 removed/);
            assert.match(fixture.run(args), /3 removed/);
            assert.equal(fixture.calls().length, hook ? 1 : 2);
        } finally { fixture.dispose(); }
    });
}

for (const unavailable of ['NO_GH', 'gh missing', 'jq missing', 'non-GitHub origin', 'invalid slug']) {
    test(`no lookup possible preserves ancestry-only removals: ${unavailable}`, () => {
        const fixture = cleanupGithubFixture();
        try {
            fixture.deliver();
            fixture.git(fixture.repository, 'branch', 'ancestry-only', 'topic-0');
            fixture.git(fixture.repository, 'branch', 'unproven', 'topic-1');
            if (unavailable === 'NO_GH') fixture.env.CRATIS_CLEANUP_NO_GH = '1';
            else if (unavailable === 'gh missing') fixture.withoutTool('gh');
            else if (unavailable === 'jq missing') fixture.withoutTool('jq');
            else fixture.git(fixture.repository, 'remote', 'set-url', 'origin', unavailable === 'invalid slug'
                ? 'https://github.com/example/cleanup/extra' : 'https://example.com/example/cleanup.git');
            if (unavailable === 'gh missing' || unavailable === 'jq missing') {
                linkTools(fixture.env.PATH, ['ps']);
                writeToolStub({ bin: fixture.env.PATH, tool: 'lsof', content: clearLsofReport });
            }
            const output = fixture.run(['--hook']);
            assert.match(output, /3 removed/);
            assert.doesNotMatch(output, /GitHub evidence unavailable/);
            assert.equal(existsSync(fixture.worktrees[0]), false);
            assert.ok(existsSync(fixture.worktrees[1]));
            assert.ok(existsSync(fixture.worktrees[2]));
            const branches = fixture.git(fixture.repository, 'branch', '--format=%(refname:short)').split('\n');
            assert.ok(!branches.includes('ancestry-only'));
            assert.ok(!branches.includes('topic-0'));
            assert.ok(branches.includes('unproven'));
            assert.equal(fixture.calls().length, 0);
            assert.equal(existsSync(join(fixture.repository, '.git/cratis-cleanup-gh')), false);
        } finally { fixture.dispose(); }
    });
}

test('ancestry-only cleanup drains branch membership checks even when output exceeds pipe capacity', () => {
    const fixture = cleanupGithubFixture();
    try {
        fixture.deliver();
        fixture.git(fixture.repository, 'branch', 'ancestry-only', 'topic-0');
        fixture.env.CRATIS_CLEANUP_NO_GH = '1';
        fixture.padWorktreeList();
        assert.match(fixture.run(['--hook']), /3 removed/);
        assert.equal(existsSync(fixture.worktrees[0]), false);
        assert.ok(!fixture.git(fixture.repository, 'branch', '--format=%(refname:short)').split('\n').includes('topic-0'));
        assert.equal(fixture.calls().length, 0);
    } finally { fixture.dispose(); }
});

for (const failure of ['API rate limit already exceeded', 'network unavailable', 'invalid JSON', 'invalid shape', 'invalid entry', 'lock held']) {
    test(`a mixed sweep aborts every worktree and branch removal: ${failure}`, () => {
        const fixture = cleanupGithubFixture();
        try {
            fixture.deliver(); // Put ancestry-proven work first, before GitHub-dependent worktrees.
            fixture.git(fixture.repository, 'branch', 'ancestry-only', 'topic-0');
            fixture.git(fixture.repository, 'branch', 'github-dependent', 'topic-1');
            if (failure === 'lock held') mkdirSync(join(fixture.state, 'lock'), { recursive: true });
            else if (failure === 'invalid JSON') writeFileSync(join(fixture.directory, 'response'), '{broken');
            else if (failure === 'invalid shape') writeFileSync(join(fixture.directory, 'response'), '{}');
            else if (failure === 'invalid entry') writeFileSync(join(fixture.directory, 'response'), '[{}]');
            else writeFileSync(join(fixture.directory, 'fail'), failure);
            for (let run = 0; run < 2; run++) {
                assert.match(fixture.run(['--hook']), /GitHub evidence unavailable; 0 removed/);
                fixture.worktrees.forEach(worktree => assert.ok(existsSync(worktree)));
                assert.equal(fixture.git(fixture.repository, 'branch', '--format=%(refname:short)').split('\n').length, 6);
            }
            assert.equal(fixture.calls().length, failure === 'lock held' ? 0 : 1);
            if (failure !== 'lock held') assert.ok(existsSync(join(fixture.state, 'failed')));
        } finally { fixture.dispose(); }
    });
}

test('manual GitHub failure also aborts ancestry-proven removals', () => {
    const fixture = cleanupGithubFixture();
    try {
        fixture.deliver();
        writeFileSync(join(fixture.directory, 'fail'), 'network unavailable');
        assert.match(fixture.run([]), /GitHub evidence unavailable; 0 removed/);
        fixture.worktrees.forEach(worktree => assert.ok(existsSync(worktree)));
        assert.equal(fixture.calls().length, 1);
    } finally { fixture.dispose(); }
});

test('a failed window does not block a sweep that needs only ancestry evidence', () => {
    const fixture = cleanupGithubFixture();
    try {
        writeFileSync(join(fixture.directory, 'fail'), 'API rate limit already exceeded');
        fixture.run(['--hook']);
        fixture.pulls.forEach((_, index) => fixture.deliver(index));
        assert.match(fixture.run(['--hook']), /6 removed/);
        fixture.worktrees.forEach(worktree => assert.equal(existsSync(worktree), false));
        assert.equal(fixture.calls().length, 1);
    } finally { fixture.dispose(); }
});

test('a stale lock with an abandoned reclaim marker is renamed and the single batch is cached', () => {
    const fixture = cleanupGithubFixture();
    try {
        const lock = join(fixture.state, 'lock');
        mkdirSync(join(lock, 'reclaim'), { recursive: true });
        const expired = new Date(Date.now() - 901_000);
        utimesSync(lock, expired, expired);
        assert.match(fixture.run(), /3 removed/);
        assert.match(fixture.run(), /3 removed/);
        assert.equal(fixture.calls().length, 1);
        assert.equal(existsSync(lock), false);
        assert.ok(!readdirSync(fixture.state).some(name => name.startsWith('lock.stale.')));
    } finally { fixture.dispose(); }
});

test('cleanup self-test: concurrent stale-lock reclaimers preserve the winner and the loser uses cached_pulls', async () => {
    const fixture = cleanupGithubFixture();
    const pending: Promise<string>[] = [];
    const resume = (name: string) => writeFileSync(join(fixture.directory, `resume-${name}`), '');
    const waitFor = async (path: string) => {
        for (let attempt = 0; attempt < 500 && !existsSync(path); attempt++) await delay(20);
        assert.ok(existsSync(path), `reclaimer must reach ${path}`);
    };
    try {
        const lock = join(fixture.state, 'lock');
        mkdirSync(lock, { recursive: true });
        const expired = new Date(Date.now() - 901_000);
        utimesSync(lock, expired, expired);
        fixture.pauseLockStat();
        writeFileSync(join(fixture.directory, 'block'), '');
        pending.push(fixture.runAsync({ CLEANUP_RECLAIMER: 'winner' }));
        pending.push(fixture.runAsync({ CLEANUP_RECLAIMER: 'loser' }));
        await waitFor(join(fixture.directory, 'read-winner'));
        await waitFor(join(fixture.directory, 'read-loser'));
        assert.equal(readFileSync(join(fixture.directory, 'read-winner'), 'utf8'), readFileSync(join(fixture.directory, 'read-loser'), 'utf8'));
        resume('winner');
        await waitFor(join(fixture.directory, 'calls'));
        const winnerInode = statSync(lock).ino;
        resume('loser');
        assert.match(await pending[1], /GitHub evidence unavailable; 0 removed/);
        assert.equal(statSync(lock).ino, winnerInode, 'the live lock must be restored, not replaced');
        assert.equal(fixture.calls().length, 1);
        writeFileSync(join(fixture.directory, 'release'), '');
        assert.match(await pending[0], /3 removed/);
        assert.match(fixture.run(), /3 removed/);
        assert.equal(fixture.calls().length, 1, 'the winner must publish the cache for later hooks');
        assert.equal(existsSync(lock), false);
        assert.ok(!readdirSync(fixture.state).some(name => name.startsWith('lock.stale.')));
    } finally {
        resume('winner'); resume('loser');
        writeFileSync(join(fixture.directory, 'release'), '');
        await Promise.allSettled(pending);
        fixture.dispose();
    }
});

test('a detached unproven worktree never acquires GitHub evidence from another planned item', () => {
    const fixture = cleanupGithubFixture();
    try {
        fixture.git(fixture.worktrees[1], 'checkout', '--detach');
        const detached = { ...fixture.pulls[1], head: { ...fixture.pulls[1].head, ref: '' } };
        writeFileSync(join(fixture.directory, 'response'), JSON.stringify([...fixture.pulls, detached]));
        fixture.run(['--hook']);
        assert.ok(existsSync(fixture.worktrees[1]));
        assert.equal(existsSync(fixture.worktrees[0]), false);
        assert.equal(existsSync(fixture.worktrees[2]), false);
        assert.equal(fixture.calls().length, 1);
    } finally { fixture.dispose(); }
});

test('git delivery evidence avoids GitHub entirely', () => {
    const fixture = cleanupGithubFixture();
    try {
        for (const pull of fixture.pulls) fixture.git(fixture.repository, 'merge', '--no-ff', pull.head.ref, '-m', 'delivered', '-s', 'ours');
        fixture.git(fixture.repository, 'update-ref', 'refs/remotes/origin/main', 'main');
        assert.match(fixture.run(), /3 removed/);
        assert.equal(fixture.calls().length, 0);
    } finally { fixture.dispose(); }
});

test('only a merged PR with both the exact head ref and SHA is delivery evidence', () => {
    const fixture = cleanupGithubFixture();
    try {
        const pulls = [
            fixture.pulls[0],
            { ...fixture.pulls[1], merged_at: null },
            { ...fixture.pulls[2], head: { ...fixture.pulls[2].head, sha: fixture.pulls[0].head.sha } },
            { ...fixture.pulls[2], head: { ...fixture.pulls[2].head, ref: 'other-branch' } },
        ];
        writeFileSync(join(fixture.directory, 'response'), JSON.stringify(pulls));
        const output = fixture.run(['--hook']);
        assert.match(output, /2 removed/); // The worktree and its now-unused branch are counted separately.
        assert.equal(existsSync(fixture.worktrees[0]), false);
        assert.ok(existsSync(fixture.worktrees[1]));
        assert.ok(existsSync(fixture.worktrees[2]));
        assert.equal(fixture.calls().length, 1);
    } finally { fixture.dispose(); }
});

test('concurrent hook runs honour the shared lock and published stamp', async () => {
    const fixture = cleanupGithubFixture();
    let pending: Promise<string> | undefined;
    try {
        writeFileSync(join(fixture.directory, 'block'), '');
        pending = fixture.runAsync();
        for (let attempt = 0; attempt < 500 && fixture.calls().length === 0; attempt++) await delay(20);
        assert.equal(fixture.calls().length, 1, 'first run must reach fake gh');
        assert.ok(existsSync(join(fixture.state, 'stamp')), 'stamp must precede the request');
        assert.match(fixture.run(undefined, fixture.worktrees[0]), /0 removed/);
        assert.equal(fixture.calls().length, 1);
        writeFileSync(join(fixture.directory, 'release'), '');
        assert.match(await pending, /3 removed/);
        assert.match(fixture.run(), /3 removed/);
        assert.equal(fixture.calls().length, 1);
    } finally {
        writeFileSync(join(fixture.directory, 'release'), '');
        if (pending) await pending;
        fixture.dispose();
    }
});

test('hook mode ignores commands that deliver no work', () => {
    const result = spawnSync('bash', [script, '--hook'], {
        input: JSON.stringify({ hook_event_name: 'PostToolUse', cwd: repositoryRoot, tool_input: { command: 'ls -la' } }),
        encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), '');
});

test('Claude runs it after a Bash command and at session start', () => {
    const settings = JSON.parse(readFileSync(join(corpus, 'hooks', 'settings.template.json'), 'utf8'));
    const commands = (event: string) => JSON.stringify(settings.hooks[event] ?? []);
    assert.match(commands('SessionStart'), /cratis-cleanup-worktrees\.sh --hook/);
    const post = settings.hooks.PostToolUse.find((entry: { matcher: string }) => entry.matcher === 'Bash');
    assert.match(JSON.stringify(post), /cratis-cleanup-worktrees\.sh --hook/);
});

test('Pi runs it after a Bash result and at session start', () => {
    const extension = readFileSync(join(corpus, 'harnesses', 'pi', 'extensions', 'cratis-hooks', 'index.ts'), 'utf8');
    assert.match(extension, /pi\.on\("session_start"[\s\S]*sweepDelivered\("SessionStart"/);
    assert.match(extension, /sweepDelivered\("PostToolUse"/);
});

test('ship-changes ends with the cleanup for harnesses that have no hook', () => {
    const prompt = readFileSync(join(corpus, 'prompts', 'ship-changes.prompt.md'), 'utf8');
    assert.match(prompt, /## Cleanup[\s\S]*cratis-cleanup-worktrees\.sh/);
});
