// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { verifySkillEvaluations } from '../Verification/skill-evaluations.ts';
import type { Options } from './Options.ts';
import type { Task } from './Task.ts';
import type { Evaluation } from './Evaluation.ts';
import type { TriggerQuery } from './TriggerQuery.ts';

export async function tasks(root: string, options: Options): Promise<Task[]> {
    const known = (await readdir(join(root, '.cratis/ai/skills'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
    const verified = await verifySkillEvaluations(root, known);
    if (verified.problems.length) throw new Error(verified.problems.join('\n'));
    const selected = options.skills.length ? options.skills : (await readdir(join(root, 'Evaluations/skills'))).sort();
    const result: Task[] = [];
    for (const skill of selected) {
        if (!known.includes(skill)) throw new Error(`Unknown corpus skill: ${skill}`);
        const path = join(root, 'Evaluations/skills', skill, `${options.command === 'trigger' ? 'trigger' : 'evals'}.json`);
        const document = JSON.parse(await readFile(path, 'utf8')) as { queries: TriggerQuery[]; evals: Evaluation[] };
        const entries: Array<TriggerQuery | Evaluation> = options.command === 'trigger' ? document.queries : document.evals;
        for (const [index, entry] of entries.slice(0, options.limit).entries()) {
            for (let run = 0; run < options.runs; run++) {
                for (const withSkills of options.command === 'trigger' ? [true] : [true, false]) {
                    result.push({ key: `${skill}-${index}-${run}-${withSkills ? 'with' : 'without'}`, skill, index, run, withSkills,
                        prompt: 'query' in entry ? entry.query : entry.prompt,
                        ...('query' in entry ? { shouldTrigger: entry.shouldTrigger } : {
                            name: entry.name, expectedOutput: entry.expected_output, assertions: entry.assertions,
                        }),
                    });
                }
            }
        }
    }
    if (!result.length) throw new Error('No evaluation tasks selected.');
    return result;
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
