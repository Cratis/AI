// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { loadProductSync, productSyncProblems, productSyncSummary, type ProductLedger, type ProductSources } from './product-sync.ts';
import { productSyncSelfTest } from './product-sync-self-test.ts';

const exampleLedger = (): ProductLedger => ({ schemaVersion: '1.0.0', products: [{ id: 'arc', name: 'Arc', repository: 'Cratis/Arc', packages: [{ ecosystem: 'nuget', id: 'Cratis.Arc.Core' }], synced: { version: '22.10.4', date: '2026-10-10', by: 'Cratis/AI#619' }, covers: { skills: ['cratis-arc-command'], rules: ['csharp.md'] } }] });
const sources: ProductSources = { skills: ['cratis-arc-command'], rules: ['csharp.md'], verifiedSkills: ['cratis-arc-command'] };
const check = (document: unknown) => productSyncProblems(document, sources, '2026-10-12');

test('the self-test detects every planted violation', () => assert.equal(productSyncSelfTest(), 17));

test('a valid ledger prints nonzero product and reference counts', () => {
    const report = check(exampleLedger());
    assert.deepEqual(report.problems, []);
    assert.match(productSyncSummary(report), /1 products, 1 covered skills, 1 covered rules, 1 verified-source skills, 0 problems/);
});
test('invalid schema shapes and zero products fail', () => {
    for (const document of [null, [], {}, { schemaVersion: '2.0.0', products: [] }, { schemaVersion: '1.0.0', products: [null] }, { schemaVersion: '1.0.0', products: [] }]) assert.ok(check(document).problems.length > 0);
});
test('all product fields are validated rather than trusting a TypeScript cast', () => {
    const cases: Array<[string, unknown, RegExp]> = [
        ['id', 'Arc', /kebab-case/], ['name', '', /invalid name/], ['repository', 'other/Arc', /Cratis repository/],
        ['coverage', 'ignored', /invalid coverage/], ['coverage', null, /invalid coverage/],
        ['visibility', 'public', /invalid visibility/], ['visibility', null, /invalid visibility/],
        ['track', 'stable', /invalid track/], ['track', null, /invalid track/],
        ['packages', [{ ecosystem: 'unknown', id: 'package' }], /invalid packages/], ['packages', [{ ecosystem: 'npm', id: '' }], /invalid packages/],
        ['covers', { skills: null, rules: [] }, /invalid covers/], ['synced', {}, /invalid synced shape/], ['notes', 123, /invalid name or notes/],
    ];
    for (const [field, value, message] of cases) {
        const ledger = exampleLedger();
        Object.assign(ledger.products[0], { [field]: value });
        assert.match(check(ledger).problems.join('\n'), message);
    }
});
test('private visibility and pre-release tracking are accepted optional fields', () => {
    const ledger = exampleLedger();
    Object.assign(ledger.products[0], { visibility: 'private', track: 'prerelease' });
    assert.deepEqual(check(ledger).problems, []);
});
test('duplicate ids and case-insensitive repositories fail', () => {
    const ledger = exampleLedger();
    ledger.products.push({ ...ledger.products[0], repository: 'Cratis/arc' });
    assert.match(check(ledger).problems.join('\n'), /duplicates id/);
    assert.match(check(ledger).problems.join('\n'), /duplicates repository/);
});
test('missing and escaping coverage targets fail', () => {
    const ledger = exampleLedger();
    ledger.products[0].covers = { skills: ['missing', '../cratis-arc-command'], rules: ['missing.md', '../csharp.md'] };
    const problems = check(ledger).problems;
    assert.equal(problems.filter(problem => problem.includes('covers missing')).length, 4);
    assert.match(problems.join('\n'), /not covered by any product/);
});
test('each verified-source skill must be covered, even if other skills are valid', () => {
    const report = productSyncProblems(exampleLedger(), { ...sources, verifiedSkills: [...sources.verifiedSkills, 'new-skill'] }, '2026-10-12');
    assert.match(report.problems.join('\n'), /new-skill.*not covered/);
});
test('dates must be real UTC dates and not in the future', () => {
    for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-10-13', '2026-1-1']) {
        const ledger = exampleLedger();
        ledger.products[0].synced!.date = date;
        assert.match(check(ledger).problems.join('\n'), /non-future synced date/);
    }
    const ledger = exampleLedger();
    ledger.products[0].synced!.date = '2024-02-29';
    assert.deepEqual(check(ledger).problems, []);
});
test('release versions omit v and allow main commit floors, but not ranges or placeholders', () => {
    for (const version of ['v1.2.3', '1.2.x', '1.2', '', '01.2.3', 'main@abcdef', 'main@zzzzzzz']) {
        const ledger = exampleLedger();
        ledger.products[0].synced!.version = version;
        assert.match(check(ledger).problems.join('\n'), /invalid synced version/);
    }
    for (const version of ['1.2.3', '1.2.3-preview.1', '1.2.3+build.1', 'main@abcdef1']) {
        const ledger = exampleLedger();
        ledger.products[0].synced!.version = version;
        assert.deepEqual(check(ledger).problems, []);
    }
});
test('tracked products with empty coverage require a planned-coverage note and null sync', () => {
    const ledger = exampleLedger();
    const planned = { id: 'stage', name: 'Stage', repository: 'Cratis/Stage', packages: [], synced: null, covers: { skills: [], rules: [] }, notes: 'Coverage is planned in another branch.' };
    ledger.products.push(planned);
    assert.deepEqual(check(ledger).problems, []);
    Object.assign(planned, { coverage: 'tracked' });
    assert.deepEqual(check(ledger).problems, []);
    for (const notes of [undefined, '', 'Coverage is not planned.', 'No covering skill states a version.']) {
        Object.assign(planned, { notes });
        assert.match(check(ledger).problems.join('\n'), /tracked with empty covers/);
    }
    Object.assign(planned, { notes: 'Coverage is planned.', synced: ledger.products[0].synced });
    assert.match(check(ledger).problems.join('\n'), /tracked with empty covers/);
});
test('not-covered products require a reason, empty covers and null sync', () => {
    const ledger = exampleLedger();
    const excluded: ProductLedger['products'][number] = { id: 'direct', name: 'Direct', repository: 'Cratis/Direct', packages: [], coverage: 'not-covered', synced: null, covers: { skills: [], rules: [] }, notes: 'Product-specific guidance is deliberately outside this corpus.' };
    ledger.products.push(excluded);
    assert.deepEqual(check(ledger).problems, []);
    for (const notes of [undefined, '', '   ']) {
        excluded.notes = notes;
        assert.match(check(ledger).problems.join('\n'), /not-covered requires a notes reason/);
    }
    excluded.notes = 'Excluded by decision.';
    excluded.covers.skills = ['cratis-arc-command'];
    assert.match(check(ledger).problems.join('\n'), /not-covered requires empty covers/);
    excluded.covers = { skills: [], rules: ['csharp.md'] };
    assert.match(check(ledger).problems.join('\n'), /not-covered requires empty covers/);
    excluded.covers.rules = [];
    excluded.synced = ledger.products[0].synced;
    assert.match(check(ledger).problems.join('\n'), /not-covered requires null synced/);
});
test('an excluded product cannot satisfy verified-source skill coverage', () => {
    const ledger = exampleLedger();
    ledger.products[0].coverage = 'not-covered';
    ledger.products[0].notes = 'Excluded by decision.';
    ledger.products[0].synced = null;
    assert.match(check(ledger).problems.join('\n'), /not covered by any product/);
});
test('sync provenance needs an issue or PR reference', () => {
    const ledger = exampleLedger();
    ledger.products[0].synced!.by = 'somebody';
    assert.match(check(ledger).problems.join('\n'), /issue\/PR reference/);
});
test('the actual ledger covers every verified-source skill and all targets exist', async () => {
    const { document, sources: actual } = await loadProductSync(resolve(import.meta.dirname, '../..'));
    const report = productSyncProblems(document, actual);
    assert.ok(report.products >= 38);
    assert.ok(report.verifiedSkills > 0);
    assert.deepEqual(report.problems, []);
    const products = (document as ProductLedger).products;
    assert.deepEqual(products.filter(product => product.coverage === 'not-covered').map(product => product.name).sort(), ['AI', 'Ante', 'Direct', 'Dockerfiles', 'Eventmodelers-Build-Kit-Java', 'Eventmodelers-Build-Kit-Kotlin', 'KeldaKraft', 'Prompter']);
    for (const name of ['Arc.Go', 'Chronicle.Go', 'Fundamentals.Go', 'Templates', 'AuthProxy', 'release-action', 'Synopsis', 'Narrator', 'Orleans', 'Scene', 'Screenplay.Generation', 'Screenplay.CritterStack', 'AI.Distribution', 'Architecture']) {
        const product = products.find(product => product.name === name)!;
        assert.equal(product.coverage, 'tracked');
        assert.match(product.synced?.by ?? '', /^Cratis\/AI#\d+$/);
        assert.ok(product.covers.skills.length + product.covers.rules.length > 0);
        assert.doesNotMatch(product.notes!, /Coverage is planned/);
    }
    assert.match(products.find(product => product.name === 'Architecture')!.notes!, /rules\/csharp.md/);
    assert.deepEqual(products.filter(product => product.visibility === 'private').map(product => product.name).sort(), ['Direct', 'KeldaKraft', 'Studio']);
    const arcTypescript = products.find(product => product.id === 'arc-typescript')!;
    assert.equal(arcTypescript.track, 'prerelease');
    assert.equal(arcTypescript.synced!.version, '0.57.2');
});
