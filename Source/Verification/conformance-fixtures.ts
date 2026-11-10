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
function unknownKeyProblems(target: Record<string, unknown>, known: string[], describe: (key: string) => string): string[] {
    return Object.keys(target).filter(key => !known.includes(key)).map(describe);
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

function isPositiveNumber(value: unknown): boolean {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function boundsProblems(bounds: Record<string, unknown>): string[] {
    return [
        ...unknownKeyProblems(bounds, boundKeys, key => `bounds: unknown key '${key}'.`),
        ...boundKeys.filter(key => bounds[key] !== undefined && !isPositiveNumber(bounds[key])).map(key => `bounds.${key} must be a positive number.`),
        ...['timeout_seconds', 'max_turns'].filter(key => bounds[key] !== undefined && !Number.isInteger(bounds[key])).map(key => `bounds.${key} must be an integer.`),
    ];
}

function pathProblems(label: string, key: string, value: unknown): string[] {
    if (value === undefined) return [];
    if (!text(value)) return [`${label}.${key} must be nonempty text.`];
    return unsafePath(value) ? [`${label}.${key} must be relative with no '..' segment.`] : [];
}

/** Fields every check type shares, in the order they are reported. */
function commonCheckProblems(label: string, check: Record<string, unknown>): string[] {
    const problems: string[] = [];
    if (check.phase !== undefined && (typeof check.phase !== 'string' || !phases.includes(check.phase))) problems.push(`${label}.phase must be 'install' or 'result'.`);
    if (check.optional !== undefined && typeof check.optional !== 'boolean') problems.push(`${label}.optional must be boolean.`);
    if (check.exit_code !== undefined && !Number.isInteger(check.exit_code)) problems.push(`${label}.exit_code must be an integer.`);
    return [...problems, ...pathProblems(label, 'path', check.path), ...pathProblems(label, 'glob', check.glob)];
}

function commandCheckProblems(label: string, check: Record<string, unknown>): string[] {
    const problems: string[] = [];
    if (check.phase === 'install') problems.push(`${label}: command is not allowed in the install phase.`);
    if (!Array.isArray(check.run) || check.run.length === 0 || !check.run.every(item => typeof item === 'string')) problems.push(`${label}.run requires a nonempty array of strings.`);
    if (check.path !== undefined || check.glob !== undefined || check.pattern !== undefined) problems.push(`${label}: command takes run and exit_code, not path, glob or pattern.`);
    return problems;
}

function fileCheckProblems(label: string, check: Record<string, unknown>): string[] {
    const problems: string[] = [];
    if (check.run !== undefined || check.exit_code !== undefined) problems.push(`${label}: run and exit_code apply only to command.`);
    if ((check.path === undefined) === (check.glob === undefined)) problems.push(`${label} requires exactly one of path or glob.`);
    const matches = check.type === 'file_matches' || check.type === 'file_not_matches';
    if (matches && !text(check.pattern)) problems.push(`${label}.pattern is required for ${check.type}.`);
    if (!matches && check.pattern !== undefined) problems.push(`${label}.pattern applies only to file_matches and file_not_matches.`);
    return problems;
}

function checkProblems(index: number, check: unknown): string[] {
    const label = `checks[${index}]`;
    if (!isObject(check)) return [`${label} must be an object.`];
    const problems = unknownKeyProblems(check, checkKeys, key => `${label}: unknown key '${key}'.`);
    if (typeof check.type !== 'string' || !checkTypes.includes(check.type)) return [...problems, `${label}.type must be one of ${checkTypes.join(', ')}.`];
    return [...problems, ...commonCheckProblems(label, check), ...(check.type === 'command' ? commandCheckProblems(label, check) : fileCheckProblems(label, check))];
}

function nameProblems(folder: string, name: unknown): string[] {
    if (!text(name) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) return ['name must be kebab-case.'];
    return name === folder ? [] : [`name must match folder '${folder}'.`];
}

function catalogListProblems(fixture: Record<string, unknown>, catalog: ConformanceCatalog): string[] {
    return ([['profiles', catalog.profiles], ['languages', catalog.languages]] as const).flatMap(([key, known]) => {
        const items = fixture[key];
        if (items === undefined) return [];
        if (!strings(items)) return [`${key} must be an array of text.`];
        return items.filter(item => !known.includes(item)).map(item => `${key} '${item}' is not in the profile catalog.`);
    });
}

function instructionPathProblems(paths: unknown): string[] {
    if (paths === undefined) return [];
    if (!strings(paths)) return ['expected_instruction_paths must be an array of text.'];
    return paths.filter(unsafePath).map(item => `expected_instruction_paths '${item}' must be relative with no '..' segment.`);
}

function fixtureBoundsProblems(bounds: unknown): string[] {
    if (bounds === undefined) return [];
    return isObject(bounds) ? boundsProblems(bounds) : ['bounds must be an object.'];
}

/** Everything before the checks, reported in the schema's field order. */
function fixtureFieldProblems(folder: string, fixture: Record<string, unknown>, catalog: ConformanceCatalog): string[] {
    const problems = [...unknownKeyProblems(fixture, fixtureKeys, key => `unknown key '${key}'.`), ...nameProblems(folder, fixture.name)];
    if (!text(fixture.description)) problems.push('description requires text.');
    if (!text(fixture.prompt)) problems.push('prompt requires text.');
    if (fixture.expected_output !== undefined && !text(fixture.expected_output)) problems.push('expected_output must be nonempty text when present.');
    problems.push(...catalogListProblems(fixture, catalog));
    if (fixture.harnesses !== undefined && (!Array.isArray(fixture.harnesses) || !fixture.harnesses.every(item => typeof item === 'string' && harnesses.includes(item)))) problems.push(`harnesses must be a subset of ${harnesses.join(', ')}.`);
    return [...problems, ...instructionPathProblems(fixture.expected_instruction_paths), ...fixtureBoundsProblems(fixture.bounds)];
}

function fixtureMessages(folder: string, fixture: Record<string, unknown>, catalog: ConformanceCatalog): string[] {
    const problems = fixtureFieldProblems(folder, fixture, catalog);
    if (!Array.isArray(fixture.checks) || fixture.checks.length === 0) return [...problems, 'checks requires a nonempty array.'];
    problems.push(...fixture.checks.flatMap((check, index) => checkProblems(index, check)));
    const hasResult = fixture.checks.filter(isObject).some(check => (check.phase ?? 'result') === 'result' && check.optional !== true);
    return hasResult ? problems : [...problems, 'requires at least one non-optional result-phase check.'];
}

/** Mirrors Evaluations/conformance/fixture.schema.json plus the cross-file rules the schema cannot express. */
export function fixtureProblems(path: string, folder: string, value: unknown, catalog: ConformanceCatalog): string[] {
    const messages = isObject(value) ? fixtureMessages(folder, value, catalog) : ['fixture must be a JSON object.'];
    return messages.map(message => `${path}: ${message}`);
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
