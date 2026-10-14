// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
export function selfTest(modelFirstStatus) {
    const temporary = mkdtempSync(join(tmpdir(), 'model-first-self-test-'));
    let cases = 0;
    const write = (path, content) => {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, content);
    };
    const git = (repository, args) => {
        const result = spawnSync('git', ['-c', 'user.name=Model first self-test', '-c', 'user.email=specs@example.invalid',
            '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: repository, encoding: 'utf8', timeout: 10000 });
        assert.equal(result.status, 0, result.stderr || result.error?.message);
    };
    const repo = name => {
        const repository = join(temporary, name);
        mkdirSync(repository);
        git(repository, ['init', '--quiet']);
        return repository;
    };
    const check = (repository, expected, root = 'Screenplay') => {
        const report = modelFirstStatus(repository, root);
        assert.equal(report.optedIn, expected);
        cases++;
        return report;
    };
    try {
        const drafts = repo('drafts');
        check(drafts, false);
        write(join(drafts, 'Screenplay/model.play'), 'module Test\n');
        assert.equal(check(drafts, false).drafts.untracked.length, 1);
        git(drafts, ['add', 'Screenplay/model.play']);
        assert.equal(check(drafts, false).drafts.staged.length, 1);
        git(drafts, ['commit', '--quiet', '-m', 'Accept model']);
        assert.equal(check(drafts, true).contract, 'HEAD');
        write(join(drafts, 'Screenplay/model.play'), 'module Changed\n');
        assert.equal(check(drafts, true).modelChangesInProgress.length, 1);
        const configured = repo('configured');
        write(join(configured, '.cratis/ai.json'), JSON.stringify({ mcpServers: { screenplay: { root: 'Models' } } }));
        check(configured, true, 'Models');
        write(join(configured, 'Models/model.play'), 'module Test\n');
        assert.equal(check(configured, true, 'Models').committed.length, 0);
        const outside = repo('outside');
        write(join(outside, 'docs/example.play'), 'module Example\n');
        git(outside, ['add', '.']);
        git(outside, ['commit', '--quiet', '-m', 'Add example']);
        check(outside, false);
        assert.throws(() => modelFirstStatus(temporary), /git rev-parse/);
        cases++;
        write(join(configured, '.cratis/ai.json'), '{');
        assert.throws(() => modelFirstStatus(configured));
        cases++;
        console.log(`model-first-status self-test: checked ${cases} fixtures/verdicts; passed`);
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
}
