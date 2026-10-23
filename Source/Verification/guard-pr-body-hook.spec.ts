// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fixture, guard, rulesRef, workflow } from './guard-pr-body.fixture.ts';

test('the Bash hook checks bundled reviewed rules offline and surfaces warnings to Pi and Claude', () => {
    const f = fixture();
    try {
        const result = f.hook(`gh pr create -F '${f.body}' --label patch`, { TEST_OFFLINE: '1' });
        assert.equal(result.status, 0);
        assert.match(result.stderr, /using bundled reviewed/);
        assert.doesNotMatch(result.stderr, /unchecked/);
        const claude = f.hook(`gh pr create -F '${f.body}' --label patch`, { TEST_OFFLINE: '1' }, true);
        assert.equal(claude.status, 0);
        assert.match(JSON.parse(claude.stdout).systemMessage, /using bundled reviewed/);
        assert.match(JSON.parse(claude.stdout).hookSpecificOutput.additionalContext, /using bundled reviewed/);
        assert.equal(claude.stderr, '');
        writeFileSync(f.body, '## Testing\n\n- A product fix.\n');
        assert.equal(f.hook(`gh pr create -F '${f.body}' --label patch`, { TEST_OFFLINE: '1' }).status, 2);
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
                assert.deepEqual(view, ['pr', 'view', ...(target ? [target] : []), '--json', 'labels,body,author,baseRefName']);
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

test('failed opt-in authentication warns but still checks bundled rules for a Cratis target', () => {
    const f = fixture();
    try {
        assert.equal(spawnSync('git', ['-C', f.directory, 'remote', 'set-url', 'origin', '/local/mirror/Example.git']).status, 0);
        const command = `gh pr create -R Cratis/Other -F '${f.body}' -lpatch`;
        const environment = { TEST_WORKFLOWS_STATUS: '401', TEST_OFFLINE: '1' };
        for (const claude of [false, true]) {
            const valid = f.hook(command, environment, claude);
            assert.equal(valid.status, 0, valid.stderr);
            const warnings = claude ? JSON.parse(valid.stdout).systemMessage : valid.stderr;
            assert.match(warnings, /could not determine release-workflow opt-in for Cratis\/Other.*HTTP 401.*checking against bundled reviewed rules/i);
            assert.match(warnings, /using bundled reviewed/);
            assert.doesNotMatch(warnings, /unchecked/);
            if (claude) {
                assert.equal(valid.stderr, '');
                assert.equal(JSON.parse(valid.stdout).hookSpecificOutput.additionalContext, warnings);
            }
        }
        writeFileSync(f.body, '## Testing\n\n- A product fix.\n');
        const invalid = f.hook(command, environment);
        assert.equal(invalid.status, 2, invalid.stderr);
        assert.match(invalid.stderr, /Heading not allowed/);
        assert.match(invalid.stderr, /failed cratis-check-pr/);
    } finally { f.cleanup(); }
});

test('a failed workflow file fetch is an unknown, never a skip, for a Cratis target', () => {
    const f = fixture();
    try {
        assert.equal(spawnSync('git', ['-C', f.directory, 'remote', 'set-url', 'origin', '/local/mirror/Example.git']).status, 0);
        const command = `gh pr create -R Cratis/Other -F '${f.body}' -lpatch`;
        for (const status of ['401', '404']) {
            const environment = { TEST_WORKFLOW_FILE_STATUS: status, TEST_OFFLINE: '1' };
            writeFileSync(f.body, '## Fixed\n\n- A product fix.\n');
            const valid = f.hook(command, environment);
            assert.equal(valid.status, 0, valid.stderr);
            assert.match(valid.stderr, new RegExp(`could not determine release-workflow opt-in for Cratis/Other.*HTTP ${status}`, 'i'));
            writeFileSync(f.body, '## Testing\n\n- A product fix.\n');
            const invalid = f.hook(command, environment);
            assert.equal(invalid.status, 2, invalid.stderr);
            assert.match(invalid.stderr, /Heading not allowed/);
        }
    } finally { f.cleanup(); }
});

test('a workflows 404 still skips opt-in and non-Cratis lookup failures do not gain bundled enforcement', () => {
    const f = fixture();
    try {
        const absent = f.hook('gh pr create -R Cratis/Other --body inline', { TEST_WORKFLOWS_STATUS: '404' });
        assert.equal(absent.status, 0, absent.stderr);
        assert.equal(absent.stderr, '');
        const calls = readFileSync(f.calls, 'utf8').trim().split('\n').map(line => JSON.parse(line));
        assert.deepEqual(calls, [['api', 'repos/Cratis/Other/contents/.github/workflows']]);
        const personal = f.run(['--repo', 'Someone/Personal', '--body-file', f.body, '--label', 'patch'], { TEST_WORKFLOWS_STATUS: '401' });
        assert.equal(personal.status, 1);
        assert.match(personal.stderr, /Could not determine release-workflow opt-in.*HTTP 401/);
        assert.doesNotMatch(personal.stderr, /bundled reviewed/);
    } finally { f.cleanup(); }
});

test('offline rules at the reviewed pin use the bundle before any cache', () => {
    const f = fixture();
    try {
        assert.equal(f.run(['--body-file', f.body, '--label', 'patch']).status, 0);
        assert.equal(readdirSync(f.rulesCache).length, 1);
        // The cached protocol probe accepts this body; the reviewed bundle must reject it.
        writeFileSync(f.body, '## Testing\n\n- A product fix.\n');
        const invalid = f.run(['--body-file', f.body, '--label', 'patch'], { TEST_OFFLINE: '1' });
        assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr);
        assert.match(invalid.stderr, /using bundled reviewed/);
        assert.doesNotMatch(invalid.stderr, /using cached|unchecked/);
        writeFileSync(f.body, '## Fixed\n\n- A product fix.\n');
        assert.equal(f.run(['--body-file', f.body, '--label', 'patch', '--strict'], { TEST_OFFLINE: '1' }).status, 1);
    } finally { f.cleanup(); }
});

