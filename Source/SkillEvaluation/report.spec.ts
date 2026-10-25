// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import test from 'node:test';
import type { Manifest } from './Manifest.ts';
import type { Result } from './Result.ts';
import { parseOptions } from './arguments.ts';
import { report, statistics, triggerPass } from './report.ts';

function result(key: string, withSkills: boolean): Result {
    return { key, withSkills, skill: 'cratis-arc-command', index: 0, run: 0, prompt: 'query', name: 'tuple',
        assertions: ['tuple', 'key', 'types'], skillsRead: withSkills ? ['cratis-arc-command'] : [], text: 'answer', usage: { input: withSkills ? 20 : 10, output: 5 },
        durationSeconds: withSkills ? 12 : 10, stopped: undefined, transcript: `raw/${key}.jsonl` };
}

test('threshold is inclusive for positives and exclusive for near misses; zero runs cannot pass', () => {
    assert.deepEqual(triggerPass(1, 2, true), { rate: 0.5, passed: true });
    assert.equal(triggerPass(1, 2, false).passed, false);
    assert.equal(triggerPass(0, 3, false).passed, true);
    assert.throws(() => triggerPass(0, 0, true));
    assert.deepEqual(statistics([1, 3]), { mean: 2, standardDeviation: 1 });
    assert.equal(statistics([]), undefined);
});

test('trigger report names failing queries and skills that took them', () => {
    const row = { ...result('with', true), shouldTrigger: true, skillsRead: ['cratis-chronicle-read-model'] };
    const manifest: Manifest = { version: 1, options: parseOptions(['trigger', '--runs', '1']), corpusDigest: 'test', tasks: [row] };
    const text = report(manifest, [row], []);
    assert.match(text, /Should-trigger: 0\/1/);
    assert.match(text, /FAIL/);
    assert.match(text, /query — skills: cratis-chronicle-read-model/);
    assert.match(report(manifest, [], []), /INCOMPLETE/);
});

test('output report computes paired deltas and distinguishes useful, both-pass and both-fail assertions', () => {
    const withRow = result('with', true), withoutRow = result('without', false);
    const manifest: Manifest = { version: 1, options: parseOptions(['outputs']), corpusDigest: 'test', tasks: [withRow, withoutRow] };
    const grades = [true, false].map(withSkills => ({ key: withSkills ? 'with' : 'without', graderModel: 'opus', results: [
        { text: 'tuple', passed: withSkills, evidence: 'answer' }, { text: 'key', passed: true, evidence: 'answer' }, { text: 'types', passed: false, evidence: '' },
    ] }));
    const text = report(manifest, [withRow, withoutRow], grades);
    assert.match(text, /2\/3 \(66.7%\).*1\/3 \(33.3%\).*10.0.*0.0.*2.0/);
    assert.match(text, /Discriminating: cratis-arc-command\/tuple: tuple/);
    assert.match(text, /Non-discriminating: cratis-arc-command\/tuple: key/);
    assert.match(text, /Non-discriminating: cratis-arc-command\/tuple: types/);
    assert.match(report(manifest, [withRow, withoutRow], []), /No paired grades yet/);
    assert.equal(report(manifest, [withRow, withoutRow], [...grades, ...grades]), text, 'duplicate grade keys must not inflate scores');
});
