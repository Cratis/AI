// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import registerCratisHooks from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/index.ts';

const root = resolve(import.meta.dirname, '../..');
const scripts = join(root, '.cratis/ai/hooks/scripts');
const checker = join(scripts, 'cratis-check-pr.mjs');
const guard = join(scripts, 'cratis-guard-pr-body.sh');

// The test programs are protocol probes, not copies of release-note policy. They prove that the
// downloaded marked source runs unchanged, with the local body's environment, rather than a
// local approximation or a live fetch that could overwrite the proposed body.
const workflow = `jobs:
  verify:
    run: |
      node - <<'JS'
      // cratis:program read-pull-request
      throw new Error('The live-read helper must not run locally');
      JS
      node - <<'JS'
      "use strict";
      // cratis:program release-notes
      if (process.env.PR_JSON || process.env.GH_TOKEN || process.env.NUMBER) throw new Error('Live state leaked');
      if (JSON.parse(process.env.PR_LABELS).filter(x => ['major', 'minor', 'patch'].includes(x)).length !== 1) process.exit(1);
      if (process.env.PR_BODY.includes('reject-me')) { console.log('::error::rejected by downloaded program'); process.exit(1); }
      console.log('Gate read proposed body for ' + process.env.GITHUB_REPOSITORY + ' by ' + process.env.PR_AUTHOR);
      process.exit(0);
      JS
  drift:
    run: |
      node - <<'JS'
      "use strict";
      // cratis:program release-notes-drift
      console.log('Drift base: ' + process.env.BASE);
      if (process.env.PR_BODY.includes('drift-me')) console.log('::warning title=drift::drift found');
      if (process.env.PR_BODY.includes('skip-drift')) console.log('::notice title=Release notes drift not checked::no base');
      process.exit(0);
      JS
`;

function fixture() {
    const directory = mkdtempSync(join(tmpdir(), 'cratis-pr-body-'));
    const bin = join(directory, 'bin');
    mkdirSync(bin);
    const body = join(directory, 'body file.md');
    writeFileSync(body, '## Fixed\n\n- A product fix.\n');
    const downloaded = join(directory, 'workflow.yml');
    writeFileSync(downloaded, workflow);
    const calls = join(directory, 'calls.jsonl');
    writeFileSync(join(bin, 'gh'), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.TEST_CALLS, JSON.stringify(args) + '\\n');
if (args[0] === 'api' && args.includes('user')) { console.log('woksin'); }
else if (args[0] === 'api') {
    if (process.env.TEST_OFFLINE === '1') process.exit(1);
    console.log(fs.readFileSync(process.env.TEST_WORKFLOW, 'utf8').trimEnd());
} else if (args[0] === 'repo') console.log(JSON.stringify({ nameWithOwner: 'Cratis/Example', defaultBranchRef: { name: 'main' } }));
else if (args[0] === 'pr') {
    if (process.env.TEST_PR_FAILURE === '1') process.exit(1);
    console.log(JSON.stringify({ labels: [{ name: 'minor' }, { name: 'dependencies' }], body: process.env.TEST_PR_BODY || 'current-body', author: { login: 'woksin' }, baseRefName: 'main' }));
} else process.exit(1);
`, { mode: 0o755 });
    const cache = join(directory, 'cache');
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, XDG_CACHE_HOME: cache,
        TEST_CALLS: calls, TEST_WORKFLOW: downloaded, TEST_OFFLINE: '0', TEST_PR_FAILURE: '0',
        GH_TOKEN: 'must-not-reach-program', PR_JSON: 'must-not-reach-program', NUMBER: '123', GITHUB_STEP_SUMMARY: 'must-not-write' };
    const run = (args: string[], extra: NodeJS.ProcessEnv = {}) => spawnSync(process.execPath, [checker, ...args], { cwd: directory, env: { ...env, ...extra }, encoding: 'utf8', timeout: 15000 });
    const hook = (command: string, extra: NodeJS.ProcessEnv = {}) => spawnSync('bash', [guard], {
        cwd: directory, env: { ...env, ...extra }, input: JSON.stringify({ cwd: directory, tool_input: { command } }), encoding: 'utf8', timeout: 15000,
    });
    return { directory, body, cache, downloaded, calls, env, run, hook, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}

test('the checker extracts both marked programs, caches by blob SHA, and checks no-release as release-bound', () => {
    const f = fixture();
    try {
        const result = f.run(['--body-file', f.body, '--label', 'no-release']);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /Gate read proposed body for Cratis\/Example by woksin/);
        assert.match(result.stdout, /Drift base: main/);
        const bytes = Buffer.from(workflow);
        const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
        assert.deepEqual(readdirSync(join(f.cache, 'cratis/release-notes')), [`${sha}.cjs`]);
        const calls = readFileSync(f.calls, 'utf8');
        assert.match(calls, /application\/vnd.github.raw/);
        assert.match(calls, /verify-release-notes.yml\?ref=main/);
        writeFileSync(f.body, 'reject-me');
        const rejected = f.run(['--body-file', f.body, '--label', 'no-release']);
        assert.equal(rejected.status, 1);
        assert.match(rejected.stdout, /rejected by downloaded program/);
    } finally { f.cleanup(); }
});

test('the checker rejects missing or conflicting intents and applies edit label swaps to live labels', () => {
    const f = fixture();
    try {
        assert.equal(f.run(['--body-file', f.body]).status, 1);
        assert.equal(f.run(['--body-file', f.body, '--label', 'minor,patch']).status, 1);
        assert.equal(f.run(['--body-file', f.body, '--pr', '7', '--add-label', 'patch']).status, 1);
        assert.equal(f.run(['--body-file', f.body, '--pr', '7', '--remove-label', 'minor', '--add-label', 'patch']).status, 0);
        assert.equal(f.run(['--pr', '7', '--remove-label', 'minor', '--add-label', 'patch'], { TEST_PR_BODY: 'reject-me' }).status, 1);
        assert.equal(f.run(['--pr', '7'], { TEST_PR_FAILURE: '1' }).status, 1);
    } finally { f.cleanup(); }
});

test('drift and skipped comparisons warn normally but fail in strict mode', () => {
    const f = fixture();
    try {
        for (const body of ['drift-me', 'skip-drift']) {
            writeFileSync(f.body, body);
            assert.equal(f.run(['--body-file', f.body, '--label', 'patch', '--base', 'other']).status, 0);
            assert.equal(f.run(['--body-file', f.body, '--label', 'patch', '--strict']).status, 1);
        }
    } finally { f.cleanup(); }
});

test('offline rules use the latest complete cache, report unchecked with no cache, and never hide strict warnings', () => {
    const f = fixture();
    try {
        assert.equal(f.run(['--body-file', f.body, '--label', 'patch'], { TEST_OFFLINE: '1' }).status, 3);
        assert.equal(f.run(['--body-file', f.body, '--label', 'patch']).status, 0);
        writeFileSync(join(f.cache, 'cratis/release-notes', `${'f'.repeat(40)}.cjs`), 'truncated');
        const cached = f.run(['--body-file', f.body, '--label', 'patch'], { TEST_OFFLINE: '1' });
        assert.equal(cached.status, 0);
        assert.match(cached.stderr, /using cached/);
        assert.equal(f.run(['--body-file', f.body, '--label', 'patch', '--strict'], { TEST_OFFLINE: '1' }).status, 1);
        writeFileSync(f.downloaded, 'missing markers');
        assert.match(f.run(['--body-file', f.body, '--label', 'patch']).stderr, /using cached/);
    } finally { f.cleanup(); }
});

test('the Bash hook blocks inline bodies and violations, understands literal flags, and allows unrelated commands', () => {
    const f = fixture();
    try {
        for (const command of ["gh pr create --body 'inline'", "gh pr edit 7 -b 'inline'", 'rtk gh pr edit 7 --body=inline', 'true && gh pr create -binline']) {
            const result = f.hook(command);
            assert.equal(result.status, 2, command);
            assert.match(result.stderr, /write the body to.*\.ai-work\/pr-body.md/);
        }
        assert.equal(f.hook(`gh pr create --body-file '${f.body}' --label patch`).status, 0);
        assert.equal(f.hook(`true; rtk gh pr create -F '${f.body}' -lpatch`).status, 0);
        assert.equal(f.hook(`gh pr edit 7 --body-file='${f.body}' --remove-label minor --add-label patch`).status, 0);
        assert.equal(f.hook('gh pr edit 7 --add-label patch').status, 2);
        assert.equal(f.hook('gh pr edit 7 --remove-label minor --add-label patch').status, 0);
        assert.equal(f.hook('gh pr create --body-file "$BODY" --label patch').status, 2);
        assert.equal(f.hook('gh pr create --label patch').status, 2);
        assert.equal(f.hook('git status').status, 0);
        assert.equal(f.hook("echo 'gh pr create --body inline'").status, 0);
        assert.equal(f.hook('gh pr create --help').status, 0);
        mkdirSync(join(f.directory, 'subdir'));
        writeFileSync(join(f.directory, 'subdir', 'body.md'), 'valid');
        assert.equal(f.hook('cd subdir && gh pr create -Fbody.md -lpatch').status, 0);
        writeFileSync(f.body, 'reject-me');
        const rejected = f.hook(`gh pr create -F '${f.body}' --label patch`);
        assert.equal(rejected.status, 2);
        assert.match(rejected.stderr, /rejected by downloaded program/);
    } finally { f.cleanup(); }
});

test('the Bash hook warns and passes through offline without cached rules', () => {
    const f = fixture();
    try {
        const result = f.hook(`gh pr create -F '${f.body}' --label patch`, { TEST_OFFLINE: '1' });
        assert.equal(result.status, 0);
        assert.match(result.stderr, /unchecked/);
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
