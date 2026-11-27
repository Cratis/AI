// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { evaluationProblems } from '../Verification/skill-evaluations.ts';
import type { Evaluation } from './Evaluation.ts';
import type { Options } from './Options.ts';
import type { TriggerQuery } from './TriggerQuery.ts';

export function evaluationInputs(directory: string, known: string[], options: Options) {
    return async (skill: string): Promise<Array<TriggerQuery | Evaluation>> => {
        if (!known.includes(skill)) throw new Error(`Unknown corpus skill: ${skill}`);
        const triggerPath = join(directory, skill, 'trigger.json');
        const outputPath = join(directory, skill, 'evals.json');
        const trigger = () => input<{ queries: TriggerQuery[] }>(triggerPath);
        const output = () => input<{ evals: Evaluation[] }>(outputPath);
        if (options.corpus !== 'v2') {
            return options.command === 'trigger' ? (await trigger()).queries : (await output()).evals;
        }
        const [routing, results] = await Promise.all([trigger(), output()]);
        const problems = [...evaluationProblems(triggerPath, skill, 'trigger', routing, known), ...evaluationProblems(outputPath, skill, 'evals', results, known)];
        if (problems.length) throw new Error(problems.join('\n'));
        const invalid = routing.queries.findIndex(query => !validSibling(query, skill, known));
        if (invalid !== -1) throw new Error(`${triggerPath}: queries[${invalid}] requires sibling: null or a different corpus skill name.`);
        return options.command === 'trigger' ? routing.queries : results.evals;
    };
}

async function input<T>(path: string): Promise<T> {
    try { return JSON.parse(await readFile(path, 'utf8')) as T; }
    catch (error) { throw new Error(`${path}: cannot read/parse JSON: ${String(error)}`); }
}

function validSibling(query: TriggerQuery, skill: string, known: string[]): boolean {
    if (query.shouldTrigger || query.sibling === null) return true;
    return known.includes(query.sibling ?? '') && query.sibling !== skill;
}
