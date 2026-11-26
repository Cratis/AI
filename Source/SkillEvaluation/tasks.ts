// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readdir } from 'node:fs/promises';
import { verifySkillEvaluations } from '../Verification/skill-evaluations.ts';
import { corpusPaths, skillNames, validateCorpus } from './corpus.ts';
import { evaluationInputs } from './evaluation-inputs.ts';
import type { Options } from './Options.ts';
import type { Task } from './Task.ts';
import type { Evaluation } from './Evaluation.ts';
import type { TriggerQuery } from './TriggerQuery.ts';

export { corpusDigest } from './corpus-digest.ts';

type Arm = NonNullable<Task['arm']>;

function arms(options: Options): Arm[] {
    const corpus = options.corpus ?? 'v1';
    if (options.command === 'trigger') return [corpus];
    return options.compare ? [corpus, 'none', options.compare] : [corpus, 'none'];
}

export async function tasks(root: string, options: Options): Promise<Task[]> {
    const { paths, known } = await verifiedPopulation(root, options);
    const selection = await selectedSkills(paths, known, options);
    const entries = await Promise.all(selection.map(evaluationInputs(paths.inputs, known, options)));
    const result = entries.flatMap((input, index) => scheduleSkill(selection[index], input, options));
    if (!result.length) throw new Error('No evaluation tasks selected.');
    return result;
}

async function verifiedPopulation(root: string, options: Options) {
    const paths = corpusPaths(root, options.corpus);
    const known = await skillNames(paths.skills);
    if (options.corpus === 'v2' || options.dryRun) await validateCorpus(paths.skills, known);
    if (options.compare) {
        const comparison = corpusPaths(root, options.compare).skills;
        await validateCorpus(comparison, await skillNames(comparison));
    }
    if (options.corpus !== 'v2') {
        const verified = await verifySkillEvaluations(root, known);
        if (verified.problems.length) throw new Error(verified.problems.join('\n'));
    }
    return { paths, known };
}

async function selectedSkills(paths: ReturnType<typeof corpusPaths>, known: string[], options: Options): Promise<string[]> {
    if (options.skills.length && !options.skills.includes('all')) return options.skills;
    return options.corpus === 'v2' ? known : (await readdir(paths.inputs)).sort();
}

function taskVariants(options: Options) {
    const models = options.models ?? [options.model];
    const selectedArms = arms(options);
    const useArms = options.corpus === 'v2';
    const nameModel = Boolean(options.models);
    return models.flatMap((model, modelIndex) => {
        const modelKey = nameModel ? `-m${modelIndex + 1}` : '';
        return selectedArms.map(arm => {
            const withSkills = arm !== 'none';
            const condition = useArms ? arm : withSkills ? 'with' : 'without';
            return { keySuffix: `${condition}${modelKey}`, withSkills, ...(useArms ? { arm } : {}), ...(nameModel ? { model } : {}) };
        });
    });
}

function scheduleSkill(skill: string, entries: Array<TriggerQuery | Evaluation>, options: Options): Task[] {
    const variants = taskVariants(options);
    const repetitions = Array.from({ length: options.runs }, (_, run) => run);
    return entries.slice(0, options.limit).flatMap((entry, index) => {
        const input = taskInput(entry, options);
        return repetitions.flatMap(run => variants.map(({ keySuffix, ...variant }) => ({
            key: `${skill}-${index}-${run}-${keySuffix}`, skill, index, run, ...variant, ...input,
        })));
    });
}

function taskInput(entry: TriggerQuery | Evaluation, options: Options) {
    if ('query' in entry) return { prompt: entry.query, shouldTrigger: entry.shouldTrigger,
        ...(options.corpus === 'v2' && !entry.shouldTrigger ? { sibling: entry.sibling } : {}) };
    return { prompt: entry.prompt, name: entry.name, expectedOutput: entry.expected_output, assertions: entry.assertions };
}
