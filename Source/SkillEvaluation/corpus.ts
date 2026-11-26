// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { frontmatter } from '../../.cratis/ai/harnesses/pi/extensions/shared/frontmatter.ts';
import { skillFrontmatterProblems } from '../Verification/skill-paths.ts';
import { skillStructureProblems } from '../Verification/skill-structure.ts';

export function corpusPaths(root: string, version: 'v1' | 'v2' = 'v1') {
    return version === 'v2'
        ? { skills: join(root, '.cratis/ai-v2/skills'), inputs: join(root, 'Evaluations/corpus-v2/skills') }
        : { skills: join(root, '.cratis/ai/skills'), inputs: join(root, 'Evaluations/skills') };
}

export async function skillNames(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
}

async function assertPlainTree(directory: string): Promise<void> {
    if (!(await lstat(directory)).isDirectory()) throw new Error(`Not a regular corpus directory: ${directory}`);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await assertPlainTree(path);
        else if (!entry.isFile()) throw new Error(`Not a regular corpus file: ${path}`);
    }
}

/** Validate all definitions installed together, including other candidates in the routing population. */
export async function validateCorpus(directory: string, names: string[]): Promise<void> {
    if (!names.length) throw new Error(`No skills in ${directory}`);
    await assertPlainTree(directory);
    const problems = (await Promise.all(names.map(skill => definitionProblems(directory, skill)))).flat();
    if (problems.length) throw new Error(problems.join('\n'));
}

async function definitionProblems(directory: string, skill: string): Promise<string[]> {
    const path = join(directory, skill, 'SKILL.md');
    try {
        const content = (await readFile(path, 'utf8')).replaceAll('\r\n', '\n');
        const problems = [...skillFrontmatterProblems(path, content), ...skillStructureProblems(path, content)];
        if (frontmatter(content).get('name')?.join(',') !== skill) problems.push(`${path}: name must match folder '${skill}'.`);
        return problems;
    } catch (error) { return [`${path}: cannot load skill: ${String(error)}`]; }
}
