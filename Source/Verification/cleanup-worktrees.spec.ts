// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * The delivered-work cleanup must be wired in every harness that has hooks, and its own self-test (which plants
 * delivered, dirty, unmerged and brand-new worktrees) must pass: a cleanup that removes nothing, or removes
 * unfinished work, is worse than none.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const corpus = join(repositoryRoot, '.cratis', 'ai');
const script = join(corpus, 'hooks', 'scripts', 'cratis-cleanup-worktrees.sh');

test('the cleanup self-test passes', () => {
    const result = spawnSync('bash', [script, '--self-test'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /self-test: \d+ checks passed/);
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
