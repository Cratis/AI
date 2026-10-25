// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { catalogFrom, fixtureProblems, verifyConformanceFixtures } from './conformance-fixtures.ts';

const catalog = { profiles: ['cratis/application/csharp'], languages: ['csharp'] };
const name = 'sample-fixture';
function fixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { name, description: 'd', prompt: 'p', profiles: ['cratis/application/csharp'], languages: ['csharp'], checks: [{ type: 'file_exists', path: 'a.txt' }], ...overrides };
}
const problems = (value: unknown) => fixtureProblems('f.json', name, value, catalog);

test('a valid fixture passes', () => {
    assert.deepEqual(problems(fixture({ harnesses: ['pi'], bounds: { timeout_seconds: 60, max_budget_usd: 1.5, max_turns: 5 }, checks: [{ type: 'file_absent', phase: 'install', path: 'x' }, { type: 'command', run: ['true'], exit_code: 0 }] })), []);
});
test('an unknown key is rejected', () => {
    assert.match(problems(fixture({ extra: 1 })).join('\n'), /unknown key 'extra'/);
    assert.match(problems(fixture({ checks: [{ type: 'file_exists', path: 'a', extra: 1 }] })).join('\n'), /unknown key 'extra'/);
});
test('a command in the install phase is refused', () => {
    const result = problems(fixture({ checks: [{ type: 'command', phase: 'install', run: ['true'] }, { type: 'file_exists', path: 'a' }] }));
    assert.match(result.join('\n'), /not allowed in the install phase/);
});
test('a glob or path with .. or an absolute path is refused', () => {
    assert.match(problems(fixture({ checks: [{ type: 'file_exists', glob: '../x/**' }] })).join('\n'), /no '\.\.'/);
    assert.match(problems(fixture({ checks: [{ type: 'file_exists', path: '/etc/passwd' }] })).join('\n'), /relative/);
});
test('a fixture without a non-optional result check is refused', () => {
    assert.match(problems(fixture({ checks: [{ type: 'file_exists', phase: 'install', path: 'a' }, { type: 'file_exists', path: 'b', optional: true }] })).join('\n'), /non-optional result-phase/);
});
test('an unknown profile or language is refused', () => {
    assert.match(problems(fixture({ profiles: ['cratis/nope'] })).join('\n'), /profile 'cratis\/nope'|profiles 'cratis\/nope'/);
    assert.match(problems(fixture({ languages: ['cobol'] })).join('\n'), /languages 'cobol'/);
});
test('a name that differs from the folder is refused', () => {
    assert.match(problems(fixture({ name: 'other-name' })).join('\n'), /name must match folder/);
});
test('pattern is required for match checks only', () => {
    assert.match(problems(fixture({ checks: [{ type: 'file_matches', path: 'a' }] })).join('\n'), /pattern is required/);
    assert.match(problems(fixture({ checks: [{ type: 'file_exists', path: 'a', pattern: 'x' }] })).join('\n'), /pattern applies only/);
});
test('the real fixtures validate against the real catalog', async () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const result = await verifyConformanceFixtures(root);
    assert.deepEqual(result.problems, []);
    assert.ok(result.fixtures >= 2);
});
test('a missing fixture population is a defect', async () => {
    const root = await mkdtemp(join(tmpdir(), 'conformance-'));
    try {
        await mkdir(join(root, '.cratis', 'ai'), { recursive: true });
        await mkdir(join(root, 'Evaluations', 'conformance'), { recursive: true });
        await writeFile(join(root, '.cratis', 'ai', 'profile-catalog.json'), JSON.stringify({ publicProfiles: [{ id: 'a', languages: ['csharp'] }] }));
        await writeFile(join(root, 'Evaluations', 'conformance', 'fixture.schema.json'), '{}');
        assert.match((await verifyConformanceFixtures(root)).problems.join('\n'), /at least one fixture/);
        assert.deepEqual(catalogFrom({ publicProfiles: [{ id: 'a', languages: ['csharp'] }] }), { profiles: ['a'], languages: ['csharp'] });
    } finally { await rm(root, { recursive: true, force: true }); }
});
