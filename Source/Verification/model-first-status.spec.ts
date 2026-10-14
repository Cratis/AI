// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';

const script = resolve(import.meta.dirname, '../../.cratis/ai/skills/cratis-screenplay-modeling-lifecycle/scripts/model-first-status.mjs');

function fixture(t: TestContext, initialize = true) {
    const repository = mkdtempSync(join(tmpdir(), 'model-first-status-spec-'));
    t.after(() => rmSync(repository, { recursive: true, force: true }));
    const git = (...args: string[]) => {
        const result = spawnSync('git', ['-c', 'user.name=Model first specs', '-c', 'user.email=specs@example.invalid',
            '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: repository, encoding: 'utf8', timeout: 10000 });
        assert.equal(result.status, 0, result.stderr || result.error?.message);
    };
    const write = (path: string, content = 'module Test\n') => {
        mkdirSync(dirname(join(repository, path)), { recursive: true });
        writeFileSync(join(repository, path), content);
    };
    const accept = (path: string) => {
        git('add', '--', path);
        git('commit', '--quiet', '-m', 'Accept model');
    };
    const run = (args: string[] = [], env = process.env, cwd = repository) => {
        const result = spawnSync(process.execPath, [script, '--json', ...args], { cwd, env, encoding: 'utf8', timeout: 20000 });
        assert.equal(result.error, undefined);
        return { ...result, report: JSON.parse(result.stdout) };
    };
    if (initialize) git('init', '--quiet');
    return { repository, git, write, accept, run };
}

test('a committed model opts in with HEAD as the contract and counted subjects', t => {
    const { write, accept, run } = fixture(t);
    write('Screenplay/model.play');
    accept('Screenplay/model.play');
    const { status, report } = run();
    assert.equal(status, 0);
    assert.equal(report.reason, 'committed-model');
    assert.equal(report.modelRoot, 'Screenplay');
    assert.equal(report.contract, 'HEAD');
    assert.equal(report.filesExamined, 1);
    assert.equal(report.modelFilesExamined, 1);
});

for (const withDraft of [false, true]) {
    test(`a configured root opts in ${withDraft ? 'with only a draft' : 'even when empty'}`, t => {
        const { write, run } = fixture(t);
        write('.cratis/ai.json', JSON.stringify({ mcpServers: { screenplay: { root: 'Models' } } }));
        if (withDraft) write('Models/model.play');
        const { status, report } = run();
        assert.equal(status, 0);
        assert.equal(report.reason, 'configured-root');
        assert.equal(report.modelRoot, 'Models');
        assert.equal(report.contract, null);
        assert.equal(report.filesExamined, withDraft ? 1 : 0);
        assert.equal(report.drafts.untracked.length, withDraft ? 1 : 0);
    });
}

for (const staged of [false, true]) {
    test(`${staged ? 'staged-only' : 'untracked'} models are drafts, not opt-in`, t => {
        const { write, git, run } = fixture(t);
        write('Screenplay/model.play');
        if (staged) git('add', 'Screenplay/model.play');
        const { status, report } = run();
        assert.equal(status, 1);
        assert.equal(report.optedIn, false);
        assert.equal(report.contract, null);
        assert.deepEqual(report.drafts[staged ? 'staged' : 'untracked'], ['Screenplay/model.play']);
    });
}

for (const staged of [false, true]) {
    test(`committed models with ${staged ? 'staged' : 'working-tree'} edits keep HEAD as the contract`, t => {
        const { write, accept, git, run } = fixture(t);
        write('Screenplay/model.play');
        accept('Screenplay/model.play');
        write('Screenplay/model.play', 'module Changed\n');
        if (staged) git('add', 'Screenplay/model.play');
        const { status, report } = run();
        assert.equal(status, 0);
        assert.equal(report.contract, 'HEAD');
        assert.deepEqual(report.modelChangesInProgress, ['Screenplay/model.play']);
        assert.deepEqual(report.drafts, { staged: [], untracked: [] });
    });
}

test('a committed .play outside the selected root is not opt-in', t => {
    const { write, accept, run } = fixture(t);
    write('docs/example.play');
    accept('docs/example.play');
    const { status, report } = run(['--root', 'Models']);
    assert.equal(status, 1);
    assert.equal(report.modelRoot, 'Models');
    assert.equal(report.filesExamined, 1);
    assert.equal(report.modelFilesExamined, 0);
});

for (const folder of ['Source', 'src', 'Screenplay']) {
    test(`discovery uses ${folder} without counting unrelated examples`, t => {
        const { repository, write, accept, run } = fixture(t);
        mkdirSync(join(repository, folder));
        write('docs/example.play');
        accept('docs/example.play');
        const { status, report } = run();
        assert.equal(status, 1);
        assert.equal(report.modelRoot, folder);
        assert.equal(report.modelFilesExamined, 0);
    });
}

test('discovery keeps an existing committed legacy model readable', t => {
    const { write, accept, run } = fixture(t);
    write('.cratis/screenplay/model.play');
    accept('.cratis/screenplay/model.play');
    const { status, report } = run();
    assert.equal(status, 0);
    assert.equal(report.modelRoot, '.cratis/screenplay');
});

test('discovery finds a custom model folder and runs from a repository subdirectory', t => {
    const { repository, write, accept, run } = fixture(t);
    write('Models/one/a.play');
    write('Models/two/b.play');
    accept('Models');
    const { status, report } = run([], process.env, join(repository, 'Models/one'));
    assert.equal(status, 0);
    assert.equal(report.modelRoot, 'Models');
    assert.equal(report.committed.length, 2);
});

for (const config of ['{}', '{"mcpServers":{"screenplay":{"root":null}}}', '{"mcpServers":{"screenplay":{"enabled":true}}}']) {
    test(`install/config without an explicit root is not opt-in: ${config}`, t => {
        const { write, run } = fixture(t);
        write('.cratis/ai.json', config);
        const { status, report } = run();
        assert.equal(status, 1);
        assert.equal(report.reason, 'no-accepted-model');
        assert.equal(report.filesExamined, 0);
    });
}

for (const config of ['{', '{"mcpServers":{"screenplay":{"root":false}}}', '{"mcpServers":{"screenplay":{"root":""}}}']) {
    test(`unreadable/invalid config fails with could-not-run: ${config}`, t => {
        const { write, run } = fixture(t);
        write('.cratis/ai.json', config);
        const result = run();
        assert.equal(result.status, 2);
        assert.ok(result.report.error);
        assert.match(result.stderr, /could not run/);
    });
}

test('not a Git repository returns 2, not not-opted-in', t => {
    const { run } = fixture(t, false);
    assert.equal(run().status, 2);
});

test('missing Git returns 2', t => {
    const { run } = fixture(t);
    assert.equal(run([], { ...process.env, PATH: '' }).status, 2);
});

test('invalid root arguments return 2', t => {
    const { run } = fixture(t);
    for (const args of [['--root'], ['--root', '../outside'], ['--unknown']]) assert.equal(run(args).status, 2);
});

test('the shipped self-test plants all verdicts and reports its count', () => {
    const result = spawnSync(process.execPath, [script, '--self-test'], { encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /checked 10 fixtures\/verdicts; passed/);
});
