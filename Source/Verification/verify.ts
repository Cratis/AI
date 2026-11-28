// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installedLinkProblems, referenceLinkProblems } from './installed-links.ts';
import { packageProblems, retiredSkills, sharedSkills } from './corpus-shape.ts';
import { nativeRouteProblems } from './native-routes.ts';
import { validateMcpServers } from './mcp-servers.ts';
import { pluginManifestPath, pluginManifestProblems } from './plugin-manifest.ts';
import type { Profile } from './profile-closure.ts';
import { profileLinkProblems } from './profile-links.ts';
import { skillFrontmatterProblems } from './skill-paths.ts';
import { danglingSkillReferences } from './skill-references.ts';
import { brokenRelativeLinkProblems, referenceContentsProblems, skillBody, skillReferenceProblems, skillStructureProblems } from './skill-structure.ts';

export interface CorpusReport {
    failures: string[];
    skills: number;
    profiles: number;
}

interface Catalog { publicProfiles?: Profile[]; engineeringProfiles?: Profile[] }
interface Manifest { profiles?: string[]; profileCatalog?: string; languages?: string[] }
interface ProfileSelections { profiles: Profile[]; languages: string[] }

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

/** What the static checks read once: the repository, its corpus and the skill directories the corpus holds. */
interface Corpus { root: string; directory: string; skills: string[] }

/** The corpus once its catalog is read, so later checks know which profiles exist. */
interface ResolvedCorpus extends Corpus { profiles: string[] }

async function readJson<T>(corpus: Corpus, path: string, failures: string[]): Promise<T | undefined> {
    try { return JSON.parse(await readFile(join(corpus.root, path), 'utf8')) as T; } catch (error) {
        failures.push(`${path}: cannot read JSON: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}

function profilesOf(catalog: Catalog | undefined): Profile[] {
    return [...catalog?.publicProfiles ?? [], ...catalog?.engineeringProfiles ?? []];
}

function duplicateProfileProblems(profiles: Profile[]): string[] {
    const seen = new Set<string>();
    const problems: string[] = [];
    for (const { id } of profiles) {
        if (seen.has(id)) problems.push(`Catalog defines profile '${id}' more than once.`);
        seen.add(id);
    }
    return problems;
}

function manifestProfileProblems(manifest: Manifest, ids: Set<string>): string[] {
    const declared = new Set(manifest.profiles ?? []);
    return [
        ...[...ids].filter(id => !declared.has(id)).map(id => `manifest.profiles is missing catalog profile '${id}'.`),
        ...[...declared].filter(id => !ids.has(id)).map(id => `manifest.profiles lists '${id}', which the catalog does not define.`),
    ];
}

function profileEdgeProblems(profile: Profile, ids: Set<string>, skills: Set<string>): string[] {
    return [
        ...(profile.composes ?? []).filter(child => !ids.has(child)).map(child => `Profile '${profile.id}' composes unknown profile '${child}'.`),
        ...(profile.availableTargets ?? []).filter(target => !skills.has(target)).map(target => `Profile '${profile.id}' targets missing skill '${target}'.`),
    ];
}

function unreachableSkillProblems(profiles: Profile[], skills: string[]): string[] {
    const reachable = new Set(profiles.flatMap(profile => profile.availableTargets ?? []));
    return skills.filter(skill => !reachable.has(skill)).map(skill => `Skill '${skill}' is not reachable from any profile.`);
}

/** Manifest and catalog list the same profiles, every edge and target resolves, and every skill is installable. */
export function catalogProblems(manifest: Manifest, catalog: Catalog, skills: string[]): string[] {
    const profiles = profilesOf(catalog);
    const ids = new Set(profiles.map(profile => profile.id));
    const known = new Set(skills);
    return [
        ...duplicateProfileProblems(profiles),
        ...(ids.size === 0 ? ['Catalog defines no profiles.'] : []),
        ...manifestProfileProblems(manifest, ids),
        ...profiles.flatMap(profile => profileEdgeProblems(profile, ids, known)),
        ...unreachableSkillProblems(profiles, skills),
    ];
}

/** A product version tag, a file-and-line location or a `source:` line is review evidence, not teaching. A lower-case module pin such as `arc.go@v0.1.4` is an install instruction. */
const sourceCitation = /(?<![\w./-])[A-Z][\w.-]*@v\d+\.\d+\.\d+\b|[\w./\\-]+\.(?:cs|tsx?|md|json):\d+\b|^source:/;

function descriptionOf(skill: Skill): string | undefined {
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skill.content)?.[1];
    return frontmatter === undefined ? undefined : /^description:\s*(?:[>|][+-]?\s*\n\s+)?["']?(.*)$/m.exec(frontmatter)?.[1];
}

/** One skill directory of the corpus, with its `SKILL.md` as the repository-relative path problems are reported under. */
interface Skill { root: string; name: string; directory: string; file: string; shown: string; content: string; files: string[] }

interface Document { shown: string; directory: string; content: string }

function linkProblems(document: Document): string[] {
    return brokenRelativeLinkProblems(document.shown, document.content, target => existsSync(join(document.directory, target)));
}

function skillIdentityProblems(skill: Skill): string[] {
    const problems: string[] = [];
    if (!new RegExp(`^name:\\s*["']?${skill.name}["']?\\s*$`, 'm').test(skill.content)) problems.push(`${skill.shown} name must match its directory.`);
    const description = descriptionOf(skill);
    if (description !== undefined && !/^Use (?:when|before)\s+\S/.test(description)) problems.push(`${skill.shown} description must start with 'Use when' or 'Use before' and an invocation condition.`);
    return problems;
}

async function referenceProblems(skill: Skill): Promise<string[]> {
    const references = skill.files.filter(path => path !== skill.file && path.endsWith('.md'));
    const within = (path: string) => relative(skill.directory, path).replaceAll('\\', '/');
    const body = skillBody(skill.content);
    const assets = skill.files.map(within);
    const problems = [
        ...skillReferenceProblems(skill.shown, body, references.map(within)),
        ...referenceLinkProblems(skill.shown, body, assets),
        ...(sharedSkills.includes(skill.name) ? nativeRouteProblems(skill.shown, body, assets) : []),
    ];
    for (const reference of references) {
        const document = { shown: relative(skill.root, reference), directory: dirname(reference), content: await readFile(reference, 'utf8') };
        problems.push(...referenceContentsProblems(document.shown, document.content), ...linkProblems(document));
    }
    return problems;
}

const checkoutOnlyPath = /(?<![\w.-])(?:Evaluations|\.ai-work|Source[\\/]Verification|Documentation|decisions)[\\/]/;

function contentProblems(path: string, content: string): string[] {
    const lines = content.split(/\r?\n/);
    const rules = [
        { pattern: sourceCitation, problem: 'a source citation' },
        { pattern: checkoutOnlyPath, problem: 'a checkout-only path' },
    ];
    return rules.flatMap(({ pattern, problem }) => {
        const line = lines.findIndex(text => pattern.test(text));
        return line === -1 ? [] : [`${path}:${line + 1}: skill content contains ${problem}.`];
    });
}

async function skillContentProblems(skill: Skill): Promise<string[]> {
    const problems: string[] = [];
    for (const file of skill.files) {
        problems.push(...contentProblems(relative(skill.root, file), await readFile(file, 'utf8')));
    }
    return problems;
}

async function skillProblems(corpus: Corpus, name: string): Promise<string[]> {
    const directory = join(corpus.directory, 'skills', name);
    const file = join(directory, 'SKILL.md');
    if (!existsSync(file)) return [`Skill directory '${name}' has no SKILL.md.`];
    const skill: Skill = { root: corpus.root, name, directory, file, shown: relative(corpus.root, file), content: await readFile(file, 'utf8'), files: await filesUnder(directory) };
    return [
        ...skillIdentityProblems(skill),
        ...skillFrontmatterProblems(skill.shown, skill.content),
        ...skillStructureProblems(skill.shown, skill.content),
        ...linkProblems(skill),
        ...await referenceProblems(skill),
        ...await skillContentProblems(skill),
    ];
}

/** An authoring case file names the skill of the directory it sits in. */
async function authoringCaseProblems(corpus: Corpus, name: string): Promise<string[]> {
    const problems: string[] = [];
    const directory = `${evaluationDirectory}/skills/${name}`;
    for (const file of (await readdir(join(corpus.root, directory))).filter(entry => entry.endsWith('.json'))) {
        const path = `${directory}/${file}`;
        const document = await readJson<{ skill?: string; skill_name?: string }>(corpus, path, problems);
        const named = document?.skill ?? document?.skill_name;
        if (named !== undefined && named !== name) problems.push(`${path} must name the skill '${name}'.`);
    }
    return problems;
}

async function orphanedInputProblems(corpus: Corpus): Promise<string[]> {
    const problems: string[] = [];
    for (const kind of ['examples', 'skills']) {
        const orphans = (await directories(join(corpus.root, evaluationDirectory, kind))).filter(name => !corpus.skills.includes(name));
        problems.push(...orphans.map(name => `${evaluationDirectory}/${kind}/${name} names no skill in ${corpusDirectory}/skills.`));
    }
    return problems;
}

/** Examples and authoring cases are optional, but each one must belong to a skill that still exists. */
async function authoringInputProblems(corpus: Corpus): Promise<string[]> {
    const problems = await orphanedInputProblems(corpus);
    for (const name of await directories(join(corpus.root, evaluationDirectory, 'skills'))) problems.push(...await authoringCaseProblems(corpus, name));
    return problems;
}

interface Fixture { name?: string; profiles?: string[]; checks?: Array<{ phase?: string }> }

/** `cratis ai test` validates fixture shape in CI; this keeps the population real against the current catalog. */
async function installFixtureProblems(corpus: ResolvedCorpus): Promise<string[]> {
    const names = await directories(join(corpus.root, fixtureDirectory));
    if (names.length === 0) return [`${fixtureDirectory} requires at least one install fixture.`];
    const problems: string[] = [];
    let installChecks = 0;
    for (const name of names) {
        const path = `${fixtureDirectory}/${name}/fixture.json`;
        const fixture = await readJson<Fixture>(corpus, path, problems);
        if (!fixture) continue;
        if (fixture.name !== name) problems.push(`${path} name must match its directory.`);
        for (const profile of fixture.profiles ?? []) if (!corpus.profiles.includes(profile)) problems.push(`${path} selects unknown profile '${profile}'.`);
        installChecks += (fixture.checks ?? []).filter(check => check.phase === 'install').length;
    }
    return installChecks > 0 ? problems : [...problems, `${fixtureDirectory} requires at least one install-phase check.`];
}

interface Marketplace { plugins?: Array<{ source?: { path?: string }; skills?: string }> }

function exposesCorpus(marketplace: Marketplace): boolean {
    const plugin = marketplace.plugins?.length === 1 ? marketplace.plugins[0] : undefined;
    return plugin?.source?.path === corpusDirectory && plugin.skills === './skills';
}

async function pluginProblems(corpus: Corpus): Promise<string[]> {
    const problems: string[] = [];
    const marketplaces: Array<{ path: string; document: unknown }> = [];
    for (const path of marketplacePaths) {
        const document = await readJson<Marketplace>(corpus, path, problems);
        if (!document) continue;
        marketplaces.push({ path, document });
        if (!exposesCorpus(document)) problems.push(`${path} must expose the canonical ${corpusDirectory}/skills corpus.`);
    }
    const manifest = await readJson<unknown>(corpus, pluginManifestPath, problems);
    return manifest === undefined ? problems : [...problems, ...pluginManifestProblems(manifest, marketplaces)];
}

/** The catalog's selections, with what the manifest and catalog get wrong reported into `failures`. */
async function profileSelections(corpus: Corpus, failures: string[]): Promise<ProfileSelections> {
    const manifest = await readJson<Manifest>(corpus, `${corpusDirectory}/manifest.json`, failures);
    if (!manifest) return { profiles: [], languages: [] };
    const catalog = await readJson<Catalog>(corpus, `${corpusDirectory}/${manifest.profileCatalog ?? 'profile-catalog.json'}`, failures);
    if (catalog) failures.push(...catalogProblems(manifest, catalog, corpus.skills));
    return { profiles: profilesOf(catalog), languages: manifest.languages ?? [] };
}

async function ruleProblems(corpus: Corpus): Promise<string[]> {
    const names = (await readdir(join(corpus.directory, 'rules')).catch(() => [])).filter(name => name.endsWith('.md')).sort();
    const rules = await Promise.all(names.map(async name => ({ path: `${corpusDirectory}/rules/${name}`, content: await readFile(join(corpus.directory, 'rules', name), 'utf8') })));
    const missing = names.includes('general.md') ? [] : [`${corpusDirectory}/rules/general.md is missing.`];
    const general = rules.find(rule => rule.path.endsWith('/general.md'));
    if (general && Buffer.byteLength(general.content) > 4300) missing.push(`${general.path} exceeds 4,300 UTF-8 bytes.`);
    return [...missing, ...danglingSkillReferences(rules, corpus.skills)];
}

async function serverProblems(corpus: ResolvedCorpus): Promise<string[]> {
    const problems: string[] = [];
    const servers = await readJson<unknown>(corpus, `${corpusDirectory}/mcp-servers.json`, problems);
    return servers === undefined ? problems : [...problems, ...validateMcpServers(servers, new Set(corpus.profiles))];
}

async function packagedSkillProblems(directory: string, { profiles, languages }: ProfileSelections): Promise<string[]> {
    const paths = await filesUnder(join(directory, 'skills')).catch(() => []);
    const installed = new Map(await Promise.all(paths.filter(path => !path.endsWith('/verification.json') && !path.includes('/evals/')).map(async path => [
        relative(directory, path).replaceAll('\\', '/'), path.endsWith('.md') ? await readFile(path, 'utf8') : '',
    ] as const)));
    return [...packageProblems(installed, retiredSkills), ...installedLinkProblems(installed), ...profileLinkProblems(installed, profiles, languages)];
}

/** The one static check of the shipped corpus at `.cratis/ai`: no model, no network, no generated state. */
export async function verifyCorpus(root: string): Promise<CorpusReport> {
    const failures: string[] = [];
    const directory = join(root, corpusDirectory);
    if (!existsSync(directory)) return { failures: [`Corpus ${corpusDirectory} is missing.`], skills: 0, profiles: 0 };

    const source: Corpus = { root, directory, skills: await directories(join(directory, 'skills')) };
    if (source.skills.length === 0) failures.push(`${corpusDirectory}/skills contains no skills.`);
    const selections = await profileSelections(source, failures);
    const corpus: ResolvedCorpus = { ...source, profiles: selections.profiles.map(profile => profile.id) };
    for (const name of corpus.skills) failures.push(...await skillProblems(corpus, name));
    failures.push(...await packagedSkillProblems(directory, selections));
    failures.push(...await ruleProblems(corpus), ...await serverProblems(corpus));
    failures.push(...await pluginProblems(corpus), ...await authoringInputProblems(corpus), ...await installFixtureProblems(corpus));
    return { failures, skills: corpus.skills.length, profiles: corpus.profiles.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const report = await verifyCorpus(resolve(process.argv[2] ?? '../..'));
    for (const failure of report.failures) console.error(failure);
    if (report.failures.length > 0) {
        console.error(`Corpus verification failed with ${report.failures.length} problems.`);
        process.exitCode = 1;
    } else console.log(`Corpus verification passed: ${report.skills} skills, ${report.profiles} profiles.`);
}
