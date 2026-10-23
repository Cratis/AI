// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import registerCratisHooks from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/index.ts';
import { fixture, guard, policyCaller, policyWorkflow, root, rulesRef, scripts, workflow } from './guard-pr-body.fixture.ts';

test('a repository with only the combined policy caller is opted in and runs its release-note programs at the caller ref', () => {
    const f = fixture();
    try {
        const policyRef = 'b'.repeat(40);
        writeFileSync(join(f.callers, 'release.yml'), policyCaller(policyRef));
        writeFileSync(f.downloaded, policyWorkflow);
        assert.equal(f.hook("gh pr create --body 'inline'").status, 2);
        assert.match(f.hook('gh pr create --body inline', { PATH: f.noNodePath }, true).stderr, /node is unavailable/);
        const result = f.run(['--body-file', f.body, '--label', 'patch']);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /Gate read proposed body for Cratis\/Example by woksin/);
        assert.match(result.stdout, /Drift base: main/);
        const calls = readFileSync(f.calls, 'utf8');
        assert.ok(calls.includes(`repos/Cratis/Workflows/contents/.github/workflows/verify-pull-request-policy.yml?ref=${policyRef}`), calls);
        assert.doesNotMatch(calls, /verify-release-notes\.yml\?ref=/);
        const bytes = Buffer.from(policyWorkflow);
        const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
        const policyCache = join(f.cache, 'cratis/verify-pull-request-policy', policyRef);
        assert.deepEqual(readdirSync(policyCache), [`${sha}.cjs`]);
        const bundle = readFileSync(join(policyCache, `${sha}.cjs`), 'utf8');
        assert.match(bundle, /\/\/ cratis:program release-notes\n/);
        assert.match(bundle, /\/\/ cratis:program release-notes-drift\n/);
        assert.doesNotMatch(bundle, /cratis:program (?:release-intent|aggregate-policy|read-pull-request)/);
        assert.deepEqual(readdirSync(join(f.cache, 'cratis')), ['verify-pull-request-policy']);
        writeFileSync(f.body, 'reject-me');
        const rejected = f.run(['--body-file', f.body, '--label', 'patch']);
        assert.equal(rejected.status, 1);
        assert.match(rejected.stdout, /rejected by downloaded program/);
        assert.equal(f.hook(`gh pr create -F '${f.body}' -lpatch`).status, 2);
    } finally { f.cleanup(); }
});

test('a policy caller takes precedence over legacy callers, and legacy callers alone still fetch verify-release-notes', () => {
    const f = fixture();
    try {
        const policyRef = 'c'.repeat(40);
        writeFileSync(f.downloaded, policyWorkflow);
        writeFileSync(join(f.callers, 'policy.yml'), policyCaller(policyRef));
        assert.equal(f.run(['--body-file', f.body, '--label', 'patch']).status, 0);
        let calls = readFileSync(f.calls, 'utf8');
        assert.ok(calls.includes(`verify-pull-request-policy.yml?ref=${policyRef}`), calls);
        assert.doesNotMatch(calls, /verify-release-notes\.yml\?ref=/);
        // A cache entry from one source workflow is never offered for the other at the same ref.
        writeFileSync(join(f.callers, 'release.yml'), `jobs:\n  verify:\n    uses: Cratis/Workflows/.github/workflows/verify-release-notes.yml@${policyRef}\n`);
        rmSync(join(f.callers, 'policy.yml'));
        assert.equal(f.run(['--body-file', f.body, '--label', 'patch'], { TEST_OFFLINE: '1' }).status, 3);
        writeFileSync(f.calls, '');
        writeFileSync(join(f.callers, 'release.yml'), `jobs:\n  verify:\n    uses: Cratis/Workflows/.github/workflows/verify-release-notes.yml@${rulesRef}\n`);
        writeFileSync(join(f.callers, 'intent.yml'), `jobs:\n  intent:\n    uses: Cratis/Workflows/.github/workflows/verify-release-intent.yml@${rulesRef}\n`);
        writeFileSync(f.downloaded, workflow);
        assert.equal(f.run(['--body-file', f.body, '--label', 'patch']).status, 0);
        calls = readFileSync(f.calls, 'utf8');
        assert.ok(calls.includes(`verify-release-notes.yml?ref=${rulesRef}`), calls);
        assert.doesNotMatch(calls, /verify-pull-request-policy\.yml/);
        assert.equal(readdirSync(f.rulesCache).length, 1);
    } finally { f.cleanup(); }
});

test('a target repository with only a remote policy caller is opted in and checked against the policy workflow', () => {
    const f = fixture();
    try {
        writeFileSync(f.downloaded, policyWorkflow);
        assert.equal(spawnSync('git', ['-C', f.directory, 'remote', 'set-url', 'origin', 'https://github.com/Someone/Personal.git']).status, 0);
        const remote = { TEST_REMOTE_CALLER: 'verify-pull-request-policy' };
        assert.equal(f.hook('gh pr create -R Cratis/Other --body inline', remote).status, 2);
        const valid = f.hook(`gh pr create -R Cratis/Other -F '${f.body}' -lpatch`, remote);
        assert.equal(valid.status, 0, valid.stderr);
        const calls = readFileSync(f.calls, 'utf8');
        assert.match(calls, /repos\/Cratis\/Other\/contents\/\.github\/workflows\/release\.yml/);
        assert.match(calls, /verify-pull-request-policy\.yml\?ref=main/);
        assert.doesNotMatch(calls, /verify-release-notes\.yml\?ref=/);
    } finally { f.cleanup(); }
});

test('the target repository opts in independently of the current checkout', () => {
    const f = fixture();
    try {
        for (const repo of ['-R Someone/Personal', '-RSomeone/Personal', '--repo=Someone/Personal', '--repo https://github.com/Someone/Personal']) {
            const result = f.hook(`gh pr create ${repo} --body inline`);
            assert.equal(result.status, 0, result.stderr);
            assert.equal(result.stderr, '');
        }
        assert.equal(f.hook('gh pr edit https://github.com/Someone/Personal/pull/7 --body inline').status, 0);
        assert.equal(f.hook('gh pr edit 7 --title https://github.com/Someone/Personal/pull/7 --body inline').status, 2);
        assert.equal(f.hook('gh pr create --body https://github.com/Someone/Personal/pull/7').status, 2);
        assert.equal(f.hook('gh pr create --repo --body inline').status, 2);
        assert.equal(readFileSync(f.calls, 'utf8'), '');
        assert.equal(spawnSync('git', ['-C', f.directory, 'remote', 'set-url', 'origin', 'https://github.com/Someone/Personal.git']).status, 0);
        for (const repo of ['-R Cratis/Other', '-RCratis/Other', '--repo=Cratis/Other', '-R github.com/Cratis/Other']) {
            assert.equal(f.hook(`gh pr create ${repo} --body inline`).status, 2);
            const valid = f.hook(`gh pr create ${repo} -F '${f.body}' -lpatch`);
            assert.equal(valid.status, 0, valid.stderr);
        }
        assert.equal(f.hook('gh pr edit https://github.com/Cratis/Other/pull/7 --body inline').status, 2);
        assert.equal(f.hook(`gh pr edit https://github.com/Cratis/Other/pull/7 -F '${f.body}'`).status, 0);
        assert.match(readFileSync(f.calls, 'utf8'), /"pr","view","https:\/\/github.com\/Cratis\/Other\/pull\/7","--repo","Cratis\/Other"/);
        assert.match(readFileSync(f.calls, 'utf8'), /"repo","view","Cratis\/Other"/);
        assert.equal(f.hook('gh pr edit https://github.com/Cratis/Other/pull/7 -R Someone/Personal --body inline').status, 2);
        assert.equal(f.hook('gh pr edit https://github.com/Someone/Personal/pull/7 -R Cratis/Other --body inline').status, 0);
        assert.equal(f.hook(`gh pr edit https://github.com/Cratis/Other/pull/7 -R Someone/Personal -F '${f.body}'`, { GH_REPO: 'Someone/Personal' }).status, 0);
        const calls = readFileSync(f.calls, 'utf8').trim().split('\n').map(line => JSON.parse(line));
        assert.deepEqual(calls.filter(args => args[0] === 'pr').at(-1), ['pr', 'view', 'https://github.com/Cratis/Other/pull/7', '--repo', 'Cratis/Other', '--json', 'labels,body,author,baseRefName']);
        assert.deepEqual(calls.filter(args => args[0] === 'repo').at(-1), ['repo', 'view', 'Cratis/Other', '--json', 'nameWithOwner,defaultBranchRef']);
        assert.equal(f.hook('gh pr create -R Cratis/Other --body inline', { TEST_REMOTE_CALLERS: '0' }).status, 0);
        assert.match(readFileSync(f.calls, 'utf8'), /repos\/Cratis\/Other\/contents\/\.github\/workflows/);
        assert.match(readFileSync(f.calls, 'utf8'), /verify-release-notes.yml\?ref=main/);
    } finally { f.cleanup(); }
});

test('PR URL prefixes retain precedence with HTTP, trailing paths, queries, and fragments', () => {
    const f = fixture();
    try {
        assert.equal(spawnSync('git', ['-C', f.directory, 'remote', 'set-url', 'origin', 'https://github.com/Someone/Personal.git']).status, 0);
        for (const url of [
            'http://github.com/Cratis/Other/pull/7',
            'https://github.com/Cratis/Other/pull/7/files',
            'https://github.com/Cratis/Other/pull/7?diff=split',
            'https://github.com/Cratis/Other/pull/7#issuecomment-123',
            'http://github.com/Cratis/Other/pull/7/files?diff=split#comment',
        ]) {
            assert.equal(f.hook(`gh pr edit '${url}' -R Someone/Personal --body inline`, { GH_REPO: 'Someone/Personal' }).status, 2, url);
            const valid = f.hook(`gh pr edit '${url}' -R Someone/Personal -F '${f.body}'`, { GH_REPO: 'Someone/Personal' });
            assert.equal(valid.status, 0, valid.stderr);
            const calls = readFileSync(f.calls, 'utf8').trim().split('\n').map(line => JSON.parse(line));
            assert.deepEqual(calls.filter(args => args[0] === 'pr').at(-1), ['pr', 'view', url, '--repo', 'Cratis/Other', '--json', 'labels,body,author,baseRefName']);
            assert.deepEqual(calls.filter(args => args[0] === 'repo').at(-1), ['repo', 'view', 'Cratis/Other', '--json', 'nameWithOwner,defaultBranchRef']);
            assert.equal(f.hook(`gh pr edit '${url.replace('Cratis/Other', 'Someone/Personal')}' -R Cratis/Other --body inline`).status, 0);
        }
    } finally { f.cleanup(); }
});

test('Node-free guards are silent for unrelated commands and repositories without opt-in', () => {
    const f = fixture();
    try {
        for (const command of ['ls', 'git status', 'echo hello']) {
            const result = f.hook(command, { PATH: f.noNodePath }, true);
            assert.equal(result.status, 0, result.stderr);
            assert.equal(result.stdout, '');
            assert.equal(result.stderr, '');
        }
        const relevant = f.hook('gh pr create --body inline', { PATH: f.noNodePath }, true);
        assert.equal(relevant.status, 0);
        assert.match(relevant.stderr, /node is unavailable/);
        rmSync(join(f.callers, 'release.yml'));
        const noCaller = f.hook('gh pr create --body inline', { PATH: f.noNodePath }, true);
        assert.equal(noCaller.stdout, '');
        assert.equal(noCaller.stderr, '');
        assert.equal(spawnSync('git', ['-C', f.directory, 'remote', 'set-url', 'origin', 'https://github.com/Someone/Personal.git']).status, 0);
        const personal = f.hook('gh pr create --body inline', { PATH: f.noNodePath }, true);
        assert.equal(personal.stdout, '');
        assert.equal(personal.stderr, '');
    } finally { f.cleanup(); }
});

test('Claude wiring includes the PR-body guard and Pi runs it even without the store-mutation guard', async () => {
    const template = JSON.parse(readFileSync(join(root, '.cratis/ai/hooks/settings.template.json'), 'utf8'));
    assert.ok(template.hooks.PreToolUse.find((hook: { matcher: string }) => hook.matcher === 'Bash').hooks
        .some((hook: { command: string }) => hook.command.includes('cratis-guard-pr-body.sh')));
    const f = fixture();
    const savedCwd = process.cwd();
    try {
        const managed = join(f.directory, '.cratis/ai/hooks/scripts');
        mkdirSync(managed, { recursive: true });
        writeFileSync(join(managed, 'cratis-guard-pr-body.sh'), '#!/bin/bash\nprintf "inline body refused" >&2\nexit 2\n');
        process.chdir(f.directory);
        const handlers = new Map<string, (event: unknown, ctx: unknown) => Promise<unknown> | unknown>();
        registerCratisHooks({ on: (event: string, handler: (event: unknown, ctx: unknown) => unknown) => handlers.set(event, handler), registerTool: () => {} } as unknown as ExtensionAPI);
        const result = await handlers.get('tool_call')!({ toolName: 'bash', input: { command: 'gh pr create --body inline' } }, { cwd: f.directory }) as { block: boolean; reason: string };
        assert.equal(result.block, true);
        assert.match(result.reason, /inline body refused/);
    } finally { process.chdir(savedCwd); f.cleanup(); }
});
