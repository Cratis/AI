// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { skillAssertionFileProblem } from '../skill-structure.ts';
import { compileOutcome, couldNotRunProblems, testOutcome, versionOutcome } from './classify.ts';
import type { Fence } from './Fence.ts';
import { insideParent, parseFences, pinnedVersion } from './fences.ts';
import { Outcome } from './Outcome.ts';
import type { Report } from './Report.ts';
import type { Runner } from './Runner.ts';
import { run } from './invoke.ts';
import { PreferredSyntax, screenplayGuidance } from './preferred-syntax.ts';
import type { StyleDiagnostic } from './StyleDiagnostic.ts';
import type { StyleException } from './StyleException.ts';

type Loaded<T> = { value: T } | { problem: string };
type Assertion = { kind: string; value?: unknown; file?: unknown };

/** The state shared by every step of one verification run. */
interface Verification {
    root: string;
    runner: Runner;
    tool: string;
    required: boolean;
    report: Report;
    preferred: PreferredSyntax;
    jobs: Array<() => Promise<void>>;
    unavailable: boolean;
    unavailableProblems: number;
}

async function markdownFiles(directory: string): Promise<string[]> {
    const paths: string[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) paths.push(...await markdownFiles(join(directory, entry.name)));
        else if (entry.isFile() && entry.name.endsWith('.md')) paths.push(join(directory, entry.name));
    }
    return paths.sort();
}

function couldNotRun(state: Verification, location: string, reason: string): void {
    state.unavailable = true;
    state.report.skipped.push({ location, reason: `SKIPPED: ${reason}` });
    const problems = couldNotRunProblems(state.required, location, reason);
    state.unavailableProblems += problems.length;
    state.report.problems.push(...problems);
}

async function loadVersion(root: string): Promise<Loaded<string>> {
    try {
        return { value: pinnedVersion(await readFile(join(root, 'Documentation/compatibility.md'), 'utf8')) };
    } catch (error) {
        return { problem: String(error) };
    }
}

async function loadPreferred(root: string, skills: string): Promise<Loaded<PreferredSyntax>> {
    try {
        const contract = JSON.parse(await readFile(join(skills, 'cratis-screenplay-toolchain/references/screenplay-contract.json'), 'utf8')) as { diagnostics: StyleDiagnostic[] };
        const exceptions = JSON.parse(await readFile(join(root, 'Source/Verification/play/preferred-syntax-allowlist.json'), 'utf8')) as StyleException[];
        return { value: new PreferredSyntax(contract.diagnostics, exceptions) };
    } catch (error) {
        return { problem: `Preferred syntax contract/allowlist cannot be read: ${String(error)}` };
    }
}

async function scanSkillFences(state: Verification, skillDirectory: string): Promise<Fence[]> {
    const fences: Fence[] = [];
    for (const file of await markdownFiles(skillDirectory)) {
        const content = await readFile(file, 'utf8');
        const name = relative(state.root, file);
        const parsed = parseFences(name, content);
        if (screenplayGuidance(name)) state.preferred.scan(name, content, parsed.fences);
        state.report.problems.push(...parsed.problems);
        fences.push(...parsed.fences);
    }
    return fences;
}

async function readAssertions(state: Verification, skillName: string, skillDirectory: string, hasFences: boolean): Promise<Assertion[]> {
    let assertions: Assertion[] = [];
    try {
        const manifest = JSON.parse(await readFile(join(skillDirectory, 'verification.json'), 'utf8')) as { skill?: unknown; assertions?: unknown };
        if (Array.isArray(manifest.assertions)) assertions = manifest.assertions;
        if (hasFences && manifest.skill !== skillName) state.report.problems.push(`${skillName}/verification.json must identify its own skill for play-compiles.`);
    } catch (error) {
        if (hasFences) state.report.problems.push(`${skillName}/verification.json cannot be read: ${String(error)}`);
    }
    return assertions;
}

function isInvalidSelector(assertion: Assertion): boolean {
    if (assertion.file !== undefined) return true;
    const value = assertion.value;
    if (value === undefined) return false;
    return typeof value !== 'string' || Boolean(skillAssertionFileProblem(value.split('#')[0])) || !/^[^#]+(?:#[1-9]\d*)?$/.test(value);
}

function selectorMatches(selector: string | undefined, file: string, fence: Fence): boolean {
    return selector === undefined || selector === file || selector === `${file}#${fence.number}`;
}

function playSelectors(state: Verification, skillName: string, assertions: Assertion[]): Array<string | undefined> {
    const selectors: Array<string | undefined> = [];
    for (const assertion of assertions.filter(candidate => candidate.kind === 'play-compiles')) {
        if (isInvalidSelector(assertion)) {
            state.report.problems.push(`${skillName}/verification.json play-compiles value must be a skill-relative Markdown path, optionally #fence-number; omit it for all fences.`);
            continue;
        }
        selectors.push(assertion.value as string | undefined);
    }
    return selectors;
}

function markdownParentSource(path: string, content: string, selected: string | undefined): string {
    const parsed = parseFences(path, content);
    const parent = parsed.fences[Number(selected ?? 1) - 1];
    if (parsed.problems.length || !parent || parent.excerpt) throw new Error('Parent must select a complete, valid Screenplay fence.');
    return parent.source;
}

/** The fence source, composed into its declared parent template or fence when it has one. */
async function sourceWithParent(skillDirectory: string, fence: Fence): Promise<string> {
    if (!fence.parent) return fence.source;
    const [path, selected] = fence.parent.split('#');
    const parentPath = await realpath(join(skillDirectory, path));
    if (skillAssertionFileProblem(relative(await realpath(skillDirectory), parentPath))) throw new Error('Parent escapes the skill directory.');
    const content = await readFile(parentPath, 'utf8');
    if (path.endsWith('.md')) return insideParent(fence.source, markdownParentSource(path, content, selected));
    if (path.endsWith('.play') && selected === undefined) return insideParent(fence.source, content);
    throw new Error('Parent must be a .play template or a .md fence selector.');
}

async function testSpecification(state: Verification, fence: Fence, model: string, directory: string, location: string): Promise<void> {
    const { report } = state;
    const tested = await state.runner(state.tool, ['test', model, '--format', 'json'], directory);
    const outcome = testOutcome(tested, fence.unbound);
    if (outcome === Outcome.CouldNotRun) couldNotRun(state, location, tested.unavailable ?? tested.output);
    else if (outcome === Outcome.Defects) report.problems.push(`${location}: specification exit ${tested.exit}; expected ${fence.unbound ? 'unbound/unsupported (3)' : 'passed with nonzero selection (0)'}.\n${tested.output}`);
    else if (fence.unbound) report.unbound++;
    else report.tested++;
}

async function compileAndTest(state: Verification, fence: Fence, source: string, directory: string, location: string): Promise<void> {
    const { report } = state;
    const model = join(directory, 'example.play');
    await writeFile(model, source);
    const compiled = await state.runner(state.tool, [model, '--warnaserror', '--no-color'], directory);
    state.preferred.diagnostics(fence, compiled.output);
    const outcome = compileOutcome(compiled, fence.expectedCodes);
    if (outcome === Outcome.CouldNotRun) return couldNotRun(state, location, compiled.unavailable ?? compiled.output);
    if (outcome === Outcome.Defects) {
        report.problems.push(`${location}: compile exit ${compiled.exit}; expected codes [${fence.expectedCodes.join(',')}].\n${compiled.output}`);
        return;
    }
    report.compiled++;
    if (fence.expectedCodes.length) report.expectedDiagnostics++;
    if (compiled.exit === 1) report.expectedFailure++;
    if (compiled.exit === 0 && /^[ \t]*specification\s/m.test(source)) await testSpecification(state, fence, model, directory, location);
    else if (fence.unbound) report.problems.push(`${location}: test=unbound did not run specifications.`);
}

async function verifyFence(state: Verification, skillDirectory: string, fence: Fence, location: string): Promise<void> {
    let source: string;
    try {
        source = await sourceWithParent(skillDirectory, fence);
    } catch (error) {
        state.report.problems.push(`${location}: ${String(error)}`);
        return;
    }
    const directory = await mkdtemp(join(tmpdir(), 'cratis-screenplay-'));
    try {
        await compileAndTest(state, fence, source, directory, location);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}

function queueFences(state: Verification, skillName: string, skillDirectory: string, fences: Fence[], selectors: Array<string | undefined>): void {
    const { report } = state;
    for (const selector of selectors) {
        if (!fences.some(fence => selectorMatches(selector, relative(skillDirectory, resolve(state.root, fence.file)), fence))) {
            report.problems.push(`${skillName}/verification.json play-compiles selector '${selector ?? 'all'}' selects no fences.`);
        }
    }
    for (const fence of fences) {
        const location = `${fence.file}:${fence.line}`;
        const file = relative(skillDirectory, resolve(state.root, fence.file));
        if (!selectors.some(selector => selectorMatches(selector, file, fence))) {
            report.problems.push(`${location} has no play-compiles assertion covering it in ${skillName}/verification.json.`);
        } else if (fence.excerpt && !fence.parent) {
            report.skipped.push({ location, reason: 'excerpt has no declared parent' });
        } else {
            state.jobs.push(() => verifyFence(state, skillDirectory, fence, location));
        }
    }
}

async function discoverSkill(state: Verification, skillsDirectory: string, skillName: string): Promise<void> {
    const skillDirectory = join(skillsDirectory, skillName);
    const fences = await scanSkillFences(state, skillDirectory);
    const assertions = await readAssertions(state, skillName, skillDirectory, fences.length > 0);
    queueFences(state, skillName, skillDirectory, fences, playSelectors(state, skillName, assertions));
}

async function scanAgentGuidance(state: Verification): Promise<void> {
    for (const directory of ['.cratis/ai/agents', 'Evaluations/skills']) {
        for (const file of await markdownFiles(join(state.root, directory))) {
            const name = relative(state.root, file);
            if (screenplayGuidance(name)) {
                const content = await readFile(file, 'utf8');
                state.preferred.scan(name, content, parseFences(name, content).fences);
            }
        }
    }
}

async function runJobs(state: Verification, version: string): Promise<void> {
    if (!state.jobs.length) {
        state.report.problems.push('No Screenplay example was selected for compilation; play-compiles would pass vacuously.');
        return;
    }
    const versionResult = await state.runner(state.tool, ['--version'], state.root);
    const outcome = versionOutcome(versionResult, version);
    if (outcome === Outcome.Defects) state.report.problems.push(`Screenplay version mismatch: expected ${version}, got ${versionResult.output.trim()}. Fix: run \`yarn workspace @cratis/ai-verification run tool:screenplay\` (installs the pin into .cache/screenplay-tool) and rerun.`);
    else if (outcome === Outcome.CouldNotRun) couldNotRun(state, 'Screenplay examples', versionResult.unavailable ?? versionResult.output);
    else {
        let index = 0;
        await Promise.all(Array.from({ length: Math.min(4, state.jobs.length) }, async () => {
            while (index < state.jobs.length) await state.jobs[index++]();
        }));
    }
}

function defective(report: Report, problem: string): Report {
    report.problems.push(problem);
    report.outcome = Outcome.Defects;
    return report;
}

export async function verifyPlayExamples(root: string, runner: Runner = run, environment: NodeJS.ProcessEnv = process.env): Promise<Report> {
    const start = Date.now();
    const report: Report = { outcome: Outcome.Clean, compiled: 0, expectedDiagnostics: 0, expectedFailure: 0, tested: 0, unbound: 0, skipped: [], problems: [], milliseconds: 0 };
    const skills = join(root, '.cratis/ai/skills');
    const version = await loadVersion(root);
    if ('problem' in version) return defective(report, version.problem);
    const preferred = await loadPreferred(root, skills);
    if ('problem' in preferred) return defective(report, preferred.problem);
    const state: Verification = {
        root, runner, report, preferred: preferred.value, jobs: [], unavailable: false, unavailableProblems: 0,
        required: environment.CRATIS_REQUIRE_SCREENPLAY === '1',
        tool: environment.CRATIS_SCREENPLAY_TOOL ? resolve(root, environment.CRATIS_SCREENPLAY_TOOL) : 'screenplay',
    };
    // Discovery and marker validation still run when the executable is absent.
    for (const directory of (await readdir(skills, { withFileTypes: true })).filter(entry => entry.isDirectory())) {
        await discoverSkill(state, skills, directory.name);
    }
    await scanAgentGuidance(state);
    await runJobs(state, version.value);
    report.problems.push(...state.preferred.finish());
    report.skipped.sort((left, right) => left.location.localeCompare(right.location));
    report.problems.sort();
    report.outcome = report.problems.length > state.unavailableProblems ? Outcome.Defects : state.unavailable ? Outcome.CouldNotRun : Outcome.Clean;
    report.milliseconds = Date.now() - start;
    return report;
}
