// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import test from 'node:test';
import type { Grade } from './Grade.ts';
import { Harness } from './Harness.ts';
import { outputScore } from './output-score.ts';
import type { Result } from './Result.ts';
import { routingScore } from './routing-score.ts';
import { Transcript } from './signals.ts';
import type { Task } from './Task.ts';

function result(task: Task, confirmedSkills: string[] | undefined): Result {
    return { ...task, confirmedSkills, skillsRead: confirmedSkills ?? [], text: '', usage: undefined, durationSeconds: 0,
        stopped: undefined, transcript: '' };
}

for (const { rates, verdict } of [{ rates: [9, 1, 1], verdict: 'PASS' }, { rates: [8, 2, 2], verdict: 'FAIL' }]) {
    test(`each threshold reports ${verdict} at hit/false-positive counts ${rates.join('/')}`, () => {
        const tasks = Array.from({ length: 40 }, (_, index): Task => ({ key: `${index}`, skill: 'target', index, run: 0,
            prompt: '', withSkills: true, shouldTrigger: index < 10, sibling: index < 10 ? undefined : index < 20 ? 'sibling' : null }));
        const results = tasks.map(task => result(task, route(task.index, rates)));
        const score = routingScore(tasks, results);
        assert.deepEqual([score.positive, score.nearMiss, score.unrelated].map(metric => metric.verdict), [verdict, verdict, verdict]);
        assert.deepEqual([score.positive, score.nearMiss, score.unrelated].map(metric => metric.matches), rates);
        assert.equal(score.alternatives.get('sibling → sibling'), 10 - rates[1]);
    });
}

function route(index: number, [positives, nearMisses, unrelated]: number[]): string[] {
    if (index < 10) return index < positives ? ['target'] : [];
    if (index < 20) return index - 10 < nearMisses ? ['target', 'sibling'] : ['sibling'];
    return index - 20 < unrelated ? ['different-cratis-skill'] : [];
}

test('unconfirmed attempts and incomplete repetitions cannot pass a routing threshold', () => {
    const task: Task = { key: 'positive', skill: 'target', index: 0, run: 0, prompt: '', withSkills: true, shouldTrigger: true };
    const score = routingScore([task, { ...task, key: 'pending' }], [{ ...result(task, undefined), attemptedSkills: ['target'], skillsRead: ['target'] }]);
    assert.deepEqual(score.positive, { matches: 0, measured: 0, planned: 2, verdict: 'INCOMPLETE' });
    assert.equal(score.nearMiss.verdict, 'N/A');
});

for (const withSkills of [true, false]) {
    test(`sandbox confirms only successful reads of a mounted corpus (withSkills=${withSkills})`, () => {
        const transcript = new Transcript(Harness.Pi, { withSkills, corpusSkills: ['target', 'sibling'], sandboxCorpus: '/isolated/stage' });
        for (const [path, isError] of [
            ['/workspace/skills/target/SKILL.md', false], ['/corpus/skills/target/SKILL.md', true],
            ['/corpus/skills/other/SKILL.md', false], ['/isolated/stage/skills/sibling/SKILL.md', false],
        ] as const) {
            const toolCallId = `${path}/${isError}`;
            transcript.consume(JSON.stringify({ type: 'tool_execution_start', toolCallId, toolName: 'read', args: { path } }));
            transcript.consume(JSON.stringify({ type: 'tool_execution_end', toolCallId, isError }));
        }
        assert.deepEqual([...transcript.skillsRead], withSkills ? ['sibling'] : []);
        assert.equal(transcript.seenCalls.size, 4);
    });
}

function output(arm: Task['arm'], run: number, model = 'model-a'): Task {
    return { key: `${model}-${arm}-${run}`, skill: 'skill', arm, index: 0, run, prompt: 'prompt', withSkills: arm !== 'none',
        model, assertions: ['first', 'second'] };
}

function grade(task: Task, passed: boolean[]): Grade {
    return { key: task.key, graderModel: 'grader', results: task.assertions!.map((text, index) => ({ text, passed: passed[index], evidence: '' })) };
}

test('v2 uplift uses matched model, topic and repetition and distinguishes assertion failures by arm', () => {
    const v2 = output('v2', 0), none = output('none', 0), v1 = output('v1', 0);
    const unpaired = output('v2', 1), otherModel = output('none', 1, 'model-b');
    const score = outputScore([v2, none, v1, unpaired, otherModel], [grade(v2, [true, true]), grade(none, [false, false]),
        grade(v1, [true, false]), grade(unpaired, [false, false]), grade(otherModel, [true, true])]);
    assert.deepEqual(score.baseline, { percentagePoints: 100, pairs: 1 });
    assert.deepEqual(score.comparison, { percentagePoints: 50, pairs: 1 });
    assert.deepEqual([...score.arms.get('v1')!.failures], [['second', 1]]);
    assert.equal(score.arms.get('v2')?.passed, 2);
    assert.equal(score.arms.get('v2')?.total, 4);
    assert.equal(score.verdict, 'INCOMPLETE');
    assert.equal(outputScore([v2, none], [grade(v2, [true, true])]).baseline, undefined);
    assert.equal(outputScore([v2, none], [grade(v2, [true, true]), grade(none, [true, true])]).verdict, 'FAIL');
    assert.equal(outputScore([v2, none], [grade(v2, [true, true]), grade(none, [true, false])]).verdict, 'PASS');
});
