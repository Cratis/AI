// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from 'node:crypto';
import { chmod, cp, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

/** The corpus trees an evaluation or opt-in install can stage. A stage holds exactly one of them. */
export type CorpusName = 'v1' | 'v2';

export const corpusRoots: Record<CorpusName, string> = { v1: '.cratis/ai', v2: '.cratis/ai-v2' };

/** Profile namespace each corpus owns; a profile of one corpus must never compose the other's. */
export const corpusProfilePrefixes: Record<CorpusName, string> = { v1: 'cratis/', v2: 'cratis/v2/' };

export const stageMarkerFile = '.cratis-stage.json';

export interface StageMarker {
    schemaVersion: 1;
    corpus: CorpusName | 'none';
    sourceRoot?: string;
    digest: string;
    profile?: string;
    skills: string[];
    files: number;
}

export interface StageOptions {
    corpus: CorpusName;
    /** Repository root holding the corpus trees. */
    root: string;
    /** Destination; refused when it is nonempty and not a previous stage. */
    output: string;
    /** Limit the staged skills to those the profile composes. Rules, manifest and catalog are always staged. */
    profile?: string;
}

interface Profile { id: string; composes?: string[]; availableTargets?: string[] }

/** Profiles of a catalog; v1 splits public and engineering lists, v2 uses the same shape. */
export function catalogProfiles(catalog: { publicProfiles?: Profile[]; engineeringProfiles?: Profile[] }): Profile[] {
    return [...catalog.publicProfiles ?? [], ...catalog.engineeringProfiles ?? []];
}

/** Skills reachable from a profile through `composes`, restricted to skills that exist. */
export function profileSkills(profiles: Profile[], profileId: string, skills: string[]): string[] {
    const byId = new Map(profiles.map(profile => [profile.id, profile]));
    if (!byId.has(profileId)) throw new Error(`Unknown profile '${profileId}'.`);
    const reachable = new Set<string>();
    const visit = (id: string) => {
        if (reachable.has(id)) return;
        reachable.add(id);
        for (const child of byId.get(id)?.composes ?? []) visit(child);
    };
    visit(profileId);
    const known = new Set(skills);
    return [...new Set([...reachable].flatMap(id => byId.get(id)?.availableTargets ?? []).filter(target => known.has(target)))].sort();
}

async function filesUnder(directory: string): Promise<string[]> {
    const found: string[] = [];
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
        const path = join(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error(`${path}: symbolic links are never staged; they could reach mutable guidance outside the corpus.`);
        if (entry.isDirectory()) found.push(...await filesUnder(path));
        else if (entry.isFile()) found.push(path);
    }
    return found;
}

/** Digest of sorted relative names and contents; the stage marker itself is excluded. */
export async function treeDigest(directory: string): Promise<string> {
    const hash = createHash('sha256');
    for (const path of await filesUnder(directory)) {
        const name = relative(directory, path).replaceAll('\\', '/');
        if (name === stageMarkerFile) continue;
        hash.update(name).update('\0').update(await readFile(path)).update('\0');
    }
    return hash.digest('hex');
}

async function makeWritable(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) { await chmod(path, 0o755); await makeWritable(path); }
    }
    await chmod(directory, 0o755);
}

async function readMarker(directory: string): Promise<StageMarker | undefined> {
    try { return JSON.parse(await readFile(join(directory, stageMarkerFile), 'utf8')) as StageMarker; } catch { return undefined; }
}

/** Empty or missing directories are free; a previous stage is replaced; anything else is someone's data. */
async function claimOutput(output: string): Promise<void> {
    let entries: string[];
    try { entries = await readdir(output); } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
    }
    if (entries.length === 0) return;
    if (!await readMarker(output)) throw new Error(`${output} is not empty and is not a corpus stage; refusing to overwrite it.`);
    await makeWritable(output);
    await rm(output, { recursive: true });
}

function freezeFlags(path: string, directory: boolean): Promise<void> {
    return chmod(path, directory ? 0o555 : 0o444);
}

async function freeze(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await freeze(path);
        else await freezeFlags(path, false);
    }
    await freezeFlags(directory, true);
}

/**
 * Copies one corpus into `<output>/.cratis/ai`, the location Harness.Setup and the CLI expect, and freezes it
 * read-only. A stage never contains assets of the other corpus: the source is a single tree and links are refused.
 */
export async function stageCorpus(options: StageOptions): Promise<StageMarker> {
    const sourceRoot = join(resolve(options.root), corpusRoots[options.corpus]);
    const output = resolve(options.output);
    if ((await lstat(sourceRoot).catch(() => undefined))?.isDirectory() !== true) throw new Error(`${sourceRoot} does not exist.`);
    await filesUnder(sourceRoot);
    const catalog = JSON.parse(await readFile(join(sourceRoot, 'profile-catalog.json'), 'utf8'));
    const available = await readdir(join(sourceRoot, 'skills')).catch(() => [] as string[]);
    const selected = options.profile ? profileSkills(catalogProfiles(catalog), options.profile, available) : [...available].sort();
    await claimOutput(output);
    const target = join(output, '.cratis', 'ai');
    await mkdir(dirname(target), { recursive: true });
    await cp(sourceRoot, target, {
        recursive: true,
        filter: source => {
            const parts = relative(sourceRoot, source).split(/[\\/]/);
            return parts[0] !== 'skills' || parts.length < 2 || selected.includes(parts[1]);
        },
    });
    await mkdir(join(target, 'skills'), { recursive: true });
    const marker: StageMarker = {
        schemaVersion: 1, corpus: options.corpus, sourceRoot: corpusRoots[options.corpus], digest: await treeDigest(target),
        ...(options.profile ? { profile: options.profile } : {}), skills: selected, files: (await filesUnder(target)).length,
    };
    await writeFile(join(output, stageMarkerFile), `${JSON.stringify(marker, null, 2)}\n`);
    await freeze(output);
    return marker;
}

/** The none arm: a marked, frozen, empty stage. It contains no corpus file of any kind. */
export async function stageNone(output: string): Promise<StageMarker> {
    const directory = resolve(output);
    await claimOutput(directory);
    await mkdir(directory, { recursive: true });
    const marker: StageMarker = { schemaVersion: 1, corpus: 'none', digest: await treeDigest(directory), skills: [], files: 0 };
    await writeFile(join(directory, stageMarkerFile), `${JSON.stringify(marker, null, 2)}\n`);
    await freeze(directory);
    return marker;
}

/** Removes a stage created by `stageCorpus`; anything else is refused. */
export async function removeStage(output: string): Promise<void> {
    if (!await readMarker(output)) throw new Error(`${output} is not a corpus stage; refusing to remove it.`);
    await makeWritable(output);
    await rm(output, { recursive: true });
}

/** Structural problems of one corpus catalog and manifest pair: availability, namespace isolation, reachability. */
export function catalogProblems(corpus: CorpusName, manifest: { profiles?: string[]; profileCatalog?: string }, catalog: { publicProfiles?: Profile[]; engineeringProfiles?: Profile[] }, skills: string[]): string[] {
    const problems: string[] = [];
    const profiles = catalogProfiles(catalog);
    const ids = new Set(profiles.map(profile => profile.id));
    const declared = new Set(manifest.profiles ?? []);
    for (const id of ids) if (!declared.has(id)) problems.push(`manifest.profiles is missing catalog profile '${id}'.`);
    for (const id of declared) if (!ids.has(id)) problems.push(`manifest.profiles lists '${id}' which the catalog does not define.`);
    if (corpus === 'v2') {
        for (const profile of profiles) {
            if (!profile.id.startsWith(corpusProfilePrefixes.v2)) problems.push(`Profile '${profile.id}' is outside the cratis/v2/ namespace.`);
            for (const child of profile.composes ?? []) {
                if (!child.startsWith(corpusProfilePrefixes.v2)) problems.push(`Profile '${profile.id}' composes '${child}', which is not a v2 profile.`);
                else if (!ids.has(child)) problems.push(`Profile '${profile.id}' composes unknown profile '${child}'.`);
            }
        }
    }
    const reachable = new Set(profiles.flatMap(profile => profile.availableTargets ?? []));
    for (const target of reachable) if (!skills.includes(target)) problems.push(`Catalog references missing skill '${target}'.`);
    for (const skill of skills) if (!reachable.has(skill)) problems.push(`Skill '${skill}' is not reachable from any profile.`);
    return problems;
}
