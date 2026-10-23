// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const root = resolve(import.meta.dirname, '../..');
export const scripts = join(root, '.cratis/ai/hooks/scripts');
export const checker = join(scripts, 'cratis-check-pr.mjs');
export const guard = join(scripts, 'cratis-guard-pr-body.sh');
export const rulesRef = '40125b4fcae388e62ed9471edfffd0e991422f0a';

// The test programs are protocol probes, not copies of release-note policy. They prove that the
// downloaded marked source runs unchanged, with the local body's environment, rather than a
// local approximation or a live fetch that could overwrite the proposed body.
export const workflow = `jobs:
  verify:
    run: |
      node - <<'JS'
      // cratis:program read-pull-request
      throw new Error('The live-read helper must not run locally');
      JS
      node - <<'JS'
      "use strict";
      // cratis:program release-notes
      if (process.env.PR_JSON || process.env.GH_TOKEN || process.env.NUMBER || process.env.TEST_SECRET || process.env.NODE_OPTIONS || process.env.GITHUB_TOKEN) throw new Error('Live state leaked');
      if (JSON.parse(process.env.PR_LABELS).filter(x => ['major', 'minor', 'patch', 'no-release'].includes(x)).length !== 1) process.exit(1);
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

// The combined policy workflow carries other marked programs next to the release-note pair; they
// throw so a bundle that picked one up fails loudly instead of passing by accident.
export const policyWorkflow = `${workflow}  intent:
    run: |
      node - <<'JS'
      "use strict";
      // cratis:program release-intent
      throw new Error('The release-intent program must not run locally');
      JS
  aggregate:
    run: |
      node - <<'JS'
      "use strict";
      // cratis:program aggregate-policy
      throw new Error('The aggregate-policy program must not run locally');
      JS
`;
export const policyCaller = (ref: string) => `jobs:\n  policy:\n    uses: Cratis/Workflows/.github/workflows/verify-pull-request-policy.yml@${ref}\n    with:\n      release-intent: true\n`;

export function fixture() {
    const directory = mkdtempSync(join(tmpdir(), 'cratis-pr-body-'));
    const bin = join(directory, 'bin');
    mkdirSync(bin);
    const noNodePath = join(directory, 'no-node-bin');
    mkdirSync(noNodePath);
    for (const command of ['bash', 'git', 'grep']) {
        const executable = spawnSync('bash', ['-c', 'command -v "$1"', '--', command], { encoding: 'utf8' }).stdout.trim();
        symlinkSync(executable, join(noNodePath, command));
    }
    assert.equal(spawnSync('git', ['init', '--quiet', directory]).status, 0);
    assert.equal(spawnSync('git', ['-C', directory, 'remote', 'add', 'origin', 'git@github.com:Cratis/Example.git']).status, 0);
    const callers = join(directory, '.github/workflows');
    mkdirSync(callers, { recursive: true });
    writeFileSync(join(callers, 'release.yml'), `jobs:\n  verify:\n    uses: Cratis/Workflows/.github/workflows/verify-release-notes.yml@${rulesRef}\n`);
    const body = join(directory, 'body file.md');
    writeFileSync(body, '## Fixed\n\n- A product fix.\n');
    const downloaded = join(directory, 'workflow.yml');
    writeFileSync(downloaded, workflow);
    const calls = join(directory, 'calls.jsonl');
    writeFileSync(calls, '');
    const prEnvironments = join(directory, 'pr-environments.jsonl');
    writeFileSync(prEnvironments, '');
    writeFileSync(join(bin, 'gh'), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.TEST_CALLS, JSON.stringify(args) + '\\n');
if (args[0] === 'api' && args.includes('user')) { console.log('woksin'); }
else if (args[0] === 'api') {
    const endpoint = args.at(-1);
    if (endpoint.endsWith('/contents/.github/workflows') && process.env.TEST_WORKFLOWS_STATUS) {
        console.error('HTTP ' + process.env.TEST_WORKFLOWS_STATUS);
        process.exit(1);
    }
    if (process.env.TEST_WORKFLOW_FILE_STATUS) {
        // The workflows listing succeeds; fetching the workflow file itself fails.
        if (endpoint.endsWith('/contents/.github/workflows')) { console.log(JSON.stringify([{ name: 'release.yml', path: '.github/workflows/release.yml', type: 'file' }])); process.exit(0); }
        if (endpoint.endsWith('/contents/.github/workflows/release.yml')) { console.error('HTTP ' + process.env.TEST_WORKFLOW_FILE_STATUS); process.exit(1); }
    }
    if (process.env.TEST_OFFLINE === '1') process.exit(1);
    if (endpoint.endsWith('/contents/.github/workflows')) console.log(JSON.stringify(process.env.TEST_REMOTE_CALLERS === '0' ? [] : [{ name: 'release.yml', path: '.github/workflows/release.yml', type: 'file' }]));
    else if (endpoint.endsWith('/contents/.github/workflows/release.yml')) console.log('jobs:\\n  verify:\\n    uses: Cratis/Workflows/.github/workflows/' + (process.env.TEST_REMOTE_CALLER || 'verify-release-notes') + '.yml@main');
    else console.log(fs.readFileSync(process.env.TEST_WORKFLOW, 'utf8').trimEnd());
} else if (args[0] === 'repo') console.log(JSON.stringify({ nameWithOwner: args[2] === '--json' ? 'Cratis/Example' : args[2], defaultBranchRef: { name: 'main' } }));
else if (args[0] === 'pr') {
    fs.appendFileSync(process.env.TEST_PR_ENVIRONMENTS, JSON.stringify({ GH_REPO: process.env.GH_REPO }) + '\\n');
    if (args[1] === 'view' && args.includes('--repo') && args[2].startsWith('-')) {
        console.error('argument required when using the --repo flag');
        process.exit(1);
    }
    if (process.env.TEST_PR_FAILURE === '1') process.exit(1);
    if (process.env.TEST_EXPECTED_PR_REPOSITORY && process.env.GH_REPO !== process.env.TEST_EXPECTED_PR_REPOSITORY) {
        console.error('PR lookup used GH_REPO=' + process.env.GH_REPO);
        process.exit(1);
    }
    console.log(JSON.stringify({ labels: JSON.parse(process.env.TEST_PR_LABELS || '[{"name":"minor"},{"name":"dependencies"}]'), body: process.env.TEST_PR_BODY || 'current-body', author: JSON.parse(process.env.TEST_PR_AUTHOR || '{"login":"woksin"}'), baseRefName: 'main' }));
} else process.exit(1);
`, { mode: 0o755 });
    const cache = join(directory, 'cache');
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, XDG_CACHE_HOME: cache,
        TEST_CALLS: calls, TEST_PR_ENVIRONMENTS: prEnvironments, TEST_WORKFLOW: downloaded, TEST_OFFLINE: '0', TEST_PR_FAILURE: '0', GH_REPO: '',
        GH_TOKEN: 'must-not-reach-program', GITHUB_TOKEN: 'must-not-reach-program', TEST_SECRET: 'must-not-reach-program', NODE_OPTIONS: '--no-warnings',
        PR_JSON: 'must-not-reach-program', NUMBER: '123', GITHUB_STEP_SUMMARY: 'must-not-write' };
    const run = (args: string[], extra: NodeJS.ProcessEnv = {}) => spawnSync(process.execPath, [checker, ...args], { cwd: directory, env: { ...env, ...extra }, encoding: 'utf8', timeout: 15000 });
    const hook = (command: string, extra: NodeJS.ProcessEnv = {}, claude = false) => spawnSync('bash', [guard], {
        cwd: directory, env: { ...env, ...extra }, input: JSON.stringify({ cwd: directory, hook_event_name: claude ? 'PreToolUse' : undefined, tool_input: { command } }), encoding: 'utf8', timeout: 15000,
    });
    return { directory, body, cache, callers, noNodePath, rulesCache: join(cache, 'cratis/release-notes', rulesRef), downloaded, calls, prEnvironments, env, run, hook, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}

