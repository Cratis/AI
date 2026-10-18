// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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

for (const path of [
    'Source/X.Specs/Projections/for_model/Cases/fixture.play',
    'Source/X.Tests/fixture.play', 'Source/Specs/fixture.play', 'src/Tests/fixture.play',
    'Source/for_model/fixture.play', 'src/fixtures/fixture.play', 'Source/Cases/fixture.play',
    'src/test-assets/fixture.play', 'Source/test_assets/fixture.play',
    'Source/examples/example.play', 'Source/docs/example.play', 'Source/samples/example.play',
    'src/examples/example.play', 'src/docs/example.play', 'src/samples/example.play',
]) {
    test(`discovery never accepts a committed non-project model: ${path}`, t => {
        const { write, accept, run } = fixture(t);
        write(path);
        accept(path);
        const { status, report } = run();
        assert.equal(status, 1);
        assert.equal(report.filesExamined, 1);
        assert.equal(report.modelFilesExamined, 0);
        assert.deepEqual(report.committed, []);
    });
}

for (const staged of [false, true]) {
    test(`a ${staged ? 'staged' : 'untracked'} legacy draft cannot displace a committed project root`, t => {
        const { write, accept, git, run } = fixture(t);
        write('Source/model.play');
        accept('Source/model.play');
        write('.cratis/screenplay/draft.play');
        if (staged) git('add', '.cratis/screenplay/draft.play');
        const { status, report } = run();
        assert.equal(status, 0);
        assert.equal(report.modelRoot, 'Source');
        assert.deepEqual(report.committed, ['Source/model.play']);
        assert.equal(report.filesExamined, 2);
        assert.equal(report.modelFilesExamined, 1);
    });
}

for (const root of ['Source', 'src', '.']) {
    test(`discovered root ${root} excludes nested non-project models from acceptance`, t => {
        const { write, accept, run } = fixture(t);
        const prefix = root === '.' ? '' : `${root}/`;
        write(`${prefix}one/model.play`);
        write(`${prefix}two/model.play`);
        write(`${prefix}docs/example.play`);
        write(`${prefix}samples/example.play`);
        write(`${prefix}X.Specs/Cases/fixture.play`);
        accept('.');
        const { status, report } = run();
        assert.equal(status, 0);
        assert.equal(report.modelRoot, root);
        assert.equal(report.filesExamined, 5);
        assert.equal(report.modelFilesExamined, 2);
        assert.deepEqual(report.committed, [`${prefix}one/model.play`, `${prefix}two/model.play`]);
    });
}

for (const root of ['Source', '.']) {
    test(`a deliberately configured root ${root} includes even fixture and example models`, t => {
        const { write, accept, run } = fixture(t);
        write('.cratis/ai.json', JSON.stringify({ mcpServers: { screenplay: { root } } }));
        write('Source/X.Specs/Cases/fixture.play');
        write('Source/examples/example.play');
        accept('Source');
        const { status, report } = run();
        assert.equal(status, 0);
        assert.equal(report.modelRoot, root);
        assert.equal(report.modelFilesExamined, 2);
        assert.equal(report.committed.length, 2);
    });
}

for (const optedIn of [false, true]) {
    test(`execution through a symlinked skills directory prints the ${optedIn ? 'opted-in' : 'not-opted-in'} verdict`, t => {
        const { repository, write, accept } = fixture(t);
        if (optedIn) {
            write('Source/model.play');
            accept('Source/model.play');
        }
        mkdirSync(join(repository, '.pi'));
        symlinkSync(resolve(dirname(script), '../..'), join(repository, '.pi/skills'), 'dir');
        const alias = join(repository, '.pi/skills/cratis-screenplay-modeling-lifecycle/scripts/model-first-status.mjs');
        const result = spawnSync(process.execPath, [alias, '--json'], { cwd: repository, encoding: 'utf8', timeout: 20000 });
        assert.equal(result.error, undefined);
        assert.equal(result.status, optedIn ? 0 : 1, result.stderr);
        assert.equal(JSON.parse(result.stdout).optedIn, optedIn);
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

const frozenConfig = (extra: object = {}, root?: string) => JSON.stringify({
    ...(root ? { mcpServers: { screenplay: { root } } } : {}),
    modelFirst: { frozen: true, reason: 'generated evidence while migrating', ...extra },
});

test('a frozen committed model is not opted in, keeps its files as evidence and has no contract', t => {
    const { write, accept, run } = fixture(t);
    write('Screenplay/model.play');
    write('.cratis/ai.json', frozenConfig());
    accept('.');
    const { status, report } = run();
    assert.equal(status, 1);
    assert.equal(report.optedIn, false);
    assert.equal(report.reason, 'frozen-model');
    assert.equal(report.frozen, true);
    assert.equal(report.frozenReason, 'generated evidence while migrating');
    assert.equal(report.contract, null);
    assert.deepEqual(report.committed, ['Screenplay/model.play']);
    assert.equal(report.modelRoot, 'Screenplay');
});

test('a frozen marker overrides a configured root', t => {
    const { write, accept, run } = fixture(t);
    write('Models/model.play');
    write('.cratis/ai.json', frozenConfig({}, 'Models'));
    accept('.');
    const { status, report } = run();
    assert.equal(status, 1);
    assert.equal(report.optedIn, false);
    assert.equal(report.reason, 'frozen-model');
    assert.equal(report.rootSource, 'configuration');
    assert.equal(report.contract, null);
    assert.deepEqual(report.committed, ['Models/model.play']);
});

test('a frozen marker without a reason reports a null reason', t => {
    const { write, run } = fixture(t);
    write('.cratis/ai.json', JSON.stringify({ modelFirst: { frozen: true } }));
    const { status, report } = run();
    assert.equal(status, 1);
    assert.equal(report.reason, 'frozen-model');
    assert.equal(report.frozenReason, null);
});

for (const frozen of ['false', 'absent', 'null']) {
    test(`frozen ${frozen} leaves the opt-in result unchanged`, t => {
        const { write, accept, run } = fixture(t);
        write('Screenplay/model.play');
        const modelFirst = frozen === 'false' ? { frozen: false } : frozen === 'null' ? { frozen: null } : { reason: 'unused' };
        write('.cratis/ai.json', JSON.stringify({ modelFirst }));
        accept('.');
        const { status, report } = run();
        assert.equal(status, 0);
        assert.equal(report.optedIn, true);
        assert.equal(report.reason, 'committed-model');
        assert.equal(report.contract, 'HEAD');
        assert.equal(report.frozen, false);
        assert.equal(report.frozenReason, null);
    });
}

for (const frozen of ['"yes"', '1', '{}', '[]']) {
    test(`a non-boolean frozen value ${frozen} fails with could-not-run`, t => {
        const { write, run } = fixture(t);
        write('.cratis/ai.json', `{"modelFirst":{"frozen":${frozen}}}`);
        const result = run();
        assert.equal(result.status, 2);
        assert.match(result.report.error, /modelFirst\.frozen must be a boolean/);
        assert.match(result.stderr, /could not run/);
    });
}

for (const config of ['{"modelFirst":true}', '{"modelFirst":{"frozen":true,"reason":3}}', '{"process":[]}',
    '{"process":{"decisions":{"path":""}}}', '{"process":{"decisions":{"path":"/abs"}}}', '{"process":{"decisions":{"path":"../out"}}}',
    '{"process":{"agents":{"screenplay-modeler":"one.md"}}}', '{"process":{"agents":{"screenplay-modeler":["../x.md"]}}}',
    '{"process":{"acceptance":{"meaning":""}}}']) {
    test(`a malformed seam value fails with could-not-run: ${config}`, t => {
        const { write, run } = fixture(t);
        write('.cratis/ai.json', config);
        const result = run();
        assert.equal(result.status, 2);
        assert.ok(result.report.error);
    });
}

test('the resolved process block holds the defaults when nothing is configured', t => {
    const { write, run } = fixture(t);
    const expected = {
        decisions: { path: 'decisions', id: null },
        workItems: { path: null },
        acceptance: { meaning: 'user', commit: 'user' },
        agents: {},
    };
    assert.deepEqual(run().report.process, expected);
    write('.cratis/ai.json', '{"process":{}}');
    assert.deepEqual(run().report.process, expected);
});

test('the resolved process block reports configured values and fills the rest with defaults', t => {
    const { write, run } = fixture(t);
    write('.cratis/ai.json', JSON.stringify({
        process: {
            decisions: { path: 'Planning/Decisions', id: 'D<n>' },
            workItems: { path: 'Planning/backlog' },
            acceptance: { meaning: 'product owner' },
            agents: { 'screenplay-modeler': ['Planning/ai/screenplay-modeler.addendum.md'] },
        },
    }));
    const { status, report } = run();
    assert.equal(status, 1);
    assert.equal(report.reason, 'no-accepted-model');
    assert.deepEqual(report.process, {
        decisions: { path: 'Planning/Decisions', id: 'D<n>' },
        workItems: { path: 'Planning/backlog' },
        acceptance: { meaning: 'product owner', commit: 'user' },
        agents: { 'screenplay-modeler': ['Planning/ai/screenplay-modeler.addendum.md'] },
    });
});

test('the text output names the frozen verdict', t => {
    const { repository, write } = fixture(t);
    write('.cratis/ai.json', frozenConfig());
    const result = spawnSync(process.execPath, [script], { cwd: repository, encoding: 'utf8', timeout: 20000 });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /Model first: not opted in \(frozen-model\)/);
});

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
    assert.match(result.stdout, /checked 23 fixtures\/verdicts; passed/);
});
