// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import registerCratisHooks from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/index.ts';

const root = resolve(import.meta.dirname, '../..');
const scripts = join(root, '.cratis/ai/hooks/scripts');
const checker = join(scripts, 'cratis-check-pr.mjs');
const guard = join(scripts, 'cratis-guard-pr-body.sh');
const rulesRef = '40125b4fcae388e62ed9471edfffd0e991422f0a';

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

function fixture() {
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
    writeFileSync(join(bin, 'gh'), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.TEST_CALLS, JSON.stringify(args) + '\\n');
if (args[0] === 'api' && args.includes('user')) { console.log('woksin'); }
else if (args[0] === 'api') {
    if (process.env.TEST_OFFLINE === '1') process.exit(1);
    const endpoint = args.at(-1);
    if (endpoint.endsWith('/contents/.github/workflows')) console.log(JSON.stringify(process.env.TEST_REMOTE_CALLERS === '0' ? [] : [{ name: 'release.yml', path: '.github/workflows/release.yml', type: 'file' }]));
    else if (endpoint.endsWith('/contents/.github/workflows/release.yml')) console.log('jobs:\\n  verify:\\n    uses: Cratis/Workflows/.github/workflows/verify-release-notes.yml@main');
    else console.log(fs.readFileSync(process.env.TEST_WORKFLOW, 'utf8').trimEnd());
} else if (args[0] === 'repo') console.log(JSON.stringify({ nameWithOwner: args[2] === '--json' ? 'Cratis/Example' : args[2], defaultBranchRef: { name: 'main' } }));
else if (args[0] === 'pr') {
    if (process.env.TEST_PR_FAILURE === '1') process.exit(1);
    console.log(JSON.stringify({ labels: JSON.parse(process.env.TEST_PR_LABELS || '[{"name":"minor"},{"name":"dependencies"}]'), body: process.env.TEST_PR_BODY || 'current-body', author: JSON.parse(process.env.TEST_PR_AUTHOR || '{"login":"woksin"}'), baseRefName: 'main' }));
} else process.exit(1);
`, { mode: 0o755 });
    const cache = join(directory, 'cache');
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, XDG_CACHE_HOME: cache,
        TEST_CALLS: calls, TEST_WORKFLOW: downloaded, TEST_OFFLINE: '0', TEST_PR_FAILURE: '0', GH_REPO: '',
        GH_TOKEN: 'must-not-reach-program', GITHUB_TOKEN: 'must-not-reach-program', TEST_SECRET: 'must-not-reach-program', NODE_OPTIONS: '--no-warnings',
        PR_JSON: 'must-not-reach-program', NUMBER: '123', GITHUB_STEP_SUMMARY: 'must-not-write' };
    const run = (args: string[], extra: NodeJS.ProcessEnv = {}) => spawnSync(process.execPath, [checker, ...args], { cwd: directory, env: { ...env, ...extra }, encoding: 'utf8', timeout: 15000 });
    const hook = (command: string, extra: NodeJS.ProcessEnv = {}, claude = false) => spawnSync('bash', [guard], {
        cwd: directory, env: { ...env, ...extra }, input: JSON.stringify({ cwd: directory, hook_event_name: claude ? 'PreToolUse' : undefined, tool_input: { command } }), encoding: 'utf8', timeout: 15000,
    });
    return { directory, body, cache, callers, noNodePath, rulesCache: join(cache, 'cratis/release-notes', rulesRef), downloaded, calls, env, run, hook, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}

test('the checker extracts both marked programs, caches by blob SHA, and preserves no-release intent', () => {
    const f = fixture();
    try {
        const result = f.run(['--body-file', f.body, '--label', 'no-release']);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /Gate read proposed body for Cratis\/Example by woksin/);
        assert.match(result.stdout, /Drift base: main/);
        const bytes = Buffer.from(workflow);
        const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
        assert.deepEqual(readdirSync(f.rulesCache), [`${sha}.cjs`]);
        const calls = readFileSync(f.calls, 'utf8');
        assert.match(calls, /application\/vnd.github.raw/);
        assert.ok(calls.includes(`verify-release-notes.yml?ref=${rulesRef}`));
        writeFileSync(f.body, 'reject-me');
        const rejected = f.run(['--body-file', f.body, '--label', 'no-release']);
        assert.equal(rejected.status, 1);
        assert.match(rejected.stdout, /rejected by downloaded program/);
    } finally { f.cleanup(); }
});

test('no-release accepts summary-only bodies and metadata edits but still rejects contract violations', () => {
    const f = fixture();
    try {
        const bundle = readFileSync(join(scripts, 'cratis-release-notes-reviewed.cjs'), 'utf8');
        const programs = [...bundle.matchAll(/\nif \(process\.argv\[2\] === "([^"]+)"\) \{\n([\s\S]*?)\n\}(?=\nif \(process\.argv\[2\]|\s*$)/g)];
        assert.equal(programs.length, 2);
        writeFileSync(f.downloaded, programs.map(([, name, source]) =>
            `  ${name}:\n    run: |\n      node - <<'JS'\n${source.split('\n').map(line => `      ${line}`).join('\n')}\n      JS\n`).join(''));
        const summary = '## Summary\n\nInternal CI cleanup.\n';
        writeFileSync(f.body, summary);
        const valid = f.run(['--body-file', f.body, '--label', 'no-release']);
        assert.equal(valid.status, 0, valid.stdout + valid.stderr);
        assert.equal(f.run(['--body-file', f.body, '--label', 'patch']).status, 1);
        const metadata = { TEST_PR_LABELS: '[{"name":"no-release"}]', TEST_PR_BODY: summary };
        assert.equal(f.hook(`gh pr create -F '${f.body}' -lno-release`).status, 0);
        assert.equal(f.hook('gh pr edit 7 --add-assignee woksin', metadata).status, 0);
        writeFileSync(f.body, '## Testing\n\nInternal CI cleanup.\n');
        const invalid = f.run(['--body-file', f.body, '--label', 'no-release']);
        assert.equal(invalid.status, 1);
        assert.match(invalid.stdout, /::warning title=Release notes%3A/);
        assert.equal(f.hook(`gh pr create -F '${f.body}' -lno-release`).status, 2);
        assert.equal(f.hook('gh pr edit 7 --add-assignee woksin', { ...metadata, TEST_PR_BODY: '## Testing\n\nInternal CI cleanup.' }).status, 2);
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
        writeFileSync(join(f.rulesCache, `${'f'.repeat(40)}.cjs`), 'truncated');
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
        assert.equal(f.hook('gh\tpr\tcreate --body inline').status, 2);
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
        const claude = f.hook(`gh pr create -F '${f.body}' --label patch`, { TEST_OFFLINE: '1' }, true);
        assert.equal(claude.status, 0);
        assert.match(JSON.parse(claude.stdout).systemMessage, /unchecked/);
        assert.match(JSON.parse(claude.stdout).hookSpecificOutput.additionalContext, /unchecked/);
        assert.equal(claude.stderr, '');
    } finally { f.cleanup(); }
});

test('the hook is silent in non-Cratis repositories and Cratis repositories without workflow callers', () => {
    const f = fixture();
    try {
        assert.equal(spawnSync('git', ['-C', f.directory, 'remote', 'set-url', 'origin', 'https://github.com/Someone/Example.git']).status, 0);
        const consumer = f.hook("gh pr create --body 'inline'");
        assert.equal(consumer.status, 0);
        assert.equal(consumer.stderr, '');
        assert.equal(f.hook('cd "$DIR" && gh pr create --body inline').status, 0);
        assert.equal(readFileSync(f.calls, 'utf8'), '');
        assert.equal(spawnSync('git', ['-C', f.directory, 'remote', 'set-url', 'origin', 'https://github.com/Cratis/Example.git']).status, 0);
        rmSync(join(f.callers, 'release.yml'));
        writeFileSync(join(f.callers, 'irrelevant.yml'), '# uses: Cratis/Workflows/.github/workflows/verify-release-notes.yml@main\njobs: {}\n');
        const noCaller = f.hook("gh pr create --body 'inline'");
        assert.equal(noCaller.status, 0);
        assert.equal(noCaller.stderr, '');
        assert.equal(readFileSync(f.calls, 'utf8'), '');
        for (const name of ['verify-semver-label', 'verify-release-intent']) {
            writeFileSync(join(f.callers, 'intent.yml'), `jobs:\n  intent:\n    uses: Cratis/Workflows/.github/workflows/${name}.yml@${rulesRef}\n`);
            assert.equal(f.hook("gh pr create --body 'inline'").status, 2);
        }
    } finally { f.cleanup(); }
});

test('the hook stays silent instead of crashing when a caller provides no stdin at all', () => {
    const f = fixture();
    try {
        // Reopening /dev/stdin fails with ENXIO once the pipe's write end is already closed, which is
        // exactly how Pi's bridge (spawn + write + end, not spawnSync's buffered `input`) invokes every
        // guard for every tool call. A crash here must not read as "block": it would refuse unrelated
        // commands never meant for this guard, as happened for the store-mutation and write guards.
        const noInput = spawnSync('bash', [guard], { cwd: f.directory, env: f.env, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
        assert.equal(noInput.status, 0, noInput.stderr);
        assert.equal(noInput.stdout, '');
        assert.equal(noInput.stderr, '');
        const closedPipe = spawnSync(process.execPath, ['-e', `
            const { spawn } = require('node:child_process');
            const proc = spawn('bash', [${JSON.stringify(guard)}], { cwd: ${JSON.stringify(f.directory)}, env: ${JSON.stringify(f.env)}, stdio: ['pipe', 'pipe', 'pipe'] });
            let out = '', err = '';
            proc.stdout.on('data', d => out += d);
            proc.stderr.on('data', d => err += d);
            proc.on('close', code => { process.stdout.write(JSON.stringify({ code, out, err })); });
            proc.stdin.write(${JSON.stringify(JSON.stringify({ cwd: f.directory, tool_input: { command: "gh pr create --body 'inline'" } }))});
            proc.stdin.end();
        `], { encoding: 'utf8', timeout: 15000 });
        assert.equal(closedPipe.status, 0, closedPipe.stderr);
        const result = JSON.parse(closedPipe.stdout);
        assert.equal(result.code, 2, result.err);
        assert.match(result.err, /write the body to.*\.ai-work\/pr-body.md/);
    } finally { f.cleanup(); }
});

test('Dependabot CLI app metadata keeps generated bodies exempt but still checks release intent', () => {
    const f = fixture();
    try {
        const metadata = { TEST_PR_AUTHOR: JSON.stringify({ id: 'BOT_kgDOAZsxxw', is_bot: true, login: 'app/dependabot', name: 'dependabot' }),
            TEST_PR_BODY: 'Bumps [Microsoft.Extensions.Hosting](https://github.com/dotnet/runtime) from 9.0.9 to 10.0.0.\n\n<details>\n<summary>Release notes</summary>\nreject-me\n</details>\n\nDependabot will resolve any conflicts with this PR as long as you do not alter it yourself.' };
        const result = f.hook('gh pr edit 4406 --remove-label minor --add-label no-release', metadata);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stderr, '');
        const calls = readFileSync(f.calls, 'utf8');
        assert.match(calls, /"pr","view","4406"/);
        assert.doesNotMatch(calls, /verify-release-notes.yml\?ref=/);
        assert.equal(f.hook('gh pr edit 4406 --add-label no-release', metadata).status, 2);
        assert.equal(f.run(['--pr', '4406', '--remove-label', 'minor', '--add-label', 'no-release'],
            { ...metadata, TEST_PR_AUTHOR: JSON.stringify({ login: 'dependabot[bot]' }) }).status, 0);
        assert.equal(f.hook('gh pr edit 4406 --remove-label minor --add-label no-release',
            { ...metadata, TEST_PR_AUTHOR: JSON.stringify({ is_bot: false, login: 'app/dependabot' }) }).status, 2);
    } finally { f.cleanup(); }
});

test('metadata edit options consume values before selecting an explicit or current-branch PR', () => {
    const f = fixture();
    try {
        for (const option of ['--add-assignee', '--remove-assignee', '--add-reviewer', '--remove-reviewer', '--add-project', '--remove-project']) {
            for (const target of ['', '7']) {
                const result = f.hook(`gh pr edit ${option} woksin ${target} --body-file '${f.body}'`);
                assert.equal(result.status, 0, result.stderr);
                const calls = readFileSync(f.calls, 'utf8').trim().split('\n').map(line => JSON.parse(line));
                const view = calls.filter(args => args[0] === 'pr').at(-1);
                assert.deepEqual(view, ['pr', 'view', ...(target ? [target] : []), '--repo', 'Cratis/Example', '--json', 'labels,body,author,baseRefName']);
            }
        }
        for (const flags of ['--head branch --template template.md', '-H branch -T template.md', '-Hbranch -Ttemplate.md']) {
            assert.equal(f.hook(`gh pr create ${flags} -F '${f.body}' -lpatch`).status, 0);
        }
    } finally { f.cleanup(); }
});

test('comments and heredoc data cannot hide mutations or create nonexecuted PR commands', () => {
    const f = fixture();
    try {
        const commented = f.hook("# here's the PR\ngh pr create --body 'inline' --label patch --title fixed\n# that's done");
        assert.equal(commented.status, 2);
        assert.match(commented.stderr, /inline/);
        const example = f.hook("cat <<'EOF'\nDon't execute this example: gh pr create --body 'inline'\nEOF\n");
        assert.equal(example.status, 0, example.stderr);
        assert.equal(example.stderr, '');
        assert.equal(readFileSync(f.calls, 'utf8'), '');
        const after = f.hook("cat <<-'EOF'\n\tDon't execute gh pr create --body 'inline'\n\tEOF\ngh pr create --body 'inline'");
        assert.equal(after.status, 2);
        assert.match(after.stderr, /inline/);
        const multiple = f.hook("cat <<ONE <<'TWO'\nDon't execute gh pr create --body inline\nONE\nDon't execute gh pr edit 7 -b inline\nTWO\n");
        assert.equal(multiple.status, 0, multiple.stderr);
        assert.equal(f.hook(`gh pr create -F '${f.body}' -lpatch # don't tokenize this quote`).status, 0);
    } finally { f.cleanup(); }
});

test('body-file redirections in the same command are blocked for both missing and stale files', () => {
    const f = fixture();
    try {
        for (const body of [f.body, join(f.directory, 'missing.md')]) {
            for (const writer of [
                `cat > '${body}' <<'EOF'\nDon't submit reject-me\nEOF\n`,
                `printf reject-me > '${body}'; `,
                `printf reject-me >> '${body}' && `,
                `printf reject-me >& '${body}'; `,
            ]) {
                const result = f.hook(`${writer}gh pr create --body-file '${body}' --label patch`);
                assert.equal(result.status, 2);
                assert.match(result.stderr, /write the body file first.*separate command/);
                assert.doesNotMatch(result.stderr, /ENOENT|Unclosed quote/);
            }
        }
        const different = f.hook(`cat > other.md <<'EOF'\nDon't execute gh pr create --body inline\nEOF\ngh pr create -F '${f.body}' -lpatch`);
        assert.equal(different.status, 0, different.stderr);
        const descriptor = f.hook(`printf diagnostic >&2; gh pr create -F '${f.body}' -lpatch`);
        assert.equal(descriptor.status, 0, descriptor.stderr);
        const relative = f.hook(`printf reject-me > 'body file.md'; gh pr edit 7 -F './body file.md'`);
        assert.equal(relative.status, 2);
        assert.match(relative.stderr, /write the body file first/);
    } finally { f.cleanup(); }
});

test('successful hook checks are silent and only real warnings reach Pi or Claude context', () => {
    const f = fixture();
    try {
        const success = f.hook(`gh pr create -F '${f.body}' -lpatch`);
        assert.equal(success.status, 0, success.stderr);
        assert.equal(success.stdout, '');
        assert.equal(success.stderr, '');
        for (const body of ['drift-me', 'skip-drift']) {
            writeFileSync(f.body, body);
            const pi = f.hook(`gh pr create -F '${f.body}' -lpatch`);
            assert.equal(pi.status, 0);
            assert.match(pi.stderr, /^::(?:warning|notice)/);
            assert.doesNotMatch(pi.stderr, /Gate read|Drift base/);
            const claude = f.hook(`gh pr create -F '${f.body}' -lpatch`, {}, true);
            assert.equal(claude.status, 0);
            assert.equal(claude.stderr, '');
            assert.match(JSON.parse(claude.stdout).systemMessage, /^::(?:warning|notice)/);
        }
    } finally { f.cleanup(); }
});

test('rules use the repository caller SHA and never reuse a cache from another pin', () => {
    const f = fixture();
    try {
        assert.equal(f.run(['--body-file', f.body, '--label', 'patch']).status, 0);
        const otherRef = 'a'.repeat(40);
        writeFileSync(join(f.callers, 'release.yml'), `jobs:\n  verify:\n    uses: Cratis/Workflows/.github/workflows/verify-release-notes.yml@${otherRef}\n`);
        assert.equal(f.run(['--body-file', f.body, '--label', 'patch'], { TEST_OFFLINE: '1' }).status, 3);
        assert.equal(f.run(['--body-file', f.body, '--label', 'patch']).status, 0);
        assert.ok(readFileSync(f.calls, 'utf8').includes(`verify-release-notes.yml?ref=${otherRef}`));
        writeFileSync(join(f.callers, 'release.yml'), 'jobs:\n  verify:\n    uses: Cratis/Workflows/.github/workflows/verify-release-notes.yml@main\n');
        const floating = f.run(['--body-file', f.body, '--label', 'patch']);
        assert.equal(floating.status, 0, floating.stderr);
        assert.match(readFileSync(f.calls, 'utf8'), /verify-release-notes.yml\?ref=main/);
        writeFileSync(f.body, 'reject-me');
        assert.equal(f.run(['--body-file', f.body, '--label', 'patch']).status, 1);
        const fallback = f.run(['--body-file', f.body, '--label', 'patch'], { TEST_OFFLINE: '1' });
        assert.equal(fallback.status, 1, fallback.stderr);
        assert.match(fallback.stderr, /using bundled reviewed/);
        writeFileSync(f.body, '## Fixed\n\n- Command handling works correctly.\n');
        assert.equal(f.run(['--body-file', f.body, '--label', 'patch'], { TEST_OFFLINE: '1' }).status, 0);
        assert.equal(f.run(['--body-file', f.body, '--label', 'patch', '--strict'], { TEST_OFFLINE: '1' }).status, 1);
    } finally { f.cleanup(); }
});

test('environment assignments, env and command prefixes cannot hide guarded commands', () => {
    const f = fixture();
    try {
        for (const prefix of ['GH_REPO=Cratis/Example', 'env GH_REPO=Cratis/Example', 'command', 'env GH_REPO=Cratis/Example command', 'rtk env FOO=bar']) {
            assert.equal(f.hook(`${prefix} gh pr create --body inline --label patch`).status, 2, prefix);
            assert.equal(f.hook(`${prefix} gh pr create -F '${f.body}' -lpatch`).status, 0, prefix);
        }
    } finally { f.cleanup(); }
});

test('GH_REPO assignments and inherited values resolve targets across checkouts and metadata calls', () => {
    const f = fixture();
    try {
        for (const prefix of ['GH_REPO=Someone/Personal', 'env GH_REPO=Someone/Personal']) {
            assert.equal(f.hook(`${prefix} gh pr create --body inline`).status, 0);
        }
        assert.equal(f.hook('gh pr create --body inline', { GH_REPO: 'Someone/Personal' }).status, 0);
        assert.equal(f.hook('env GH_REPO=Someone/Personal gh pr create -R Cratis/Example --body inline').status, 2);
        assert.equal(spawnSync('git', ['-C', f.directory, 'remote', 'set-url', 'origin', 'https://github.com/Someone/Personal.git']).status, 0);
        for (const prefix of ['GH_REPO=Cratis/Other', 'env GH_REPO=Cratis/Other', 'command GH_REPO=Cratis/Other', 'env GH_REPO=Someone/Personal GH_REPO=Cratis/Other']) {
            assert.equal(f.hook(`${prefix} gh pr create --body inline`).status, 2, prefix);
            const valid = f.hook(`${prefix} gh pr create -F '${f.body}' -lpatch`);
            assert.equal(valid.status, 0, valid.stderr);
        }
        assert.equal(f.hook('gh pr create --body inline', { GH_REPO: 'Cratis/Other' }).status, 2);
        assert.equal(f.hook(`gh pr edit 7 -F '${f.body}'`, { GH_REPO: 'Cratis/Other' }).status, 0);
        assert.equal(f.hook('GH_REPO=Cratis/Other gh pr create -R Someone/Personal --body inline').status, 0);
        assert.equal(f.hook('GH_REPO="$TARGET" gh pr create --body inline').status, 2);
        assert.equal(f.hook('GH_REPO= gh pr create --body inline', { GH_REPO: 'Cratis/Other' }).status, 0);
        const calls = readFileSync(f.calls, 'utf8');
        assert.match(calls, /repos\/Cratis\/Other\/contents\/\.github\/workflows/);
        assert.match(calls, /"pr","view","7","--repo","Cratis\/Other"/);
        assert.match(calls, /"repo","view","Cratis\/Other"/);
        assert.doesNotMatch(calls, /"repo","view","Someone\/Personal"/);
    } finally { f.cleanup(); }
});

test('tee writes cannot submit missing or stale body files in the same command', () => {
    const f = fixture();
    try {
        for (const body of [f.body, join(f.directory, 'missing.md')]) {
            for (const flags of ['', '-a ', '-- ']) {
                const result = f.hook(`echo reject-me | tee ${flags}'${body}' && gh pr create -F '${body}' -lpatch`);
                assert.equal(result.status, 2, result.stderr);
                assert.match(result.stderr, /write the body file first/);
            }
        }
        assert.equal(f.hook(`echo text | tee other.md && gh pr create -F '${f.body}' -lpatch`).status, 0);
    } finally { f.cleanup(); }
});

test('line continuations are guarded for both create and edit', () => {
    const f = fixture();
    try {
        for (const operation of ['create', 'edit 7']) {
            for (const separator of ['\\\n', '\\\n  ']) {
                assert.equal(f.hook(`gh pr ${separator}${operation} --body inline`).status, 2);
                assert.equal(f.hook(`gh ${separator}pr ${operation} --body inline`).status, 2);
                assert.equal(f.hook(`gh pr ${separator}${operation} -F '${f.body}' -lpatch`).status, 0);
            }
        }
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
