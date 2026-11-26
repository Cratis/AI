// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { evaluationProblems, verifySkillEvaluations } from '../Verification/skill-evaluations.ts';
import { corpusPaths, skillNames, validateCorpus } from './corpus.ts';
import type { Options } from './Options.ts';
import type { Task } from './Task.ts';
import type { Evaluation } from './Evaluation.ts';
import type { TriggerQuery } from './TriggerQuery.ts';

type Arm = NonNullable<Task['arm']>;

function arms(options: Options): Arm[] {
    const corpus = options.corpus ?? 'v1';
    if (options.command === 'trigger') return [corpus];
    return options.compare ? [corpus, 'none', options.compare] : [corpus, 'none'];
}

export async function tasks(root: string, options: Options): Promise<Task[]> {
    const paths = corpusPaths(root, options.corpus);
    const known = await skillNames(paths.skills);
    if (options.corpus === 'v2' || options.dryRun) await validateCorpus(paths.skills, known);
    if (options.compare) {
        const comparison = corpusPaths(root, options.compare).skills;
        await validateCorpus(comparison, await skillNames(comparison));
    }
    const selection = await selectedSkills(root, paths.inputs, known, options);
    const entries = await Promise.all(selection.map(skill => loadEntries(paths.inputs, skill, known, options)));
    const result = entries.flatMap((input, index) => scheduleSkill(selection[index], input, options));
    if (!result.length) throw new Error('No evaluation tasks selected.');
    return result;
}

async function selectedSkills(root: string, inputs: string, known: string[], options: Options): Promise<string[]> {
    if (options.corpus !== 'v2') {
        const verified = await verifySkillEvaluations(root, known);
        if (verified.problems.length) throw new Error(verified.problems.join('\n'));
    }
    if (options.skills.length && !options.skills.includes('all')) return options.skills;
    return options.corpus === 'v2' ? known : (await readdir(inputs)).sort();
}

async function loadEntries(inputs: string, skill: string, known: string[], options: Options): Promise<Array<TriggerQuery | Evaluation>> {
    if (!known.includes(skill)) throw new Error(`Unknown corpus skill: ${skill}`);
    const triggerPath = join(inputs, skill, 'trigger.json');
    const outputPath = join(inputs, skill, 'evals.json');
    if (options.corpus === 'v2') {
        const [trigger, output] = await Promise.all([
            input<{ queries: TriggerQuery[] }>(triggerPath), input<{ evals: Evaluation[] }>(outputPath),
        ]);
        const problems = [...evaluationProblems(triggerPath, skill, 'trigger', trigger, known), ...evaluationProblems(outputPath, skill, 'evals', output, known)];
        if (problems.length) throw new Error(problems.join('\n'));
        validateRouting(triggerPath, skill, trigger.queries, known);
        return options.command === 'trigger' ? trigger.queries : output.evals;
    }
    if (options.command === 'trigger') return (await input<{ queries: TriggerQuery[] }>(triggerPath)).queries;
    return (await input<{ evals: Evaluation[] }>(outputPath)).evals;
}

async function input<T>(path: string): Promise<T> {
    try { return JSON.parse(await readFile(path, 'utf8')) as T; }
    catch (error) { throw new Error(`${path}: cannot read/parse JSON: ${String(error)}`); }
}

function validateRouting(path: string, skill: string, queries: TriggerQuery[], known: string[]): void {
    for (const [index, query] of queries.entries()) {
        if (query.shouldTrigger || query.sibling === null) continue;
        if (!known.includes(query.sibling ?? '') || query.sibling === skill) {
            throw new Error(`${path}: queries[${index}] requires sibling: null or a different corpus skill name.`);
        }
    }
}

function scheduleSkill(skill: string, entries: Array<TriggerQuery | Evaluation>, options: Options): Task[] {
    const models = options.models ?? [options.model];
    const selectedArms = arms(options);
    return entries.slice(0, options.limit).flatMap((entry, index) => Array.from({ length: options.runs }, (_, run) =>
        models.flatMap((model, modelIndex) => selectedArms.map(arm => {
            const withSkills = arm !== 'none';
            const condition = options.corpus === 'v2' ? arm : withSkills ? 'with' : 'without';
            const modelKey = options.models ? `-m${modelIndex + 1}` : '';
            return { key: `${skill}-${index}-${run}-${condition}${modelKey}`, skill, index, run, withSkills,
                ...(options.corpus === 'v2' ? { arm } : {}), ...(options.models ? { model } : {}),
                ...taskInput(entry, options),
            };
        })))).flat();
}

function taskInput(entry: TriggerQuery | Evaluation, options: Options) {
    if ('query' in entry) return { prompt: entry.query, shouldTrigger: entry.shouldTrigger,
        ...(options.corpus === 'v2' && !entry.shouldTrigger ? { sibling: entry.sibling } : {}) };
    return { prompt: entry.prompt, name: entry.name, expectedOutput: entry.expected_output, assertions: entry.assertions };
}

/** Resume cannot silently mix skill revisions. Sorted relative filenames and content cover references too. */
export async function corpusDigest(directory: string): Promise<string> {
    const hash = createHash('sha256');
    async function visit(path: string, prefix: string): Promise<void> {
        const entries = (await readdir(path, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name));
        for (const entry of entries) {
            const name = `${prefix}/${entry.name}`;
            if (entry.isDirectory()) await visit(join(path, entry.name), name);
            else if (entry.isFile()) hash.update(name).update('\0').update(await readFile(join(path, entry.name))).update('\0');
        }
    }
    await visit(directory, '');
    return hash.digest('hex');
}
