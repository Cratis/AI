// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const reference = join(repositoryRoot, '.cratis/ai/skills/cratis-screenplay-modeling-lifecycle/references/verdicts-and-modes.md');
const fence = readFileSync(reference, 'utf8').match(/```shell\n(#!\/usr\/bin\/env bash\n[\s\S]*?)\n```/);
assert.ok(fence, 'the source-identity helper shell fence must exist');
const helper = fence[1];
const bashAvailable = spawnSync('bash', ['--version'], { timeout: 5000 }).status === 0;
const options = { skip: bashAvailable ? false : 'bash is unavailable' };

function fixture(t: TestContext) {
    const directory = mkdtempSync(join(tmpdir(), 'cratis-source-identity-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const repo = join(directory, 'repo');
    mkdirSync(repo);
    for (const args of [
        ['init', '--quiet'],
        ['-c', 'user.name=Source identity specs', '-c', 'user.email=specs@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '--allow-empty', '-m', 'Seed source identity'],
    ]) {
        const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8', timeout: 5000 });
        assert.equal(result.status, 0, result.stderr);
    }
    for (const path of ['root', 'sub', 'real/child', '.github/workflows', '.cratis/ai/skills', '.cratis/ai/workflows']) {
        mkdirSync(join(repo, path), { recursive: true });
    }
    writeFileSync(join(repo, 'root/input.txt'), 'original input\n');
    writeFileSync(join(repo, '.github/workflows/logical.yml'), 'logical input\n');
    writeFileSync(join(repo, '.cratis/ai/workflows/physical.yml'), 'physical input\n');
    mkdirSync(join(directory, 'x'));
    writeFileSync(join(directory, 'x/outside.txt'), 'outside input\n');
    symlinkSync('real/child', join(repo, 'link'), 'dir');
    symlinkSync('../.cratis/ai/skills', join(repo, '.github/skills'), 'dir');
    const run = (args: string[]) => spawnSync('bash', ['-c', helper, 'ident.sh', ...args], {
        cwd: repo, encoding: 'utf8', timeout: 5000,
    });
    return { repo, run };
}

for (const input of ['link/', 'link//', '..', '../x', 'sub/../..', 'link/..']) {
    test(`source-identity helper rejects ${input} without a digest`, options, t => {
        const { run } = fixture(t);
        const result = run([input]);
        assert.equal(result.error, undefined);
        assert.equal(result.status, 1, result.stderr);
        assert.equal(result.stdout, '');
        assert.match(result.stderr, /ident: /);
    });
}

test('source-identity helper rejects a symlinked parent before .. even when both destinations exist', options, t => {
    const { run } = fixture(t);
    const result = run(['.github/skills/../workflows']);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /ident: symlink component:/);
});

for (const args of [[], ['']]) {
    test(`source-identity helper rejects ${args.length ? 'an empty argument' : 'no argument'}`, options, t => {
        const { run } = fixture(t);
        const result = run(args);
        assert.equal(result.error, undefined);
        assert.equal(result.status, 1, result.stderr);
        assert.equal(result.stdout, '');
        assert.match(result.stderr, /ident: (usage:|empty input)/);
    });
}

test('source-identity helper gives equal digests for root, root/ and ./root', options, t => {
    const { run } = fixture(t);
    const identities = ['root', 'root/', './root'].map(input => {
        const result = run([input]);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /^[a-f0-9]{40}\+[a-f0-9]{12}\n$/);
        return result.stdout;
    });
    assert.equal(identities[0], identities[1]);
    assert.equal(identities[0], identities[2]);
});

test('source-identity helper changes the digest when a file changes without a new commit', options, t => {
    const { repo, run } = fixture(t);
    const before = run(['root']);
    assert.equal(before.status, 0, before.stderr);
    writeFileSync(join(repo, 'root/input.txt'), 'changed input\n');
    const after = run(['root']);
    assert.equal(after.status, 0, after.stderr);
    assert.match(after.stdout, /^[a-f0-9]{40}\+[a-f0-9]{12}\n$/);
    assert.equal(before.stdout.split('+')[0], after.stdout.split('+')[0]);
    assert.notEqual(before.stdout, after.stdout);
});

for (const [label, name] of [['a tab', 'a.cs\tdeadbeef'], ['a newline', 'a.cs\nb.play']] as const) {
    test(`source-identity helper fails closed on a filename containing ${label}`, options, t => {
        const { repo, run } = fixture(t);
        try {
            writeFileSync(join(repo, 'root', name), 'hidden input\n');
        } catch {
            t.skip('the platform does not allow this filename');
            return;
        }
        const result = run(['root']);
        assert.equal(result.error, undefined);
        assert.equal(result.status, 1, result.stderr);
        assert.equal(result.stdout, '');
        assert.match(result.stderr, /ident: filename contains a newline or tab/);
    });
}
