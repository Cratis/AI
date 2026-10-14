// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { evaluationCoverageFindings } from './evaluation-coverage.ts';

function workspace(context: TestContext): string {
    const root = mkdtempSync(join(tmpdir(), 'cratis-evaluation-coverage-'));
    context.after(() => rmSync(root, { recursive: true, force: true }));
    return root;
}

function baseline(root: string, overrides: NodeJS.ProcessEnv = {}) {
    return spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
        import { evaluationCoverageBaseline } from ${JSON.stringify(new URL('./evaluation-coverage.ts', import.meta.url).href)};
        console.log(JSON.stringify(evaluationCoverageBaseline(${JSON.stringify(root)}) ?? null));
    `], {
        cwd: import.meta.dirname, encoding: 'utf8',
        env: { ...process.env, CI: '', GITHUB_ACTIONS: '', GITHUB_EVENT_PATH: '', GITHUB_EVENT_NAME: '', ...overrides },
    });
}

function git(root: string, ...args: string[]): string {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function initialize(root: string): void {
    git(root, 'init');
    git(root, '-c', 'user.name=Spec', '-c', 'user.email=spec@example.com', 'commit', '--allow-empty', '-m', 'Initial base');
}

test('a copy without Git skips the base while static evaluation coverage passes', context => {
    const result = baseline(workspace(context));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout), null);
    assert.deepEqual(evaluationCoverageFindings(['existing', 'covered'], ['covered'], { existing: 'Existing uncovered skill.' }, undefined), []);
});

test('a checkout without origin/main also skips the base outside CI', context => {
    const root = workspace(context);
    initialize(root);
    const result = baseline(root);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout), null);
});

test('CI without a resolvable base fails for both copies and checkouts', context => {
    for (const checkout of [false, true]) {
        const root = workspace(context);
        if (checkout) initialize(root);
        for (const marker of [{ GITHUB_ACTIONS: 'true' }, { CI: 'true' }]) {
            const result = baseline(root, marker);
            assert.notEqual(result.status, 0);
            assert.match(result.stderr, /Evaluation coverage base could not resolve in CI/);
        }
    }
});

test('a normal Git base keeps the exemption ratchet independent of working-copy edits', context => {
    const root = workspace(context);
    initialize(root);
    mkdirSync(join(root, 'Evaluations'));
    const exemptions = { existing: 'Existing uncovered skill.' };
    writeFileSync(join(root, 'Evaluations', 'unevaluated.json'), JSON.stringify(exemptions));
    git(root, 'add', 'Evaluations/unevaluated.json');
    git(root, '-c', 'user.name=Spec', '-c', 'user.email=spec@example.com', 'commit', '-m', 'Add exemptions');
    git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    const expanded = { ...exemptions, added: 'New exemption.' };
    writeFileSync(join(root, 'Evaluations', 'unevaluated.json'), JSON.stringify(expanded));
    for (const env of [{}, { GITHUB_ACTIONS: 'true' }]) {
        const result = baseline(root, env);
        assert.equal(result.status, 0, result.stderr);
        const base = JSON.parse(result.stdout);
        assert.deepEqual(base, exemptions);
        assert.deepEqual(evaluationCoverageFindings(['existing'], [], exemptions, base), []);
        assert.ok(evaluationCoverageFindings(['existing', 'added'], [], expanded, base).some(finding => finding.matchedText.includes('new exemption')));
    }
});

test('a resolved base with malformed exemptions is a failure, not a skipped comparison', context => {
    const root = workspace(context);
    initialize(root);
    mkdirSync(join(root, 'Evaluations'));
    writeFileSync(join(root, 'Evaluations', 'unevaluated.json'), '{invalid');
    git(root, 'add', 'Evaluations/unevaluated.json');
    git(root, '-c', 'user.name=Spec', '-c', 'user.email=spec@example.com', 'commit', '-m', 'Malformed baseline');
    git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    const result = baseline(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SyntaxError/);
});
