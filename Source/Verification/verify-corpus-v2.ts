// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuthoringFinding } from './AuthoringFinding.ts';
import { alwaysOnHarnessBytes, alwaysOnSummary } from './always-on-budget.ts';
import { catalogProblems } from './corpus-staging.ts';
import { contaminationProblems, contaminationSummary, evaluationTargets, scanEvaluationContamination } from './evaluation-contamination.ts';
import { evaluationCoverageFindings } from './evaluation-coverage.ts';
import { skillFrontmatterProblems } from './skill-paths.ts';
import { danglingSkillReferences } from './skill-references.ts';
import { verifySkillEvaluations } from './skill-evaluations.ts';
import { alwaysOnFindings, assetReachabilityFindings, instructionAuthoringFindings, skillAuthoringFindings, skillAuthoringProblems, skillOverlapFindings } from './skill-authoring.ts';
import { skillHygieneFindings, skillHygieneProblems } from './skill-hygiene.ts';
import { brokenRelativeLinkProblems, referenceContentsProblems, skillBody, skillReferenceProblems, skillStructureProblems } from './skill-structure.ts';

export interface CorpusV2Report {
    failures: string[];
    lines: string[];
    skills: number;
}

const corpusDirectory = '.cratis/ai-v2';
const evaluationDirectory = 'Evaluations/corpus-v2';

async function entries(directory: string): Promise<string[]> {
    try { return await readdir(directory); } catch { return []; }
}

async function filesUnder(directory: string): Promise<string[]> {
    const found: string[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) found.push(...await filesUnder(path));
        else if (entry.isFile()) found.push(path);
    }
    return found;
}

const sourceCitation = /\b[\w.-]+@v\d+\.\d+\.\d+\b|[\w./\\-]+\.(?:cs|tsx?|md|json):\d+\b|^source:/;

async function skillCitationProblems(root: string, corpus: string): Promise<string[]> {
    const skills = join(corpus, 'skills');
    if (!existsSync(skills)) return [];
    const paths = (await filesUnder(skills)).sort();
    return (await Promise.all(paths.map(async file => {
        const content = await readFile(file, 'utf8');
        const line = content.split(/\r?\n/).findIndex(text => sourceCitation.test(text));
        return line === -1 ? [] : [`${relative(root, file)}:${line + 1}: skill content contains a source citation.`];
    }))).flat();
}

async function readJson<T>(path: string, failures: string[]): Promise<T | undefined> {
    try { return JSON.parse(await readFile(path, 'utf8')) as T; } catch (error) {
        failures.push(`${path}: cannot read JSON: ${String(error)}`);
        return undefined;
    }
}

async function markdownIn(corpus: string, directory: string): Promise<Array<{ path: string; content: string }>> {
    const names = (await entries(join(corpus, directory))).filter(name => name.endsWith('.md')).sort();
    return Promise.all(names.map(async name => ({ path: `${directory}/${name}`, content: await readFile(join(corpus, directory, name), 'utf8') })));
}

interface SkillFindings {
    failures: string[];
    authoring: AuthoringFinding[];
    hygiene: ReturnType<typeof skillHygieneFindings>;
}

async function skillProblems(root: string, corpus: string, name: string, { failures, authoring, hygiene }: SkillFindings): Promise<void> {
    const skillDirectory = join(corpus, 'skills', name);
    const skillFile = join(skillDirectory, 'SKILL.md');
    const shown = relative(root, skillFile);
    if (!existsSync(skillFile)) { failures.push(`Skill directory '${name}' has no SKILL.md.`); return; }
    const content = await readFile(skillFile, 'utf8');
    hygiene.push(...skillHygieneFindings(shown, content));
    authoring.push(...skillAuthoringFindings(shown, content));
    if (!new RegExp(`^name:\\s*["']?${name}["']?\\s*$`, 'm').test(content)) failures.push(`${shown} name must match its directory.`);
    failures.push(...skillFrontmatterProblems(shown, content), ...skillStructureProblems(shown, content));
    failures.push(...brokenRelativeLinkProblems(shown, content, target => existsSync(join(skillDirectory, target))));
    const assets = (await filesUnder(skillDirectory)).filter(path => path !== skillFile);
    const relativeAssets = assets.map(path => relative(skillDirectory, path).replaceAll('\\', '/'));
    authoring.push(...assetReachabilityFindings(shown, skillBody(content), relativeAssets));
    const references = assets.filter(path => path.endsWith('.md'));
    failures.push(...skillReferenceProblems(shown, skillBody(content), references.map(path => relative(skillDirectory, path).replaceAll('\\', '/'))));
    for (const reference of references) {
        const text = await readFile(reference, 'utf8');
        authoring.push(...skillAuthoringFindings(relative(root, reference), text));
        failures.push(...referenceContentsProblems(relative(root, reference), text));
        failures.push(...brokenRelativeLinkProblems(relative(root, reference), text, target => existsSync(join(dirname(reference), target))));
        if (relative(skillDirectory, reference).replaceAll('\\', '/').startsWith('references/')) hygiene.push(...skillHygieneFindings(relative(root, reference), text));
    }
}

async function verifySkills(root: string, corpus: string, skillNames: string[]) {
    const findings: SkillFindings = { failures: [], authoring: [], hygiene: [] };
    for (const name of skillNames) await skillProblems(root, corpus, name, findings);
    const citations = await skillCitationProblems(root, corpus);
    findings.failures.push(...citations);
    return { ...findings, citationSummary: `Source citations: ${citations.length} skill files flagged.` };
}

/**
 * Runs the existing structural, authoring, hygiene and evaluation validators against `.cratis/ai-v2` and
 * `Evaluations/corpus-v2`. A corpus with no skills yet is a clean, explicitly reported empty result, never a pass of v1.
 */
export async function verifyCorpusV2(root: string, environment: NodeJS.ProcessEnv = process.env): Promise<CorpusV2Report> {
    const failures: string[] = [];
    const lines: string[] = [];
    const corpus = join(root, corpusDirectory);
    if (!existsSync(corpus)) return { failures: [`Corpus ${corpusDirectory} is missing.`], lines, skills: 0 };

    const manifest = await readJson<{ profiles?: string[]; profileCatalog?: string }>(join(corpus, 'manifest.json'), failures);
    const catalog = manifest ? await readJson<{ publicProfiles?: never[]; engineeringProfiles?: never[] }>(join(corpus, manifest.profileCatalog ?? 'profile-catalog.json'), failures) : undefined;
    const skillNames = (await entries(join(corpus, 'skills'))).filter(name => existsSync(join(corpus, 'skills', name)) && !name.startsWith('.')).sort();
    if (manifest && catalog) failures.push(...catalogProblems('v2', manifest, catalog, skillNames));

    const skills = await verifySkills(root, corpus, skillNames);
    const { authoring, hygiene } = skills;
    failures.push(...skills.failures);
    lines.push(skills.citationSummary);

    const referencing = (await Promise.all(['rules', 'prompts', 'agents'].map(directory => markdownIn(corpus, directory)))).flat();
    failures.push(...danglingSkillReferences(referencing, skillNames));
    for (const entry of referencing) authoring.push(...instructionAuthoringFindings(`${corpusDirectory}/${entry.path}`, entry.content));
    const rules = (await markdownIn(corpus, 'rules')).map(rule => ({ file: `${corpusDirectory}/rules/${rule.path.slice(6)}`, content: rule.content }));
    if (rules.some(rule => rule.file.endsWith('/general.md'))) {
        authoring.push(...alwaysOnFindings(rules));
        lines.push(alwaysOnSummary(alwaysOnHarnessBytes(rules)));
    } else lines.push('Always-on budget: rules/general.md is not written yet; nothing to measure.');
    authoring.push(...skillOverlapFindings(await Promise.all(skillNames.filter(name => existsSync(join(corpus, 'skills', name, 'SKILL.md'))).map(async name => ({
        file: `${corpusDirectory}/skills/${name}/SKILL.md`, content: await readFile(join(corpus, 'skills', name, 'SKILL.md'), 'utf8'),
    })))));

    const skillEvaluations = join(root, evaluationDirectory, 'skills');
    const evaluated = (await entries(skillEvaluations)).filter(name => existsSync(join(skillEvaluations, name, 'trigger.json')) && existsSync(join(skillEvaluations, name, 'evals.json'))).sort();
    if (skillNames.length > 0 || (await entries(skillEvaluations)).length > 0) failures.push(...(await verifySkillEvaluations(root, skillNames, skillEvaluations)).problems);
    if (skillNames.length > 0) authoring.push(...evaluationCoverageFindings(skillNames, evaluated, {}, undefined));

    const contamination = await scanEvaluationContamination(corpus, evaluationTargets).catch(() => ({ files: 0, targets: evaluationTargets.length, hits: [] as string[] }));
    if (skillNames.length > 0 || contamination.files > 0) {
        lines.push(contaminationSummary(contamination));
        failures.push(...contaminationProblems(contamination));
    }
    failures.push(...skillAuthoringProblems(authoring, environment.SKILL_AUTHORING_MODE ?? 'warn'));
    failures.push(...skillHygieneProblems(hygiene, environment.SKILL_HYGIENE_MODE ?? 'fail'));
    lines.push(skillNames.length === 0
        ? `Corpus v2: no skills yet (${corpusDirectory}); catalog and manifest are consistent, nothing else to check.`
        : `Corpus v2: ${skillNames.length} skills checked, ${evaluated.length} with evaluation inputs.`);
    return { failures, lines, skills: skillNames.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const report = await verifyCorpusV2(resolve(process.argv[2] ?? '../..'));
    for (const line of report.lines) console.log(line);
    for (const failure of report.failures) console.error(failure);
    if (report.failures.length > 0) {
        console.error(`Corpus v2 verification failed with ${report.failures.length} problems. (v1 is verified separately by 'verify'.)`);
        process.exitCode = 1;
    } else console.log('Corpus v2 verification passed (v2 only; this says nothing about v1).');
}
