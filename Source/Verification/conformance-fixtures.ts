// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export interface ConformanceCatalog { profiles: string[]; languages: string[] }

/** Kept in step with the schema by the conformance fixture specs. */
export const fixtureVocabulary = {
    harnesses: ['claude', 'codex', 'copilot', 'pi', 'cursor', 'opencode'],
    checkTypes: ['file_exists', 'file_absent', 'file_matches', 'file_not_matches', 'command'],
    phases: ['install', 'result'],
    fixtureKeys: ['name', 'description', 'prompt', 'expected_output', 'profiles', 'languages', 'harnesses', 'expected_instruction_paths', 'checks', 'bounds'],
    checkKeys: ['type', 'phase', 'path', 'glob', 'pattern', 'run', 'exit_code', 'optional'],
    boundKeys: ['timeout_seconds', 'max_budget_usd', 'max_turns']
};
const { harnesses, checkTypes, phases, fixtureKeys, checkKeys, boundKeys } = fixtureVocabulary;

function object(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(text); }
function unsafePath(value: string): boolean {
    return /^([/\\]|[A-Za-z]:)/.test(value) || value.split(/[\\/]/).includes('..');
}

/** The profile ids and languages known to the catalog (public and engineering profiles). */
export function catalogFrom(catalog: unknown): ConformanceCatalog {
    const document = object(catalog);
    const entries = [...(Array.isArray(document.publicProfiles) ? document.publicProfiles : []), ...(Array.isArray(document.engineeringProfiles) ? document.engineeringProfiles : [])].map(object);
    return {
        profiles: entries.map(entry => entry.id).filter(text),
        languages: [...new Set(entries.flatMap(entry => Array.isArray(entry.languages) ? entry.languages.filter(text) : []))]
    };
}

function checkBounds(bounds: Record<string, unknown>, fail: (message: string) => void): void {
    for (const key of Object.keys(bounds)) if (!boundKeys.includes(key)) fail(`bounds: unknown key '${key}'.`);
    for (const key of boundKeys) if (bounds[key] !== undefined && !(typeof bounds[key] === 'number' && Number.isFinite(bounds[key]) && (bounds[key] as number) > 0)) fail(`bounds.${key} must be a positive number.`);
    for (const key of ['timeout_seconds', 'max_turns']) if (bounds[key] !== undefined && !Number.isInteger(bounds[key])) fail(`bounds.${key} must be an integer.`);
}

function checkProblems(index: number, value: unknown, fail: (message: string) => void): void {
    const label = `checks[${index}]`;
    if (!isObject(value)) { fail(`${label} must be an object.`); return; }
    const check = value;
    for (const key of Object.keys(check)) if (!checkKeys.includes(key)) fail(`${label}: unknown key '${key}'.`);
    if (typeof check.type !== 'string' || !checkTypes.includes(check.type)) { fail(`${label}.type must be one of ${checkTypes.join(', ')}.`); return; }
    if (check.phase !== undefined && (typeof check.phase !== 'string' || !phases.includes(check.phase))) fail(`${label}.phase must be 'install' or 'result'.`);
    if (check.optional !== undefined && typeof check.optional !== 'boolean') fail(`${label}.optional must be boolean.`);
    if (check.exit_code !== undefined && !Number.isInteger(check.exit_code)) fail(`${label}.exit_code must be an integer.`);
    for (const key of ['path', 'glob'] as const) {
        if (check[key] === undefined) continue;
        if (!text(check[key])) fail(`${label}.${key} must be nonempty text.`);
        else if (unsafePath(check[key])) fail(`${label}.${key} must be relative with no '..' segment.`);
    }
    if (check.type === 'command') {
        if (check.phase === 'install') fail(`${label}: command is not allowed in the install phase.`);
        if (!Array.isArray(check.run) || check.run.length === 0 || !check.run.every(item => typeof item === 'string')) fail(`${label}.run requires a nonempty array of strings.`);
        if (check.path !== undefined || check.glob !== undefined || check.pattern !== undefined) fail(`${label}: command takes run and exit_code, not path, glob or pattern.`);
        return;
    }
    if (check.run !== undefined || check.exit_code !== undefined) fail(`${label}: run and exit_code apply only to command.`);
    if ((check.path === undefined) === (check.glob === undefined)) fail(`${label} requires exactly one of path or glob.`);
    const matches = check.type === 'file_matches' || check.type === 'file_not_matches';
    if (matches && !text(check.pattern)) fail(`${label}.pattern is required for ${check.type}.`);
    if (!matches && check.pattern !== undefined) fail(`${label}.pattern applies only to file_matches and file_not_matches.`);
}

/** Mirrors Evaluations/conformance/fixture.schema.json plus the cross-file rules the schema cannot express. */
export function fixtureProblems(path: string, folder: string, value: unknown, catalog: ConformanceCatalog): string[] {
    const problems: string[] = [];
    const fail = (message: string) => problems.push(`${path}: ${message}`);
    if (!isObject(value)) { fail('fixture must be a JSON object.'); return problems; }
    const fixture = value;
    for (const key of Object.keys(fixture)) if (!fixtureKeys.includes(key)) fail(`unknown key '${key}'.`);
    if (!text(fixture.name) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fixture.name)) fail('name must be kebab-case.');
    else if (fixture.name !== folder) fail(`name must match folder '${folder}'.`);
    if (!text(fixture.description)) fail('description requires text.');
    if (!text(fixture.prompt)) fail('prompt requires text.');
    if (fixture.expected_output !== undefined && !text(fixture.expected_output)) fail('expected_output must be nonempty text when present.');
    for (const [key, known] of [['profiles', catalog.profiles], ['languages', catalog.languages]] as const) {
        const items = fixture[key];
        if (items === undefined) continue;
        if (!strings(items)) { fail(`${key} must be an array of text.`); continue; }
        for (const item of items) if (!known.includes(item)) fail(`${key} '${item}' is not in the profile catalog.`);
    }
    if (fixture.harnesses !== undefined && (!Array.isArray(fixture.harnesses) || !fixture.harnesses.every(item => typeof item === 'string' && harnesses.includes(item)))) fail(`harnesses must be a subset of ${harnesses.join(', ')}.`);
    if (fixture.expected_instruction_paths !== undefined) {
        if (!strings(fixture.expected_instruction_paths)) fail('expected_instruction_paths must be an array of text.');
        else for (const item of fixture.expected_instruction_paths) if (unsafePath(item)) fail(`expected_instruction_paths '${item}' must be relative with no '..' segment.`);
    }
    if (fixture.bounds !== undefined) {
        if (!isObject(fixture.bounds)) fail('bounds must be an object.');
        else checkBounds(fixture.bounds, fail);
    }
    if (!Array.isArray(fixture.checks) || fixture.checks.length === 0) { fail('checks requires a nonempty array.'); return problems; }
    fixture.checks.forEach((check, index) => checkProblems(index, check, fail));
    const hasResult = fixture.checks.filter(isObject).some(check => (check.phase ?? 'result') === 'result' && check.optional !== true);
    if (!hasResult) fail('requires at least one non-optional result-phase check.');
    return problems;
}

/** CI checks only shape, never starts a model. A missing or empty fixture population is a defect. */
export async function verifyConformanceFixtures(root: string): Promise<{ fixtures: number; problems: string[] }> {
    const directory = join(root, 'Evaluations', 'conformance');
    const problems: string[] = [];
    let catalog: ConformanceCatalog;
    try { catalog = catalogFrom(JSON.parse(await readFile(join(root, '.cratis', 'ai', 'profile-catalog.json'), 'utf8'))); }
    catch (error) { return { fixtures: 0, problems: [`cannot read profile catalog: ${String(error)}`] }; }
    try { JSON.parse(await readFile(join(directory, 'fixture.schema.json'), 'utf8')); }
    catch (error) { problems.push(`${join(directory, 'fixture.schema.json')}: cannot read/parse JSON: ${String(error)}`); }
    let names: string[];
    try { names = (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort(); }
    catch (error) { return { fixtures: 0, problems: [...problems, `${directory}: cannot read conformance fixtures: ${String(error)}`] }; }
    if (names.length === 0) problems.push(`${directory}: requires at least one fixture.`);
    for (const name of names) {
        const path = join(directory, name, 'fixture.json');
        try { problems.push(...fixtureProblems(path, name, JSON.parse(await readFile(path, 'utf8')), catalog)); }
        catch (error) { problems.push(`${path}: cannot read/parse JSON: ${String(error)}`); }
    }
    return { fixtures: names.length, problems };
}
