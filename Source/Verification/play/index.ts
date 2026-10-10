// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { skillAssertionFileProblem } from '../skill-structure.ts';
import { compileOutcome, couldNotRunProblems, testOutcome, versionOutcome } from './classify.ts';
import { insideParent, parseFences, pinnedVersion } from './fences.ts';
import { Outcome } from './Outcome.ts';
import type { Report } from './Report.ts';
import type { Runner } from './Runner.ts';
import { run } from './invoke.ts';

async function markdownFiles(directory: string): Promise<string[]> {
    const paths: string[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) paths.push(...await markdownFiles(join(directory, entry.name)));
        else if (entry.isFile() && entry.name.endsWith('.md')) paths.push(join(directory, entry.name));
    }
    return paths.sort();
}

export async function verifyPlayExamples(root: string, runner: Runner = run, environment: NodeJS.ProcessEnv = process.env): Promise<Report> {
    const start = Date.now();
    const report: Report = { outcome: Outcome.Clean, compiled: 0, expectedDiagnostics: 0, expectedFailure: 0, tested: 0, unbound: 0, skipped: [], problems: [], milliseconds: 0 };
    const skills = join(root, '.cratis/ai/skills');
    const jobs: Array<() => Promise<void>> = [];
    const required = environment.CRATIS_REQUIRE_SCREENPLAY === '1';
    const tool = environment.CRATIS_SCREENPLAY_TOOL ? resolve(root, environment.CRATIS_SCREENPLAY_TOOL) : 'screenplay';
    let unavailable = false;
    let unavailableProblems = 0;
    function couldNotRun(location: string, reason: string): void {
        unavailable = true;
        report.skipped.push({ location, reason: `SKIPPED: ${reason}` });
        const problems = couldNotRunProblems(required, location, reason);
        unavailableProblems += problems.length;
        report.problems.push(...problems);
    }
    let version: string;
    try {
        version = pinnedVersion(await readFile(join(skills, 'cratis-screenplay-toolchain/references/versions.md'), 'utf8'));
    } catch (error) {
        report.problems.push(String(error));
        report.outcome = Outcome.Defects;
        return report;
    }
    // Discovery and marker validation still run when the executable is absent.
    for (const directory of (await readdir(skills, { withFileTypes: true })).filter(entry => entry.isDirectory())) {
        const skillDirectory = join(skills, directory.name);
        const fences = [];
        for (const file of await markdownFiles(skillDirectory)) {
            const parsed = parseFences(relative(root, file), await readFile(file, 'utf8'));
            report.problems.push(...parsed.problems);
            fences.push(...parsed.fences);
        }
        let assertions: Array<{ kind: string; value?: unknown; file?: unknown }> = [];
        try {
            const manifest = JSON.parse(await readFile(join(skillDirectory, 'verification.json'), 'utf8')) as { skill?: unknown; assertions?: unknown };
            if (Array.isArray(manifest.assertions)) assertions = manifest.assertions;
            if (fences.length && manifest.skill !== directory.name) report.problems.push(`${directory.name}/verification.json must identify its own skill for play-compiles.`);
        } catch (error) {
            if (fences.length) report.problems.push(`${directory.name}/verification.json cannot be read: ${String(error)}`);
        }
        const selectors: Array<string | undefined> = [];
        for (const assertion of assertions.filter(assertion => assertion.kind === 'play-compiles')) {
            if (assertion.file !== undefined || (assertion.value !== undefined && (typeof assertion.value !== 'string' || skillAssertionFileProblem(assertion.value.split('#')[0]) || !/^[^#]+(?:#[1-9]\d*)?$/.test(assertion.value)))) {
                report.problems.push(`${directory.name}/verification.json play-compiles value must be a skill-relative Markdown path, optionally #fence-number; omit it for all fences.`);
                continue;
            }
            selectors.push(assertion.value as string | undefined);
        }
        for (const selector of selectors) {
            if (!fences.some(fence => selector === undefined || selector === relative(skillDirectory, resolve(root, fence.file)) || selector === `${relative(skillDirectory, resolve(root, fence.file))}#${fence.number}`)) {
                report.problems.push(`${directory.name}/verification.json play-compiles selector '${selector ?? 'all'}' selects no fences.`);
            }
        }
        for (const fence of fences) {
            const location = `${fence.file}:${fence.line}`;
            const file = relative(skillDirectory, resolve(root, fence.file));
            if (!selectors.some(selector => selector === undefined || selector === file || selector === `${file}#${fence.number}`)) {
                report.problems.push(`${location} has no play-compiles assertion covering it in ${directory.name}/verification.json.`);
                continue;
            }
            if (fence.excerpt && !fence.parent) {
                report.skipped.push({ location, reason: 'excerpt has no declared parent' });
                continue;
            }
            jobs.push(async () => {
                let source = fence.source;
                if (fence.parent) {
                    try {
                        const [path, selected] = fence.parent.split('#');
                        const parentPath = await realpath(join(skillDirectory, path));
                        if (skillAssertionFileProblem(relative(await realpath(skillDirectory), parentPath))) throw new Error('Parent escapes the skill directory.');
                        const content = await readFile(parentPath, 'utf8');
                        if (path.endsWith('.md')) {
                            const parsed = parseFences(path, content);
                            const parent = parsed.fences[Number(selected ?? 1) - 1];
                            if (parsed.problems.length || !parent || parent.excerpt) throw new Error('Parent must select a complete, valid Screenplay fence.');
                            source = insideParent(source, parent.source);
                        } else if (path.endsWith('.play') && selected === undefined) source = insideParent(source, content);
                        else throw new Error('Parent must be a .play template or a .md fence selector.');
                    } catch (error) {
                        report.problems.push(`${location}: ${String(error)}`);
                        return;
                    }
                }
                const directory = await mkdtemp(join(tmpdir(), 'cratis-screenplay-'));
                try {
                    const model = join(directory, 'example.play');
                    await writeFile(model, source);
                    const compiled = await runner(tool, [model, '--warnaserror', '--no-color'], directory);
                    const outcome = compileOutcome(compiled, fence.expectedCodes);
                    if (outcome === Outcome.CouldNotRun) return couldNotRun(location, compiled.unavailable ?? compiled.output);
                    if (outcome === Outcome.Defects) {
                        report.problems.push(`${location}: compile exit ${compiled.exit}; expected codes [${fence.expectedCodes.join(',')}].\n${compiled.output}`);
                        return;
                    }
                    report.compiled++;
                    if (fence.expectedCodes.length) report.expectedDiagnostics++;
                    if (compiled.exit === 1) report.expectedFailure++;
                    if (compiled.exit === 0 && /^[ \t]*specification\s/m.test(source)) {
                        const tested = await runner(tool, ['test', model, '--format', 'json'], directory);
                        const outcome = testOutcome(tested, fence.unbound);
                        if (outcome === Outcome.CouldNotRun) couldNotRun(location, tested.unavailable ?? tested.output);
                        else if (outcome === Outcome.Defects) report.problems.push(`${location}: specification exit ${tested.exit}; expected ${fence.unbound ? 'unbound/unsupported (3)' : 'passed with nonzero selection (0)'}.\n${tested.output}`);
                        else if (fence.unbound) report.unbound++;
                        else report.tested++;
                    } else if (fence.unbound) report.problems.push(`${location}: test=unbound did not run specifications.`);
                } finally {
                    await rm(directory, { recursive: true, force: true });
                }
            });
        }
    }
    if (!jobs.length) report.problems.push('No Screenplay example was selected for compilation; play-compiles would pass vacuously.');
    else {
        const versionResult = await runner(tool, ['--version'], root);
        const outcome = versionOutcome(versionResult, version);
        if (outcome === Outcome.Defects) report.problems.push(`Screenplay version mismatch: expected ${version}, got ${versionResult.output.trim()}.`);
        else if (outcome === Outcome.CouldNotRun) couldNotRun('Screenplay examples', versionResult.unavailable ?? versionResult.output);
        else {
            let index = 0;
            await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, async () => {
                while (index < jobs.length) await jobs[index++]();
            }));
        }
    }
    report.skipped.sort((left, right) => left.location.localeCompare(right.location));
    report.problems.sort();
    report.outcome = report.problems.length > unavailableProblems ? Outcome.Defects : unavailable ? Outcome.CouldNotRun : Outcome.Clean;
    report.milliseconds = Date.now() - start;
    return report;
}
