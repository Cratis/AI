// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import test from 'node:test';
import { compareProduct, driftExitCode, driftReport, driftTable, reportProducts, type Release } from './product-drift.ts';
import { latestProduct, type Github } from './product-github.ts';
import type { Product } from './product-sync.ts';

const product: Product = { id: 'arc', name: 'Arc', repository: 'Cratis/Arc', packages: [], synced: { version: '1.0.0', date: '2026-10-10', by: 'Cratis/AI#619' }, covers: { skills: ['cratis-arc-command'], rules: [] } };
const release = (tag_name: string, prerelease = false): Release => ({ tag_name, prerelease, draft: false });

test('matching release tags are normalized and report zero drift with counts', () => {
    const report = driftReport([compareProduct(product, { version: 'v1.0.0' })]);
    assert.equal(driftExitCode(report), 0);
    assert.equal(report.rows[0].releasesBehind, 0);
    assert.match(driftTable(report), /Compared 1 products; 0 have drifted/);
});
test('a published release different from the synced floor reports drift', () => {
    const report = driftReport([compareProduct(product, { version: 'v2.0.0' })]);
    assert.equal(driftExitCode(report), 1);
    assert.equal(report.rows[0].releasesBehind, null);
});
test('release counts use actual non-prerelease endpoints, not semver subtraction', () => {
    const row = compareProduct(product, { version: 'v3.0.0', releases: [release('v3.0.0'), release('v2.5.0-preview', true), { ...release('v2.3.0'), draft: true }, release('v2.0.0'), release('v1.0.0')] });
    assert.equal(row.releasesBehind, 2);
});
test('a truncated page, missing latest or an ahead-of-latest floor never invents a count', () => {
    for (const releases of [[release('v2.0.0')], [release('v1.0.0')], [release('v1.0.0'), release('v2.0.0')]]) assert.equal(compareProduct(product, { version: 'v2.0.0', releases }).releasesBehind, null);
});
test('never synced is drift even when there are no published releases', () => {
    const row = compareProduct({ ...product, synced: null }, { version: 'main@abcdef1' });
    assert.equal(row.drift, true);
    assert.equal(row.releasesBehind, null);
});
test('unreleased products compare the recorded default-branch commit', () => {
    const main = { ...product, synced: { ...product.synced!, version: 'main@abcdef1' } };
    assert.equal(compareProduct(main, { version: 'main@abcdef1' }).drift, false);
    assert.equal(compareProduct(main, { version: 'main@abcdef2' }).drift, true);
});
test('zero products refuse rather than pass vacuously', () => assert.throws(() => driftReport([]), /Zero products/));
const excluded: Product = { ...product, id: 'direct', name: 'Direct', repository: 'Cratis/Direct', coverage: 'not-covered', synced: null, covers: { skills: [], rules: [] }, notes: 'Product-specific guidance is outside the corpus.' };
test('not-covered products are listed separately without release lookups or drift', () => {
    const lookedUp: string[] = [];
    const report = reportProducts([product, excluded], candidate => { lookedUp.push(candidate.id); return { version: '1.0.0' }; });
    assert.deepEqual(lookedUp, ['arc']);
    assert.equal(report.products, 1);
    assert.equal(report.drifted, 0);
    assert.equal(driftExitCode(report), 0);
    assert.equal(report.rows.length, 1);
    assert.deepEqual(report.notCovered, [{ id: excluded.id, product: excluded.name, repository: excluded.repository, reason: excluded.notes }]);
    assert.match(driftTable(report), /## Not covered \(by decision\)\n\n- Direct: Product-specific/);
    assert.ok(!driftTable(report).includes('| Direct |'));
    assert.throws(() => compareProduct(excluded, { version: '2.0.0' }), /must not be compared/);
});
test('an entirely excluded ledger is a decided zero-drift report, not an empty scan', () => {
    const report = reportProducts([excluded], () => { throw new Error('No release lookup allowed'); });
    assert.equal(report.products, 0);
    assert.equal(report.notCovered.length, 1);
    assert.equal(driftExitCode(report), 0);
    assert.throws(() => reportProducts([], () => ({ version: '1.0.0' })), /Zero products/);
});
test('planned empty coverage remains tracked and never-synced drift', () => {
    const report = reportProducts([{ ...product, coverage: 'tracked', synced: null, covers: { skills: [], rules: [] }, notes: 'Coverage is planned.' }], () => ({ version: '1.0.0' }));
    assert.equal(report.drifted, 1);
    assert.deepEqual(report.notCovered, []);
});
test('tracked lookup failures still fail even if other products are excluded', () => {
    assert.throws(() => reportProducts([excluded, product], () => { throw new Error('HTTP 503'); }), /503/);
});
test('the table escapes product and skill names', () => {
    const table = driftTable(driftReport([compareProduct({ ...product, name: 'Arc|other\nline' }, { version: '1.0.0' })]));
    assert.ok(table.includes('Arc\\|other line'));
});
test('latest release and one bounded page are read through gh', () => {
    const calls: string[][] = [];
    const gh: Github = args => { calls.push(args); return JSON.stringify(args[1].endsWith('/latest') ? release('v2.0.0') : [release('v2.0.0'), release('v1.0.0')]); };
    assert.equal(compareProduct(product, latestProduct(product, gh)).releasesBehind, 1);
    assert.deepEqual(calls.map(args => args[1]), ['repos/Cratis/Arc/releases/latest', 'repos/Cratis/Arc/releases?per_page=100']);
});
test('an exact release match needs no history request', () => {
    let calls = 0;
    latestProduct(product, () => { calls++; return JSON.stringify(release('v1.0.0')); });
    assert.equal(calls, 1);
});
test('404 means no releases only after repository access and its default branch are read', () => {
    const gh: Github = args => {
        if (args[1].endsWith('/latest')) throw new Error('gh: Not Found (HTTP 404)');
        if (args[1] === 'repos/Cratis/Arc') return JSON.stringify({ default_branch: 'main' });
        return JSON.stringify({ sha: `abcdef1${'a'.repeat(33)}` });
    };
    assert.equal(latestProduct(product, gh).version, 'main@abcdef1');
    assert.throws(() => latestProduct(product, () => { throw new Error('gh: Not Found (HTTP 404)'); }), /HTTP 404/);
});
test('missing gh, authentication and network failures cannot become up to date', () => {
    for (const message of ['spawn gh ENOENT', 'gh: Bad credentials (HTTP 401)', 'gh: Forbidden (HTTP 403)', 'network timed out']) assert.throws(() => latestProduct(product, () => { throw new Error(message); }), { message });
});
test('invalid, prerelease and draft latest responses are refused', () => {
    for (const response of ['not-json', '{}', JSON.stringify(release('v1.0.0-preview', true)), JSON.stringify({ ...release('v1.0.0'), draft: true }), JSON.stringify(release('wrong'))]) assert.throws(() => latestProduct(product, () => response));
});
test('history failures are not silently turned into an unknown successful report', () => {
    assert.throws(() => latestProduct(product, args => {
        if (args[1].endsWith('/latest')) return JSON.stringify(release('v2.0.0'));
        throw new Error('HTTP 503');
    }), /503/);
});
