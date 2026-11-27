// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { access, mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { parseOptions } from './arguments.ts';
import { runBatch } from './batch.ts';
import { corpusPaths } from './corpus.ts';
import { pendingTasks } from './storage.ts';
import { tasks } from './tasks.ts';
import { workspace } from './workspace.ts';

const models = ['provider/model-a', 'provider/model-b'];
const bothModels = ['--models', models.join(',')];

test('per-skill matrices accept comma lists and repeated skill selectors with unchanged v1 defaults', () => {
    const options = parseOptions(['outputs', '--corpus', 'v2', '--compare', 'v1', '--skill', 'first,second', '--skill', 'third', '--dry-run', ...bothModels]);
    assert.deepEqual(options.skills, ['first', 'second', 'third']);
    assert.deepEqual(options.models, models);
    assert.equal(options.corpus, 'v2');
    assert.equal(options.compare, 'v1');
    assert.equal(options.dryRun, true);
    assert.deepEqual(parseOptions(['trigger', '--skill', 'all']).skills, ['all']);
    assert.equal(parseOptions(['trigger']).corpus, 'v1');
});

for (const flags of [
    ['--corpus', 'v3'], ['--compare', 'v1'], ['--corpus', 'v2', '--compare', 'v2'], ['--corpus', 'v2', '--compare', 'v1'],
    ['--corpus', 'v2', '--harness', 'claude'], ['--models', 'a,a'], ['--models', 'a,'], ['--models', 'a', '--model', 'a'],
    ['--skill', 'all,first'], ['--skill', 'first,first'], ['--dry-run', 'true'],
]) {
    test(`trigger rejects incompatible matrix flags ${flags.join(' ')}`, () => assert.throws(() => parseOptions(['trigger', ...flags])));
}

async function fixture(root: string, version: 'v1' | 'v2', skill: string, sibling: string): Promise<void> {
    const input = join(root, version === 'v1' ? 'Evaluations/skills' : 'Evaluations/corpus-v2/skills', skill);
    const definition = join(root, version === 'v1' ? '.cratis/ai/skills' : '.cratis/ai-v2/skills', skill);
    await mkdir(input, { recursive: true });
    await mkdir(definition, { recursive: true });
    await writeFile(join(definition, 'SKILL.md'), `---\nname: ${skill}\ndescription: Example skill\n---\nDefinition body\n`);
    const queries = Array.from({ length: 18 }, (_, index) => ({ query: `${version} trigger ${index}`, shouldTrigger: index < 8,
        ...(index >= 8 ? { sibling: index < 16 ? sibling : null } : {}) }));
    const evals = Array.from({ length: 3 }, (_, index) => ({ id: index + 1, name: `task-${index}`, prompt: `${version} output ${index}`,
        expected_output: 'answer', assertions: ['one', 'two', 'three'] }));
    await writeFile(join(input, 'trigger.json'), JSON.stringify({ skill, queries }));
    await writeFile(join(input, 'evals.json'), JSON.stringify({ skill_name: skill, evals }));
}

test('v1 selects legacy inputs; v2 compares identical v2 prompts across arms and resumes by matrix key', async () => {
    const temporary = await workspace();
    try {
        await fixture(temporary.path, 'v1', 'previous', 'unused');
        await fixture(temporary.path, 'v2', 'first', 'second');
        await fixture(temporary.path, 'v2', 'second', 'first');
        const legacy = await tasks(temporary.path, parseOptions(['outputs', '--skill', 'previous', '--limit', '1']));
        assert.deepEqual(legacy.map(task => task.key), ['previous-0-0-with', 'previous-0-0-without']);
        assert.ok(legacy.every(task => task.prompt === 'v1 output 0'));
        const options = parseOptions(['outputs', '--corpus', 'v2', '--skill', 'all', '--compare', 'v1', ...bothModels]);
        const trials = await tasks(temporary.path, options);
        assert.equal(trials.length, 36);
        assert.ok(trials.every(task => task.prompt === `v2 output ${task.index}`));
        assert.deepEqual(new Set(trials.map(task => task.arm)), new Set(['v2', 'none', 'v1']));
        assert.deepEqual(new Set(trials.map(task => task.model)), new Set(models));
        assert.equal(new Set(trials.map(task => task.key)).size, trials.length);
        assert.equal(pendingTasks(await tasks(temporary.path, options), trials.slice(0, 2)).length, 34);
    } finally { await temporary.remove(); }
});

test('dry-run validates both files before truncating trials and does not create run artifacts', async () => {
    const temporary = await workspace();
    try {
        await fixture(temporary.path, 'v2', 'first', 'second');
        await fixture(temporary.path, 'v2', 'second', 'first');
        const options = parseOptions(['trigger', '--corpus', 'v2', '--skill', 'first', '--limit', '1', '--dry-run', ...bothModels]);
        const printed: string[] = [];
        const print = (line: string) => printed.push(line);
        await runBatch(temporary.path, options, print);
        assert.match(printed[0], /6 planned trials \(0 model calls\)/);
        for (const model of models) assert.ok(printed[0].includes(`| ${model} | 3 | 3 |`));
        await assert.rejects(access(join(temporary.path, '.ai-work')));
        const inputs = corpusPaths(temporary.path, 'v2').inputs;
        await writeFile(join(inputs, 'first', 'evals.json'), '{}');
        await assert.rejects(runBatch(temporary.path, options, print), /evals\.json/);
        assert.equal(printed.length, 1);
    } finally { await temporary.remove(); }
});

test('dry-run refuses a corpus link that could expose unstaged files', async () => {
    const temporary = await workspace();
    try {
        await fixture(temporary.path, 'v2', 'first', 'second');
        const directory = join(corpusPaths(temporary.path, 'v2').skills, 'first');
        await symlink(join(temporary.path, 'README.md'), join(directory, 'outside.md'));
        await assert.rejects(runBatch(temporary.path, parseOptions(['trigger', '--corpus', 'v2', '--dry-run'])), /outside\.md/);
    } finally { await temporary.remove(); }
});
