// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { catalogFrom, fixtureProblems, fixtureVocabulary, verifyConformanceFixtures } from './conformance-fixtures.ts';

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
test('wrong-typed values are rejected, not coerced to empty', () => {
    for (const bounds of [null, 42, [], 'bad']) assert.match(problems(fixture({ bounds })).join('\n'), /bounds must be an object/);
    for (const check of [null, 42, [], 'bad']) assert.match(problems(fixture({ checks: [check] })).join('\n'), /checks\[0\] must be an object/);
    for (const root of [null, 42, [], 'bad']) assert.match(problems(root).join('\n'), /fixture must be a JSON object/);
    for (const key of ['profiles', 'languages', 'harnesses', 'expected_instruction_paths', 'expected_output', 'description', 'prompt']) assert.ok(problems(fixture({ [key]: null })).length > 0, key);
    assert.ok(problems(fixture({ checks: null })).length > 0);
    assert.ok(problems(fixture({ checks: [{ type: 'file_exists', path: null }] })).length > 0);
    assert.ok(problems(fixture({ checks: [{ type: 'file_exists', path: 'a', optional: null }] })).length > 0);
    assert.ok(problems(fixture({ bounds: { max_turns: null } })).length > 0);
});

const fixturesRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'Evaluations', 'conformance');
async function patterns(folder: string, type: string): Promise<RegExp[]> {
    const document = JSON.parse(await readFile(join(fixturesRoot, folder, 'fixture.json'), 'utf8')) as { checks: { type: string; pattern?: string }[] };
    return document.checks.filter(check => check.type === type).map(check => new RegExp(check.pattern as string));
}
const matchesAll = (list: RegExp[], content: string) => list.every(pattern => pattern.test(content));
const schema = JSON.parse(await readFile(join(fixturesRoot, 'fixture.schema.json'), 'utf8'));

test('the verifier vocabulary matches the schema enums and field names', () => {
    assert.deepEqual(fixtureVocabulary, {
        harnesses: schema.properties.harnesses.items.enum,
        checkTypes: schema.$defs.check.properties.type.enum,
        phases: schema.$defs.check.properties.phase.enum,
        fixtureKeys: Object.keys(schema.properties),
        checkKeys: Object.keys(schema.$defs.check.properties),
        boundKeys: Object.keys(schema.properties.bounds.properties)
    });
});

test('the schema defaults to result and refuses install commands and optional-only results', () => {
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.$defs.check.properties.phase.default, 'result');
    assert.deepEqual(schema.$defs.check.if, { properties: { type: { const: 'command' } }, required: ['type'] });
    assert.deepEqual(schema.$defs.check.then, { properties: { phase: { const: 'result' } } });
    assert.deepEqual(schema.properties.checks.contains, {
        type: 'object', properties: { phase: { const: 'result' }, optional: { not: { const: true } } }
    });
    assert.deepEqual(schema.properties.checks.items, { $ref: '#/$defs/check' });
    for (const phase of [undefined, 'result']) {
        for (const optional of [undefined, false]) assert.deepEqual(problems(fixture({ checks: [{ type: 'command', run: ['true'], phase, optional }] })), []);
    }
});

test('every check type has a closed schema shape with its required fields', () => {
    const expected = fixtureVocabulary.checkTypes.map(type => {
        const command = type === 'command';
        const matches = type === 'file_matches' || type === 'file_not_matches';
        const fields = ['phase', ...(command ? ['run', 'exit_code'] : ['path', 'glob', ...(matches ? ['pattern'] : [])]), 'optional'];
        return {
            additionalProperties: false,
            required: ['type', ...(command ? ['run'] : matches ? ['pattern'] : [])],
            properties: { type: { const: type }, ...Object.fromEntries(fields.map(field => [field, { $ref: `#/$defs/check/properties/${field}` }])) },
            ...(!command ? { oneOf: [{ required: ['path'] }, { required: ['glob'] }] } : {})
        };
    });
    assert.deepEqual(schema.$defs.check.oneOf, expected);
});

test('the verifier accepts exactly the keys each check type allows in the schema', () => {
    const samples: Record<string, unknown> = { phase: 'result', run: ['true'], exit_code: 0, path: 'a', glob: '*.txt', pattern: 'x', optional: false };
    for (const shape of schema.$defs.check.oneOf as { properties: Record<string, unknown> }[]) {
        const type = (shape.properties.type as { const: string }).const;
        const allowed = new Set(Object.keys(shape.properties));
        const base = type === 'command' ? { type, run: ['true'] } : { type, path: 'a', ...(type.includes('matches') ? { pattern: 'x' } : {}) };
        for (const key of fixtureVocabulary.checkKeys.filter(key => key !== 'type')) {
            const check = key === 'glob' ? { ...base, path: undefined, glob: '*.txt' } : { ...base, [key]: samples[key] };
            const result = problems(fixture({ checks: [check] }));
            if (allowed.has(key)) assert.deepEqual(result, [], `${type} should accept ${key}`);
            else assert.ok(result.length > 0, `${type} should reject ${key}`);
        }
    }
});

test('the verifier enforces the per-type required fields and exclusive path or glob', () => {
    for (const type of fixtureVocabulary.checkTypes) {
        assert.ok(problems(fixture({ checks: [{ type }] })).length > 0, type);
        if (type === 'command') continue;
        const pattern = type.includes('matches') ? { pattern: 'x' } : {};
        assert.deepEqual(problems(fixture({ checks: [{ type, path: 'a', ...pattern }] })), []);
        assert.deepEqual(problems(fixture({ checks: [{ type, glob: '*.txt', ...pattern }] })), []);
        assert.ok(problems(fixture({ checks: [{ type, path: 'a', glob: '*.txt', ...pattern }] })).length > 0);
    }
});

test('schema property types match the values the verifier accepts and rejects', () => {
    const groups = [
        [schema.properties, { name: 'string', description: 'string', prompt: 'string', expected_output: 'string', profiles: 'array', languages: 'array', harnesses: 'array', expected_instruction_paths: 'array', checks: 'array', bounds: 'object' }],
        [schema.$defs.check.properties, { path: 'string', glob: 'string', pattern: 'string', run: 'array', exit_code: 'integer', optional: 'boolean' }],
        [schema.properties.bounds.properties, { timeout_seconds: 'integer', max_budget_usd: 'number', max_turns: 'integer' }]
    ] as const;
    for (const [properties, types] of groups) {
        for (const [key, type] of Object.entries(types)) assert.equal(properties[key].type, type, key);
    }
    for (const key of fixtureVocabulary.fixtureKeys) assert.ok(problems(fixture({ [key]: 42 })).length > 0, key);
    for (const key of ['path', 'glob', 'pattern', 'run', 'exit_code', 'optional', 'phase', 'type']) {
        assert.ok(problems(fixture({ checks: [{ type: 'command', run: ['true'], [key]: null }] })).length > 0, key);
    }
    for (const key of fixtureVocabulary.boundKeys) assert.ok(problems(fixture({ bounds: { [key]: '1' } })).length > 0, key);
});

test('both existing fixtures satisfy the schema check shapes and result requirement', async () => {
    for (const folder of ['csharp-concepts-over-primitives', 'typescript-slice-excludes-csharp']) {
        const document = JSON.parse(await readFile(join(fixturesRoot, folder, 'fixture.json'), 'utf8'));
        assert.ok(document.checks.length > 0);
        assert.ok(document.checks.some((check: { phase?: string; optional?: boolean }) => (check.phase ?? 'result') === 'result' && check.optional !== true));
        for (const check of document.checks) {
            const shape = schema.$defs.check.oneOf.find((candidate: { properties: { type: { const: string } } }) => candidate.properties.type.const === check.type);
            assert.ok(shape, check.type);
            for (const key of shape.required) assert.ok(Object.hasOwn(check, key), key);
            for (const key of Object.keys(check)) assert.ok(Object.hasOwn(shape.properties, key), key);
            if (check.type === 'command') assert.notEqual(check.phase, 'install');
            else assert.notEqual(Object.hasOwn(check, 'path'), Object.hasOwn(check, 'glob'));
        }
    }
});

test('C# concept fixture patterns reject a comment-only change and accept the real change', async () => {
    const wanted = await patterns('csharp-concepts-over-primitives', 'file_matches');
    const unwanted = await patterns('csharp-concepts-over-primitives', 'file_not_matches');
    assert.equal(wanted.length, 2);
    const original = await readFile(join(fixturesRoot, 'csharp-concepts-over-primitives', 'input', 'Source', 'Authors', 'Registration.cs'), 'utf8');
    assert.equal(wanted.some(pattern => pattern.test(original)), false);
    const commentOnly = original + '\n// public record AuthorName(string Value) : ConceptAs<string>(Value);\n// RegisterAuthor(AuthorName name)\n/* class AuthorName : ConceptAs<string> */\n';
    assert.equal(wanted.some(pattern => pattern.test(commentOnly)), false);
    const real = 'public sealed record AuthorName(string Value) : ConceptAs<string>(Value);\n[Command]\npublic record RegisterAuthor(AuthorName Name)\n{ }\n';
    assert.equal(matchesAll(wanted, real), true);
    assert.equal(unwanted.some(pattern => pattern.test(real)), false);
    assert.equal(unwanted.some(pattern => pattern.test('public record RegisterAuthor(string AuthorName);')), true);
});

test('TypeScript fixture patterns reject a comment-only change and accept the real change', async () => {
    const wanted = await patterns('typescript-slice-excludes-csharp', 'file_matches');
    assert.equal(wanted.length, 2);
    const original = await readFile(join(fixturesRoot, 'typescript-slice-excludes-csharp', 'input', 'src', 'greeting.ts'), 'utf8');
    assert.equal(wanted.some(pattern => pattern.test(original)), false);
    const commentOnly = original + "\n// function greet(name: string, punctuation = '!') { return `${name}${punctuation}`; }\n// punctuation\n";
    assert.equal(wanted.some(pattern => pattern.test(commentOnly)), false);
    const real = "export function greet(name: string, punctuation: string = '!'): string {\n    return `Hello, ${name}${punctuation}`;\n}\n";
    assert.equal(matchesAll(wanted, real), true);
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
