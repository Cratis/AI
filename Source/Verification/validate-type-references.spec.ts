// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';

const source = resolve(import.meta.dirname, '../../.cratis/ai/hooks/scripts/validate-type-references.sh');
const pins = '<Project><ItemGroup><PackageVersion Include="Cratis.Fixture" Version="1.2.3" /></ItemGroup></Project>';

function fixture(context: TestContext) {
    const outside = mkdtempSync(join(tmpdir(), 'cratis-type-references-'));
    context.after(() => rmSync(outside, { recursive: true, force: true }));
    const root = join(outside, 'repository');
    const scripts = join(root, '.cratis/ai/hooks/scripts');
    const rules = join(root, '.cratis/ai/rules');
    const cache = join(outside, 'nuget');
    const lib = join(cache, 'cratis.fixture/1.2.3/lib/net8.0');
    mkdirSync(scripts, { recursive: true });
    mkdirSync(rules, { recursive: true });
    mkdirSync(lib, { recursive: true });
    const script = join(scripts, 'validate-type-references.sh');
    copyFileSync(source, script);
    writeFileSync(join(root, 'Directory.Packages.props'), pins);
    writeFileSync(join(lib, 'Cratis.Fixture.xml'), '<doc><members><member name="T:Cratis.ReactorSideEffectFailure" /></members></doc>');
    writeFileSync(join(rules, 'example.md'), 'Use `ReactorSideEffectFailure`.\nReturn `ReactorSideEffect`.\n');
    const run = (path = script) => spawnSync('bash', [relative(outside, path)], {
        cwd: outside,
        encoding: 'utf8',
        env: { ...process.env, NUGET_PACKAGES: cache, CRATIS_HOOKS_TYPE_REPORT: '1' },
    });
    return { outside, root, scripts, rules, script, run };
}

function assertScanned(result: ReturnType<typeof spawnSync>) {
    assert.equal(result.status, 0, String(result.stderr));
    assert.match(String(result.stderr), /ReactorSideEffectFailure — type in the pinned Cratis packages/);
    assert.match(String(result.stderr), /ai-corpus warn: .*example\.md:2: 'ReactorSideEffect' is not a type/);
    assert.doesNotMatch(String(result.stderr), /could not run/);
}

test('installed hooks read the repository package pins from outside the repository cwd', context => {
    const { scripts, run } = fixture(context);
    // A stale sibling pin list must not override the consumer's central package versions.
    writeFileSync(join(scripts, 'cratis-nuget-pins.txt'), 'Cratis.Fixture 9.9.9\n');
    assertScanned(run());
});

test('authored hooks can use their sibling corpus pins from outside the repository cwd', context => {
    const { root, scripts, run } = fixture(context);
    rmSync(join(root, 'Directory.Packages.props'));
    writeFileSync(join(scripts, 'cratis-nuget-pins.txt'), 'Cratis.Fixture 1.2.3\n');
    assertScanned(run());
});

test('missing pin inputs fail explicitly instead of using an unrelated ancestor repository', context => {
    const { outside, root, run } = fixture(context);
    rmSync(join(root, 'Directory.Packages.props'));
    writeFileSync(join(outside, 'Directory.Packages.props'), pins);
    const result = run();
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /could not run: neither Directory\.Packages\.props nor the corpus pin list .* exists/);
});

test('hooks outside the supported layout fail even when the caller has valid package pins', context => {
    const { outside, script, run } = fixture(context);
    const misplaced = join(outside, 'validate-type-references.sh');
    copyFileSync(script, misplaced);
    writeFileSync(join(outside, 'Directory.Packages.props'), pins);
    const result = run(misplaced);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /could not run: the hook must live under <repo>\/\.cratis\/ai\/hooks\/scripts/);
});

test('an empty markdown input fails explicitly rather than reporting a successful scan', context => {
    const { rules, run } = fixture(context);
    rmSync(join(rules, 'example.md'));
    const result = run();
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /could not run: no markdown files under the scan roots/);
});
