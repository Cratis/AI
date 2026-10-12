// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import test from 'node:test';
import { compareProduct, driftReport } from './product-drift.ts';
import { reconcileProductDrift } from './product-drift-issue.ts';
import type { Github } from './product-github.ts';

const row = compareProduct({ id: 'arc', name: 'Arc', repository: 'Cratis/Arc', packages: [], synced: null, covers: { skills: ['cratis-arc-command'], rules: [] } }, { version: '1.0.0' });
function fixture(issues: Array<{ number: number; title: string }>, current = { title: 'AI corpus product drift', state: 'OPEN' }) {
    const calls: Array<{ args: string[]; input?: string }> = [];
    const gh: Github = (args, input) => {
        calls.push({ args, input });
        if (args[0] === 'issue' && args[1] === 'list') return JSON.stringify(issues);
        if (args[0] === 'issue' && args[1] === 'view') return JSON.stringify(current);
        if (args[0] === 'label' && args[1] === 'list') return '[]';
        return '';
    };
    return { calls, gh };
}
test('drift creates one labelled issue with the table as its body', () => {
    const { calls, gh } = fixture([]);
    reconcileProductDrift(gh, 'Cratis/AI', driftReport([row]));
    const create = calls.find(call => call.args[0] === 'issue' && call.args[1] === 'create');
    assert.ok(create?.args.includes('product-drift'));
    assert.match(create!.input!, /\| Product \| Synced \| Latest/);
    assert.equal(calls.filter(call => call.args[1] === 'create' && call.args[0] === 'issue').length, 1);
});
test('existing exact-title issues are re-read and updated, not duplicated', () => {
    const { calls, gh } = fixture([{ number: 1, title: 'AI corpus product drift' }, { number: 2, title: 'Something about AI corpus product drift' }]);
    reconcileProductDrift(gh, 'Cratis/AI', driftReport([row]));
    assert.ok(calls.some(call => call.args[1] === 'view'));
    assert.ok(calls.some(call => call.args[1] === 'edit' && call.args[2] === '1'));
    assert.ok(!calls.some(call => call.args[0] === 'issue' && call.args[1] === 'create'));
});
test('zero drift comments and closes the existing issue', () => {
    const { calls, gh } = fixture([{ number: 1, title: 'AI corpus product drift' }]);
    reconcileProductDrift(gh, 'Cratis/AI', driftReport([{ ...row, synced: row.latest, drift: false }]));
    assert.ok(calls.some(call => call.args[1] === 'close' && call.args.includes('--comment')));
    assert.ok(!calls.some(call => call.args[0] === 'label'));
});
test('zero drift with no issue performs no mutations', () => {
    const { calls, gh } = fixture([]);
    reconcileProductDrift(gh, 'Cratis/AI', driftReport([{ ...row, synced: row.latest, drift: false }]));
    assert.equal(calls.length, 1);
});
test('duplicate issues and changed targets refuse all mutations', () => {
    const duplicate = fixture([{ number: 1, title: 'AI corpus product drift' }, { number: 2, title: 'AI corpus product drift' }]);
    assert.throws(() => reconcileProductDrift(duplicate.gh, 'Cratis/AI', driftReport([row])), /Multiple open/);
    assert.equal(duplicate.calls.length, 1);
    const changed = fixture([{ number: 1, title: 'AI corpus product drift' }], { title: 'AI corpus product drift', state: 'CLOSED' });
    assert.throws(() => reconcileProductDrift(changed.gh, 'Cratis/AI', driftReport([row])), /changed/);
    assert.equal(changed.calls.length, 2);
});
test('invalid counts refuse before GitHub access', () => {
    assert.throws(() => reconcileProductDrift(() => { throw new Error('should not call'); }, 'Cratis/AI', { products: 0, drifted: 0, rows: [], notCovered: [] }), /Invalid product drift counts/);
});
const notCovered = [{ id: 'direct', product: 'Direct', repository: 'Cratis/Direct', reason: 'Excluded by decision.' }];
test('the drift issue body includes the separate exclusions section', () => {
    const { calls, gh } = fixture([]);
    reconcileProductDrift(gh, 'Cratis/AI', driftReport([row], notCovered));
    const body = calls.find(call => call.args[0] === 'issue' && call.args[1] === 'create')!.input!;
    assert.match(body, /## Not covered \(by decision\)\n\n- Direct: Excluded by decision/);
    assert.ok(!body.includes('| Direct |'));
});
test('zero-drift reconciliation refreshes the issue body with exclusions before closing', () => {
    const { calls, gh } = fixture([{ number: 1, title: 'AI corpus product drift' }]);
    reconcileProductDrift(gh, 'Cratis/AI', driftReport([], notCovered));
    const edit = calls.findIndex(call => call.args[1] === 'edit');
    const close = calls.findIndex(call => call.args[1] === 'close');
    assert.ok(edit >= 0 && close > edit);
    assert.match(calls[edit].input!, /Not covered \(by decision\)/);
    assert.ok(calls[close].args.some(argument => argument.includes('0 tracked products compared')));
});
test('GitHub mutation failures propagate', () => {
    const { gh } = fixture([]);
    assert.throws(() => reconcileProductDrift((args, input) => {
        if (args[0] === 'issue' && args[1] === 'create') throw new Error('HTTP 500');
        return gh(args, input);
    }, 'Cratis/AI', driftReport([row])), /500/);
});
