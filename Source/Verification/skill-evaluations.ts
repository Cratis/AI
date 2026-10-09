// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

function object(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown): boolean { return typeof value === 'string' && value.trim().length > 0; }

export function evaluationProblems(path: string, skill: string, kind: 'trigger' | 'evals', value: unknown, knownSkills: string[]): string[] {
    const document = object(value);
    const problems: string[] = [];
    const fail = (message: string) => problems.push(`${path}: ${message}`);
    if (!knownSkills.includes(skill)) fail(`'${skill}' is not an existing corpus skill.`);
    if (document[kind === 'trigger' ? 'skill' : 'skill_name'] !== skill) fail(`skill name must match folder '${skill}'.`);
    if (kind === 'trigger') {
        if (!Array.isArray(document.queries)) { fail('queries must be an array.'); return problems; }
        const queries = document.queries.map(object);
        if (queries.length < 16 || queries.length > 20) fail('requires 16–20 queries.');
        for (const expected of [true, false]) {
            const count = queries.filter(query => query.shouldTrigger === expected).length;
            if (count < 8 || count > 10) fail(`requires 8–10 shouldTrigger=${expected} queries; found ${count}.`);
        }
        const seen = new Set<string>();
        queries.forEach((query, index) => {
            if (!text(query.query) || typeof query.shouldTrigger !== 'boolean' || (query.note !== undefined && !text(query.note))) fail(`queries[${index}] requires query text, boolean shouldTrigger, and optional note text.`);
            if (typeof query.query === 'string') {
                const normalized = query.query.trim().replace(/\s+/g, ' ').toLowerCase();
                if (seen.has(normalized)) fail(`queries[${index}] duplicates a query.`);
                seen.add(normalized);
            }
        });
    } else {
        if (!Array.isArray(document.evals)) { fail('evals must be an array.'); return problems; }
        if (document.evals.length !== 3) fail('requires exactly 3 evaluation tasks.');
        const ids = new Set<number>();
        document.evals.map(object).forEach((evaluation, index) => {
            if (!Number.isSafeInteger(evaluation.id) || Number(evaluation.id) < 1) fail(`evals[${index}].id must be a positive integer.`);
            else {
                if (ids.has(evaluation.id as number)) fail(`evals[${index}].id is duplicated.`);
                ids.add(evaluation.id as number);
            }
            if (typeof evaluation.name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(evaluation.name)) fail(`evals[${index}].name must be kebab-case.`);
            if (!text(evaluation.prompt) || !text(evaluation.expected_output)) fail(`evals[${index}] requires prompt and expected_output text.`);
            if (!Array.isArray(evaluation.assertions) || evaluation.assertions.length < 3 || evaluation.assertions.length > 5 || !evaluation.assertions.every(text)) fail(`evals[${index}].assertions requires 3–5 nonempty strings.`);
        });
    }
    return problems;
}

/** CI checks only shape, never starts a model. Missing/empty populations are defects. */
export async function verifySkillEvaluations(root: string, knownSkills: string[]): Promise<{ skills: number; problems: string[] }> {
    const directory = join(root, 'Evaluations', 'skills');
    let names: string[];
    try { names = (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort(); }
    catch (error) { return { skills: 0, problems: [`${directory}: cannot read evaluation skills: ${String(error)}`] }; }
    const problems: string[] = [];
    if (names.length === 0) problems.push(`${directory}: requires at least one evaluation skill.`);
    for (const name of names) {
        for (const kind of ['trigger', 'evals'] as const) {
            const path = join(directory, name, `${kind}.json`);
            try { problems.push(...evaluationProblems(path, name, kind, JSON.parse(await readFile(path, 'utf8')), knownSkills)); }
            catch (error) { problems.push(`${path}: cannot read/parse JSON: ${String(error)}`); }
        }
    }
    return { skills: names.length, problems };
}
