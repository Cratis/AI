// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { checker, fixture, guard, root, rulesRef, scripts, workflow } from './guard-pr-body.fixture.ts';

test('Codex shell adapter reuses PR guard fixtures without executing external operations', () => {
    const f = fixture();
    try {
        const bridge = join(root, '.cratis/ai/harnesses/codex/hooks.mjs');
        for (const command of ["gh pr create --body 'inline'", "gh pr edit 7 -b 'inline'", `gh pr create --body-file '${f.body}' --label patch --label minor`]) {
            const result = spawnSync(process.execPath, [bridge], {
                cwd: f.directory, env: f.env, encoding: 'utf8', timeout: 25000,
                input: JSON.stringify({ cwd: f.directory, session_id: 'codex-fixture', hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } }),
            });
            assert.equal(result.status, 2, result.stderr);
            assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'deny');
        }
        assert.ok(!readFileSync(f.calls, 'utf8').split('\n').some(line => /"pr","(create|edit)"/.test(line)));
    } finally {
        f.cleanup();
    }
});

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

test('the release-notes rules explain that an issue reference inside an HTML comment closes nothing', () => {
    const f = fixture();
    try {
        const bundle = readFileSync(join(scripts, 'cratis-release-notes-reviewed.cjs'), 'utf8');
        const programs = [...bundle.matchAll(/\nif \(process\.argv\[2\] === "([^"]+)"\) \{\n([\s\S]*?)\n\}(?=\nif \(process\.argv\[2\]|\s*$)/g)];
        writeFileSync(f.downloaded, programs.map(([, name, source]) =>
            `  ${name}:\n    run: |\n      node - <<'JS'\n${source.split('\n').map(line => `      ${line}`).join('\n')}\n      JS\n`).join(''));
        writeFileSync(f.body, '## Fixed\n\n- Fixed the crash.\n\n<!-- delivered (#7) -->\n');
        const commented = f.run(['--body-file', f.body, '--label', 'patch']);
        assert.equal(commented.status, 1);
        assert.match(commented.stdout, /would NOT be closed/);
        assert.doesNotMatch(commented.stdout, /still closes/);
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

test('offline rules at another pin use the latest complete cache, report unchecked with no cache, and never hide strict warnings', () => {
    const f = fixture();
    try {
        const otherRef = 'a'.repeat(40);
        const rulesCache = join(f.cache, 'cratis/release-notes', otherRef);
        writeFileSync(join(f.callers, 'release.yml'), `jobs:\n  verify:\n    uses: Cratis/Workflows/.github/workflows/verify-release-notes.yml@${otherRef}\n`);
        assert.equal(f.run(['--body-file', f.body, '--label', 'patch'], { TEST_OFFLINE: '1' }).status, 3);
        assert.equal(f.run(['--body-file', f.body, '--label', 'patch']).status, 0);
        writeFileSync(join(rulesCache, `${'f'.repeat(40)}.cjs`), 'truncated');
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

test('an unreadable body file is reported with the path tried, the directories and the checker copy, not a bare ENOENT', () => {
    const f = fixture();
    try {
        const elsewhere = mkdtempSync(join(tmpdir(), 'cratis-pr-body-elsewhere-'));
        try {
            const missing = join(f.directory, '.ai-work', 'pr-body-1.md');
            const result = spawnSync('bash', [guard], {
                cwd: elsewhere, env: f.env, encoding: 'utf8', timeout: 15000,
                input: JSON.stringify({ cwd: elsewhere, tool_input: { command: `cd '${f.directory}' && gh pr create --label patch --body-file '${missing}'` } }),
            });
            assert.equal(result.status, 2, result.stderr);
            assert.match(result.stderr, /cannot read the pull-request body file \(ENOENT\)/);
            assert.ok(result.stderr.includes(`path tried: ${missing}`), result.stderr);
            assert.ok(result.stderr.includes(`--body-file value: ${missing}`), result.stderr);
            assert.match(result.stderr, /parent directory exists: false/);
            assert.match(result.stderr, /file exists now: false/);
            assert.ok(result.stderr.includes(`hook payload directory: ${elsewhere}`), result.stderr);
            assert.ok(result.stderr.includes(`command directory: ${f.directory}`), result.stderr);
            assert.ok(result.stderr.includes(`checker script: ${checker}`), result.stderr);
        } finally { rmSync(elsewhere, { recursive: true, force: true }); }
        // The same command succeeds once the file exists - the report names a missing file, nothing else.
        mkdirSync(join(f.directory, '.ai-work'));
        writeFileSync(join(f.directory, '.ai-work', 'pr-body-1.md'), '## Fixed\n\n- A product fix.\n');
        assert.equal(f.hook(`cd '${f.directory}' && gh pr create --label patch --body-file '${join(f.directory, '.ai-work', 'pr-body-1.md')}'`).status, 0);
    } finally { f.cleanup(); }
});

test('current-branch edits preserve selectorless lookup for body and metadata changes', () => {
    const f = fixture();
    try {
        for (const flags of [`--body-file '${f.body}'`, '--add-assignee woksin']) {
            const result = f.hook(`gh pr edit ${flags}`);
            assert.equal(result.status, 0, result.stderr);
            const calls = readFileSync(f.calls, 'utf8').trim().split('\n').map(line => JSON.parse(line));
            assert.deepEqual(calls.filter(args => args[0] === 'pr').at(-1), ['pr', 'view', '--json', 'labels,body,author,baseRefName']);
            assert.deepEqual(calls.filter(args => args[0] === 'repo').at(-1), ['repo', 'view', 'Cratis/Example', '--json', 'nameWithOwner,defaultBranchRef']);
        }
    } finally { f.cleanup(); }
});

test('selectorless edits pass command-local and inherited GH_REPO to metadata lookup without --repo', () => {
    const f = fixture();
    try {
        for (const prefix of ['GH_REPO=Cratis/Other', 'env GH_REPO=Cratis/Other', 'env GH_REPO=Someone/Personal GH_REPO=Cratis/Other', '']) {
            const environment = { GH_REPO: prefix ? 'Someone/Personal' : 'Cratis/Other', TEST_EXPECTED_PR_REPOSITORY: 'Cratis/Other' };
            for (const flags of ['--add-assignee woksin', `--body-file '${f.body}'`]) {
                const result = f.hook(`${prefix} gh pr edit ${flags}`, environment);
                assert.equal(result.status, 0, result.stderr);
                const calls = readFileSync(f.calls, 'utf8').trim().split('\n').map(line => JSON.parse(line));
                assert.deepEqual(calls.filter(args => args[0] === 'pr').at(-1), ['pr', 'view', '--json', 'labels,body,author,baseRefName']);
                assert.deepEqual(calls.filter(args => args[0] === 'repo').at(-1), ['repo', 'view', 'Cratis/Other', '--json', 'nameWithOwner,defaultBranchRef']);
            }
            const rejected = f.hook(`${prefix} gh pr edit --add-assignee woksin`, { ...environment, TEST_PR_BODY: 'reject-me' });
            assert.equal(rejected.status, 2);
            assert.match(rejected.stderr, /rejected by downloaded program/);
        }
    } finally { f.cleanup(); }
});

test('edits without a repository leave selectors and GH_REPO to gh default resolution in multi-remote checkouts', () => {
    const f = fixture();
    try {
        assert.equal(spawnSync('git', ['-C', f.directory, 'remote', 'set-url', 'origin', 'https://github.com/Cratis/AI.git']).status, 0);
        assert.equal(spawnSync('git', ['-C', f.directory, 'remote', 'add', 'github', 'https://github.com/Cratis/Arc.git']).status, 0);
        assert.equal(spawnSync('git', ['-C', f.directory, 'config', 'remote.github.gh-resolved', 'base']).status, 0);
        for (const prefix of ['', 'GH_REPO=', 'env GH_REPO=']) {
            const environment = { GH_REPO: prefix ? 'Cratis/Other' : undefined };
            for (const target of ['', '471', 'feature-branch']) {
                for (const flags of ['--add-assignee woksin', `--body-file '${f.body}'`]) {
                    const result = f.hook(`${prefix} gh pr edit ${target} ${flags}`, environment);
                    assert.equal(result.status, 0, result.stderr);
                    const calls = readFileSync(f.calls, 'utf8').trim().split('\n').map(line => JSON.parse(line));
                    assert.deepEqual(calls.filter(args => args[0] === 'pr').at(-1), ['pr', 'view', ...(target ? [target] : []), '--json', 'labels,body,author,baseRefName']);
                    const environments = readFileSync(f.prEnvironments, 'utf8').trim().split('\n').map(line => JSON.parse(line));
                    assert.deepEqual(environments.at(-1), {});
                }
                const rejected = f.hook(`${prefix} gh pr edit ${target} --add-assignee woksin`, { ...environment, TEST_PR_BODY: 'reject-me' });
                assert.equal(rejected.status, 2);
                assert.match(rejected.stderr, /rejected by downloaded program/);
            }
            for (const target of ['471', 'feature-branch']) {
                const result = f.hook(`${prefix} gh pr edit ${target} --repo Cratis/X --add-assignee woksin`, environment);
                assert.equal(result.status, 0, result.stderr);
                const calls = readFileSync(f.calls, 'utf8').trim().split('\n').map(line => JSON.parse(line));
                assert.deepEqual(calls.filter(args => args[0] === 'pr').at(-1), ['pr', 'view', target, '--repo', 'Cratis/X', '--json', 'labels,body,author,baseRefName']);
                const environments = readFileSync(f.prEnvironments, 'utf8').trim().split('\n').map(line => JSON.parse(line));
                assert.deepEqual(environments.at(-1), { GH_REPO: 'Cratis/X' });
            }
        }
    } finally { f.cleanup(); }
});

test('cleared command-local GH_REPO leaves selectorless lookup to gh instead of inherited values', () => {
    const f = fixture();
    try {
        for (const prefix of ['GH_REPO=', 'env GH_REPO=']) {
            const environment = { GH_REPO: 'Cratis/Other' };
            const result = f.hook(`${prefix} gh pr edit --add-assignee woksin`, environment);
            assert.equal(result.status, 0, result.stderr);
            const calls = readFileSync(f.calls, 'utf8').trim().split('\n').map(line => JSON.parse(line));
            assert.deepEqual(calls.filter(args => args[0] === 'pr').at(-1), ['pr', 'view', '--json', 'labels,body,author,baseRefName']);
            assert.deepEqual(calls.filter(args => args[0] === 'repo').at(-1), ['repo', 'view', 'Cratis/Example', '--json', 'nameWithOwner,defaultBranchRef']);
            const rejected = f.hook(`${prefix} gh pr edit --add-assignee woksin`, { ...environment, TEST_PR_BODY: 'reject-me' });
            assert.equal(rejected.status, 2);
            assert.match(rejected.stderr, /rejected by downloaded program/);
        }
        assert.equal(spawnSync('git', ['-C', f.directory, 'remote', 'set-url', 'origin', 'https://github.com/Someone/Personal.git']).status, 0);
        const before = readFileSync(f.calls, 'utf8');
        for (const prefix of ['GH_REPO=', 'env GH_REPO=']) {
            const result = f.hook(`${prefix} gh pr edit --add-assignee woksin`, { GH_REPO: 'Cratis/Other' });
            assert.equal(result.status, 0, result.stderr);
            assert.equal(result.stderr, '');
        }
        assert.equal(readFileSync(f.calls, 'utf8'), before);
    } finally { f.cleanup(); }
});

test('dynamic directories resolve explicit repositories before deciding whether PR edits are guarded', () => {
    const f = fixture();
    try {
        for (const origin of ['Cratis/Example', 'Someone/Personal']) {
            assert.equal(spawnSync('git', ['-C', f.directory, 'remote', 'set-url', 'origin', `https://github.com/${origin}.git`]).status, 0);
            for (const directory of ['', 'cd "$HOME" && ']) {
                for (const command of [
                    'gh pr edit https://github.com/Cratis/AI/pull/471 --body inline',
                    'gh pr edit 471 --repo Cratis/AI --body inline',
                    'GH_REPO=Cratis/AI gh pr edit 471 --body inline',
                    'env GH_REPO=Cratis/AI gh pr edit 471 --body inline',
                ]) {
                    const result = f.hook(`${directory}${command}`, { GH_REPO: 'Someone/Personal' });
                    assert.equal(result.status, 2, `${origin}: ${directory}${command}`);
                    assert.match(result.stderr, directory ? /Use a literal directory/ : /inline --body/);
                    assert.match(readFileSync(f.calls, 'utf8'), /repos\/Cratis\/AI\/contents\/\.github\/workflows/);
                }
                const before = readFileSync(f.calls, 'utf8');
                for (const command of [
                    'gh pr edit https://github.com/Someone/Personal/pull/471 --body inline',
                    'gh pr edit 471 --repo Someone/Personal --body inline',
                    'GH_REPO=Someone/Personal gh pr edit 471 --body inline',
                    'env GH_REPO=Someone/Personal gh pr edit 471 --body inline',
                ]) {
                    const result = f.hook(`${directory}${command}`, { GH_REPO: 'Cratis/AI' });
                    assert.equal(result.status, 0, result.stderr);
                    assert.equal(result.stderr, '');
                }
                assert.equal(readFileSync(f.calls, 'utf8'), before);
            }
        }
        assert.equal(f.hook('cd "$HOME" && gh pr edit 471 --body inline', { GH_REPO: 'Cratis/AI' }).status, 2);
        const personal = f.hook('cd "$HOME" && gh pr edit 471 --body inline', { GH_REPO: 'Someone/Personal' });
        assert.equal(personal.status, 0, personal.stderr);
        assert.equal(personal.stderr, '');
        assert.equal(f.hook('cd "$HOME" && gh pr edit 471 --repo Cratis/AI --body inline', { TEST_REMOTE_CALLERS: '0' }).status, 0);
    } finally { f.cleanup(); }
});

test('unguarded edits from unknown directories do not skip later guarded edits', () => {
    const f = fixture();
    try {
        assert.equal(spawnSync('git', ['-C', f.directory, 'remote', 'set-url', 'origin', 'https://github.com/Someone/Personal.git']).status, 0);
        for (const prefix of ['', 'GH_REPO=', 'env GH_REPO=']) {
            const environment = { GH_REPO: prefix ? 'Cratis/Other' : undefined };
            const first = `cd "$HOME" && ${prefix} gh pr edit 1 --add-label x`;
            const skipped = f.hook(first, environment);
            assert.equal(skipped.status, 0, skipped.stderr);
            assert.equal(skipped.stderr, '');
            for (const directory of ['', 'cd /tmp && ']) {
                const result = f.hook(`${first}; ${directory}gh pr edit https://github.com/Cratis/AI/pull/471 --body inline`, environment);
                assert.equal(result.status, 2, result.stderr);
                assert.match(result.stderr, directory ? /inline --body/ : /Use a literal directory/);
                assert.match(readFileSync(f.calls, 'utf8'), /repos\/Cratis\/AI\/contents\/\.github\/workflows/);
            }
        }
        assert.equal(f.hook('cd "$HOME" && GH_REPO= gh pr edit 1 --repo "$R" --add-label x', { GH_REPO: 'Cratis/Other' }).status, 2);
    } finally { f.cleanup(); }
});

test('dynamic directories only block executable PR mutations, not quoted examples', () => {
    const f = fixture();
    try {
        for (const directory of ['~/x', '"$HOME"', '"$(pwd)"']) {
            for (const command of ['grep -rn "gh pr create" .', "printf '%s\\n' 'gh pr create'", 'gh pr create --help']) {
                const result = f.hook(`cd ${directory} && ${command}`);
                assert.equal(result.status, 0, result.stderr);
                assert.equal(result.stderr, '');
            }
            const mutation = f.hook(`cd ${directory} && gh pr edit --add-assignee woksin`);
            assert.equal(mutation.status, 2);
            assert.match(mutation.stderr, /Use a literal directory/);
            assert.equal(f.hook(`cd ${directory} && cd subdir && gh pr edit --add-assignee woksin`).status, 2);
            assert.equal(f.hook(`cd ${directory} && cd '${f.directory}' && gh pr edit --add-assignee woksin`).status, 0);
        }
    } finally { f.cleanup(); }
});

