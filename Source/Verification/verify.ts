// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateMcpServers } from './mcp-servers.ts';
import { pluginManifestPath, pluginManifestProblems } from './plugin-manifest.ts';
import { skillFrontmatterProblems } from './skill-paths.ts';
import { danglingSkillReferences } from './skill-references.ts';
import { brokenRelativeLinkProblems, referenceContentsProblems, skillBody, skillReferenceProblems, skillStructureProblems } from './skill-structure.ts';

export interface CorpusReport {
    failures: string[];
    skills: number;
    profiles: number;
}

interface Profile { id: string; composes?: string[]; availableTargets?: string[] }
interface Catalog { publicProfiles?: Profile[]; engineeringProfiles?: Profile[] }
interface Manifest { profiles?: string[]; profileCatalog?: string }

const corpusDirectory = '.cratis/ai';
const evaluationDirectory = 'Evaluations/corpus-v2';
const fixtureDirectory = 'Evaluations/conformance';
const marketplacePaths = ['.claude-plugin/marketplace.json', '.cursor-plugin/marketplace.json', '.agents/plugins/marketplace.json', '.github/plugin/marketplace.json'];

async function directories(path: string): Promise<string[]> {
    try { return (await readdir(path, { withFileTypes: true })).filter(entry => entry.isDirectory() && !entry.name.startsWith('.')).map(entry => entry.name).sort(); } catch { return []; }
}

async function filesUnder(directory: string): Promise<string[]> {
    const found: string[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) found.push(...await filesUnder(path));
        else if (entry.isFile()) found.push(path);
    }
    return found.sort();
}

async function readJson<T>(root: string, path: string, failures: string[]): Promise<T | undefined> {
    try { return JSON.parse(await readFile(join(root, path), 'utf8')) as T; } catch (error) {
        failures.push(`${path}: cannot read JSON: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}

/** Manifest and catalog list the same profiles, every edge and target resolves, and every skill is installable. */
export function catalogProblems(manifest: Manifest, catalog: Catalog, skills: string[]): string[] {
    const problems: string[] = [];
    const profiles = [...catalog.publicProfiles ?? [], ...catalog.engineeringProfiles ?? []];
    const ids = new Set<string>();
    for (const { id } of profiles) {
        if (ids.has(id)) problems.push(`Catalog defines profile '${id}' more than once.`);
        ids.add(id);
    }
    if (ids.size === 0) problems.push('Catalog defines no profiles.');
    const declared = new Set(manifest.profiles ?? []);
    for (const id of ids) if (!declared.has(id)) problems.push(`manifest.profiles is missing catalog profile '${id}'.`);
    for (const id of declared) if (!ids.has(id)) problems.push(`manifest.profiles lists '${id}', which the catalog does not define.`);
    for (const profile of profiles) {
        for (const child of profile.composes ?? []) if (!ids.has(child)) problems.push(`Profile '${profile.id}' composes unknown profile '${child}'.`);
        for (const target of profile.availableTargets ?? []) if (!skills.includes(target)) problems.push(`Profile '${profile.id}' targets missing skill '${target}'.`);
    }
    const reachable = new Set(profiles.flatMap(profile => profile.availableTargets ?? []));
    for (const skill of skills) if (!reachable.has(skill)) problems.push(`Skill '${skill}' is not reachable from any profile.`);
    return problems;
}

/** A product version tag, a file-and-line location or a `source:` line is review evidence, not teaching. A lower-case module pin such as `arc.go@v0.1.4` is an install instruction. */
const sourceCitation = /(?<![\w./-])[A-Z][\w.-]*@v\d+\.\d+\.\d+\b|[\w./\\-]+\.(?:cs|tsx?|md|json):\d+\b|^source:/;

function descriptionOf(content: string): string | undefined {
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)?.[1];
    return frontmatter === undefined ? undefined : /^description:\s*(?:[>|][+-]?\s*\n\s+)?["']?(.*)$/m.exec(frontmatter)?.[1];
}

async function skillProblems(root: string, corpus: string, name: string): Promise<string[]> {
    const skillDirectory = join(corpus, 'skills', name);
    const skillFile = join(skillDirectory, 'SKILL.md');
    const shown = relative(root, skillFile);
    if (!existsSync(skillFile)) return [`Skill directory '${name}' has no SKILL.md.`];
    const content = await readFile(skillFile, 'utf8');
    const problems: string[] = [];
    if (!new RegExp(`^name:\\s*["']?${name}["']?\\s*$`, 'm').test(content)) problems.push(`${shown} name must match its directory.`);
    const description = descriptionOf(content);
    if (description !== undefined && !/^Use (?:when|before)\s+\S/.test(description)) problems.push(`${shown} description must start with 'Use when' or 'Use before' and an invocation condition.`);
    problems.push(...skillFrontmatterProblems(shown, content), ...skillStructureProblems(shown, content));
    problems.push(...brokenRelativeLinkProblems(shown, content, target => existsSync(join(skillDirectory, target))));
    const files = await filesUnder(skillDirectory);
    const within = (path: string) => relative(skillDirectory, path).replaceAll('\\', '/');
    const references = files.filter(path => path !== skillFile && path.endsWith('.md'));
    problems.push(...skillReferenceProblems(shown, skillBody(content), references.map(within)));
    for (const reference of references) {
        const text = await readFile(reference, 'utf8');
        problems.push(...referenceContentsProblems(relative(root, reference), text));
        problems.push(...brokenRelativeLinkProblems(relative(root, reference), text, target => existsSync(join(dirname(reference), target))));
    }
    for (const file of files) {
        const line = (await readFile(file, 'utf8')).split(/\r?\n/).findIndex(text => sourceCitation.test(text));
        if (line !== -1) problems.push(`${relative(root, file)}:${line + 1}: skill content contains a source citation.`);
    }
    return problems;
}

/** Examples and authoring cases are optional, but each one must belong to a skill that still exists. */
async function authoringInputProblems(root: string, skills: string[]): Promise<string[]> {
    const problems: string[] = [];
    for (const kind of ['examples', 'skills']) {
        for (const name of await directories(join(root, evaluationDirectory, kind))) {
            if (!skills.includes(name)) problems.push(`${evaluationDirectory}/${kind}/${name} names no skill in ${corpusDirectory}/skills.`);
        }
    }
    for (const name of await directories(join(root, evaluationDirectory, 'skills'))) {
        for (const file of (await readdir(join(root, evaluationDirectory, 'skills', name))).filter(entry => entry.endsWith('.json'))) {
            const path = `${evaluationDirectory}/skills/${name}/${file}`;
            const document = await readJson<{ skill?: string; skill_name?: string }>(root, path, problems);
            const named = document?.skill ?? document?.skill_name;
            if (named !== undefined && named !== name) problems.push(`${path} must name the skill '${name}'.`);
        }
    }
    return problems;
}

interface Fixture { name?: string; profiles?: string[]; checks?: Array<{ phase?: string }> }

/** `cratis ai test` validates fixture shape in CI; this keeps the population real against the current catalog. */
async function installFixtureProblems(root: string, profiles: string[]): Promise<string[]> {
    const names = await directories(join(root, fixtureDirectory));
    if (names.length === 0) return [`${fixtureDirectory} requires at least one install fixture.`];
    const problems: string[] = [];
    let installChecks = 0;
    for (const name of names) {
        const path = `${fixtureDirectory}/${name}/fixture.json`;
        const fixture = await readJson<Fixture>(root, path, problems);
        if (!fixture) continue;
        if (fixture.name !== name) problems.push(`${path} name must match its directory.`);
        for (const profile of fixture.profiles ?? []) if (!profiles.includes(profile)) problems.push(`${path} selects unknown profile '${profile}'.`);
        installChecks += (fixture.checks ?? []).filter(check => check.phase === 'install').length;
    }
    return installChecks > 0 ? problems : [...problems, `${fixtureDirectory} requires at least one install-phase check.`];
}

async function pluginProblems(root: string): Promise<string[]> {
    const problems: string[] = [];
    const marketplaces: Array<{ path: string; document: unknown }> = [];
    for (const path of marketplacePaths) {
        const document = await readJson<{ plugins?: Array<{ source?: { path?: string }; skills?: string }> }>(root, path, problems);
        if (!document) continue;
        marketplaces.push({ path, document });
        if (document.plugins?.length !== 1 || document.plugins[0]?.source?.path !== corpusDirectory || document.plugins[0]?.skills !== './skills') {
            problems.push(`${path} must expose the canonical ${corpusDirectory}/skills corpus.`);
        }
    }
    const manifest = await readJson<unknown>(root, pluginManifestPath, problems);
    return manifest === undefined ? problems : [...problems, ...pluginManifestProblems(manifest, marketplaces)];
}

/** The one static check of the shipped corpus at `.cratis/ai`: no model, no network, no generated state. */
export async function verifyCorpus(root: string): Promise<CorpusReport> {
    const failures: string[] = [];
    const corpus = join(root, corpusDirectory);
    if (!existsSync(corpus)) return { failures: [`Corpus ${corpusDirectory} is missing.`], skills: 0, profiles: 0 };

    const skills = await directories(join(corpus, 'skills'));
    if (skills.length === 0) failures.push(`${corpusDirectory}/skills contains no skills.`);
    const manifest = await readJson<Manifest>(root, `${corpusDirectory}/manifest.json`, failures);
    const catalog = manifest ? await readJson<Catalog>(root, `${corpusDirectory}/${manifest.profileCatalog ?? 'profile-catalog.json'}`, failures) : undefined;
    const profiles = [...catalog?.publicProfiles ?? [], ...catalog?.engineeringProfiles ?? []].map(profile => profile.id);
    if (manifest && catalog) failures.push(...catalogProblems(manifest, catalog, skills));
    for (const name of skills) failures.push(...await skillProblems(root, corpus, name));

    const rules = await Promise.all((await readdir(join(corpus, 'rules')).catch(() => [])).filter(name => name.endsWith('.md')).sort()
        .map(async name => ({ path: `${corpusDirectory}/rules/${name}`, content: await readFile(join(corpus, 'rules', name), 'utf8') })));
    if (!rules.some(rule => rule.path.endsWith('/general.md'))) failures.push(`${corpusDirectory}/rules/general.md is missing.`);
    failures.push(...danglingSkillReferences(rules, skills));

    const servers = await readJson<unknown>(root, `${corpusDirectory}/mcp-servers.json`, failures);
    if (servers !== undefined) failures.push(...validateMcpServers(servers, new Set(profiles)));
    failures.push(...await pluginProblems(root), ...await authoringInputProblems(root, skills), ...await installFixtureProblems(root, profiles));
    return { failures, skills: skills.length, profiles: profiles.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const report = await verifyCorpus(resolve(process.argv[2] ?? '../..'));
    for (const failure of report.failures) console.error(failure);
    if (report.failures.length > 0) {
        console.error(`Corpus verification failed with ${report.failures.length} problems.`);
        process.exitCode = 1;
    } else console.log(`Corpus verification passed: ${report.skills} skills, ${report.profiles} profiles.`);
}
