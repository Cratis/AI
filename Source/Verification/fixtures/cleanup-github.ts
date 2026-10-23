// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const script = join(root, '.cratis/ai/hooks/scripts/cratis-cleanup-worktrees.sh');

export function cleanupGithubFixture(count = 3) {
    mkdirSync(join(root, '.ai-work'), { recursive: true });
    const directory = mkdtempSync(join(root, '.ai-work/cleanup-github-'));
    const repository = join(directory, 'repository');
    const bin = join(directory, 'bin');
    mkdirSync(bin);
    const env = {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        GIT_AUTHOR_NAME: 'Cleanup spec', GIT_AUTHOR_EMAIL: 'cleanup@example.com',
        GIT_COMMITTER_NAME: 'Cleanup spec', GIT_COMMITTER_EMAIL: 'cleanup@example.com',
        CRATIS_CLEANUP_NO_GH: '0', CRATIS_HOOKS_SKIP_CLEANUP: '0',
        CLEANUP_FIXTURE: directory,
    };
    const git = (cwd: string, ...args: string[]) => {
        const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        return result.stdout.trim();
    };
    git(directory, 'init', '--bare', '-b', 'main', 'origin.git');
    git(directory, 'clone', join(directory, 'origin.git'), repository);
    writeFileSync(join(repository, 'base'), 'base\n');
    git(repository, 'add', 'base');
    git(repository, 'commit', '-m', 'base');
    git(repository, 'push', 'origin', 'main');
    const worktrees = Array.from({ length: count }, (_, index) => join(directory, `worktree-${index}`));
    const pulls = worktrees.map((worktree, index) => {
        git(repository, 'worktree', 'add', '-b', `topic-${index}`, worktree, 'main');
        writeFileSync(join(worktree, 'change'), `change ${index}\n`);
        git(worktree, 'add', 'change');
        git(worktree, 'commit', '-m', `change ${index}`);
        return { merged_at: '2026-01-01T00:00:00Z', head: { ref: `topic-${index}`, sha: git(worktree, 'rev-parse', 'HEAD') } };
    });
    git(repository, 'remote', 'set-url', 'origin', 'https://github.com/example/cleanup.git');
    writeFileSync(join(directory, 'response'), JSON.stringify(pulls));
    writeFileSync(join(bin, 'gh'), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$CLEANUP_FIXTURE/calls"
if [ -f "$CLEANUP_FIXTURE/block" ]; then
    for ((i=0; i<500; i++)); do
        [ -f "$CLEANUP_FIXTURE/release" ] && break
        sleep 0.02
    done
fi
if [ -f "$CLEANUP_FIXTURE/fail" ]; then
    cat "$CLEANUP_FIXTURE/fail" >&2
    exit 1
fi
cat "$CLEANUP_FIXTURE/response"
`, { mode: 0o755 });
    const options = (cwd = repository) => ({ cwd, env, encoding: 'utf8' as const });
    const payload = (cwd: string) => JSON.stringify({ hook_event_name: 'SessionStart', cwd });
    const run = (args = ['--hook', '--dry-run'], cwd = repository) => {
        const result = spawnSync('bash', [script, '--no-fetch', ...args], { ...options(cwd), input: payload(cwd) });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        return result.stdout + result.stderr;
    };
    const runAsync = () => {
        const child = spawn('bash', [script, '--no-fetch', '--hook', '--dry-run'], options());
        let output = '';
        child.stdout.on('data', chunk => { output += chunk; });
        child.stderr.on('data', chunk => { output += chunk; });
        const result = new Promise<string>((resolveResult, reject) => {
            child.once('error', reject);
            child.once('close', code => {
                if (code === 0) resolveResult(output);
                else reject(new Error(`Cleanup exit ${code}: ${output}`));
            });
        });
        child.stdin.end(payload(repository));
        return result;
    };
    const calls = () => existsSync(join(directory, 'calls')) ? readFileSync(join(directory, 'calls'), 'utf8').trim().split('\n') : [];
    const deliver = (index = 0) => {
        git(repository, 'merge', '--no-ff', pulls[index].head.ref, '-m', 'delivered', '-s', 'ours');
        git(repository, 'update-ref', 'refs/remotes/origin/main', 'main');
    };
    const withoutTool = (missing: 'gh' | 'jq') => {
        const isolated = join(directory, `without-${missing}`);
        mkdirSync(isolated);
        for (const tool of ['bash', 'git', 'awk', 'mktemp', 'rm', 'grep', 'sed', 'find', 'du', 'jq', 'gh', 'cat', 'mkdir', 'stat', 'date', 'mv', 'rmdir', 'sleep']) {
            if (tool === missing) continue;
            const located = spawnSync('bash', ['-c', 'command -v "$1"', 'bash', tool], options());
            assert.equal(located.status, 0, `fixture requires ${tool}`);
            symlinkSync(located.stdout.trim(), join(isolated, tool));
        }
        env.PATH = isolated;
        const unavailable = spawnSync('bash', ['-c', 'command -v "$1"', 'bash', missing], options());
        assert.equal(unavailable.status, 1, `${missing} must really be absent from PATH`);
    };
    return {
        directory, repository, worktrees, pulls, env, git, run, runAsync, calls, deliver, withoutTool,
        state: join(repository, '.git/cratis-cleanup-gh/example/cleanup'),
        dispose: () => rmSync(directory, { recursive: true, force: true }),
    };
}
