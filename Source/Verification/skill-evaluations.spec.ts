// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { evaluationProblems, verifySkillEvaluations } from './skill-evaluations.ts';

const skill = 'cratis-arc-command';
function trigger() { return { skill, queries: Array.from({ length: 20 }, (_, index) => ({ query: `Realistic query ${index}`, shouldTrigger: index < 10 })) }; }
function evals() { return { skill_name: skill, evals: [1, 2, 3].map(id => ({ id, name: `task-${id}`, prompt: 'Prompt', expected_output: 'Expected', assertions: ['First', 'Second', 'Third'] })) }; }
const check = (kind: 'trigger' | 'evals', value: unknown) => evaluationProblems(`Evaluations/skills/${skill}/${kind}.json`, skill, kind, value, [skill]);

test('valid trigger and Agent Skills output files pass with required counts', () => {
    assert.deepEqual(check('trigger', trigger()), []);
    assert.deepEqual(check('evals', evals()), []);
});

test('bad root fields, counts, types and duplicate queries carry the file path', () => {
    for (const document of [null, {}, { ...trigger(), skill: 'other' }, { ...trigger(), queries: [] }, { ...trigger(), queries: 'wrong' }]) {
        const problems = check('trigger', document);
        assert.ok(problems.length > 0);
        assert.ok(problems.every(problem => problem.startsWith(`Evaluations/skills/${skill}/trigger.json:`)));
    }
    const document = trigger();
    document.queries[1].query = '  REALISTIC   QUERY 0 ';
    assert.match(check('trigger', document).join('\n'), /duplicates a query/);
    assert.match(check('trigger', { ...trigger(), queries: trigger().queries.map(query => ({ ...query, shouldTrigger: 'true', note: 1 })) }).join('\n'), /boolean shouldTrigger/);
    assert.match(evaluationProblems('path', skill, 'trigger', trigger(), []).join('\n'), /not an existing corpus skill/);
});

test('eval shape catches id collisions, invalid names, blank prompts and bad assertions', () => {
    const document = evals();
    document.evals[1].id = 1;
    document.evals[0].name = 'not kebab';
    document.evals[0].prompt = ' ';
    document.evals[2].assertions = [];
    const problems = check('evals', document).join('\n');
    for (const pattern of [/duplicated/, /kebab-case/, /prompt and expected_output/, /3–5/]) assert.match(problems, pattern);
    assert.ok(check('evals', { ...evals(), evals: [{ id: 'one' }] }).length >= 4);
});

test('directory scan refuses missing or empty subjects and reports missing/malformed files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-evaluation-schema-'));
    try {
        assert.equal((await verifySkillEvaluations(root, [skill])).skills, 0);
        const directory = join(root, 'Evaluations/skills');
        await mkdir(directory, { recursive: true });
        assert.match((await verifySkillEvaluations(root, [skill])).problems.join('\n'), /at least one/);
        await mkdir(join(directory, skill));
        await writeFile(join(directory, skill, 'trigger.json'), '{');
        const problems = (await verifySkillEvaluations(root, [skill])).problems;
        assert.equal(problems.length, 2);
        assert.ok(problems[0].includes('trigger.json'));
        assert.ok(problems[1].includes('evals.json'));
        await writeFile(join(directory, skill, 'trigger.json'), JSON.stringify(trigger()));
        await writeFile(join(directory, skill, 'evals.json'), JSON.stringify(evals()));
        assert.deepEqual(await verifySkillEvaluations(root, [skill]), { skills: 1, problems: [] });
    } finally { await rm(root, { recursive: true }); }
});
