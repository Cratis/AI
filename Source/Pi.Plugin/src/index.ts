// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

type AiConfiguration = { profiles?: string[]; languages?: string[] };
type Profile = { id: string; composes?: string[]; availableTargets?: string[]; languages?: string[] };
type Catalog = { publicProfiles: Profile[]; engineeringProfiles: Profile[] };

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const preparedRoot = join(packageRoot, 'package');
const corpusRoot = existsSync(preparedRoot) ? join(preparedRoot, 'corpus') : join(packageRoot, 'corpus');
const catalogPath = existsSync(preparedRoot)
    ? join(preparedRoot, 'profile-catalog.json')
    : join(packageRoot, '..', '..', '.cratis', 'ai', 'profile-catalog.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as Catalog;
const profiles = [...catalog.publicProfiles, ...catalog.engineeringProfiles];

function skillPath(skill: string): string {
    return join(corpusRoot, 'skills', skill);
}

function skillPathsOf(selected: Profile[]): string[] {
    return [...new Set(selected.flatMap(profile => profile.availableTargets ?? []))]
        .sort()
        .map(skillPath);
}

function allSkillPaths(): string[] {
    return skillPathsOf(profiles);
}

function supportsLanguage(profile: Profile, languages: Set<string>): boolean {
    if (!profile.languages?.length) return true;
    return profile.languages.some(language => language === 'language-agnostic' || languages.has(language));
}

/** The ids of the configured profiles and, transitively, the composed profiles that support the configured languages. */
function selectedProfileIds(configuration: AiConfiguration): Set<string> {
    const languages = new Set(configuration.languages ?? []);
    const selected = new Set<string>();
    const select = (id: string, explicitSelection: boolean): void => {
        const profile = profiles.find(candidate => candidate.id === id);
        if (!profile) throw new Error(`Unknown Cratis AI profile '${id}'.`);
        if (!explicitSelection && !supportsLanguage(profile, languages)) return;
        if (selected.has(id)) return;
        selected.add(id);
        profile.composes?.forEach(child => select(child, false));
    };
    configuration.profiles?.forEach(profile => select(profile, true));
    return selected;
}

export function selectedSkillPaths(cwd: string): string[] {
    const configurationPath = join(cwd, '.cratis', 'ai.json');
    if (!existsSync(configurationPath)) return allSkillPaths();

    const configuration = JSON.parse(readFileSync(configurationPath, 'utf8')) as AiConfiguration;
    const selected = selectedProfileIds(configuration);
    return skillPathsOf(profiles.filter(profile => selected.has(profile.id)));
}

function isManagedInstallation(cwd: string): boolean {
    return existsSync(join(cwd, '.cratis', 'ai.manifest.json'));
}

function frontmatterValue(content: string, name: string): string | undefined {
    if (!content.startsWith('---\n')) return undefined;
    const end = content.indexOf('\n---\n', 4);
    if (end < 0) return undefined;
    const prefix = `${name}:`;
    const line = content.slice(4, end).split('\n').find(candidate => candidate.startsWith(prefix));
    return line?.slice(prefix.length).trim().replace(/^"|"$/g, '');
}

function profileMatchesSelection(profile: string | undefined, selectedProfiles: string[]): boolean {
    if (profile === 'application') return selectedProfiles.some(candidate => candidate.startsWith('cratis/application'));
    if (profile === 'framework') return selectedProfiles.some(candidate => candidate.startsWith('cratis/engineering'));
    if (profile?.startsWith('cratis/')) return selectedProfiles.some(candidate => candidate === profile || candidate.startsWith(`${profile}/`));
    return true;
}

/** A scope kind a rule can name through `applyTo`, and the configuration that satisfies it. */
interface ScopeKind {
    named: (applyTo: string, path: string) => boolean;
    satisfied: (configuration: AiConfiguration) => boolean;
}

const hasLanguage = (language: string) => (configuration: AiConfiguration) => (configuration.languages ?? []).includes(language);

const scopeKinds: ScopeKind[] = [
    { named: applyTo => applyTo.includes('.cs'), satisfied: hasLanguage('csharp') },
    { named: (applyTo, path) => applyTo.includes('.ts') || path.endsWith('/rtk.md'), satisfied: hasLanguage('typescript') },
    { named: applyTo => applyTo.includes('.go') || applyTo.includes('go.mod') || applyTo.includes('go.sum'), satisfied: hasLanguage('go') },
    { named: applyTo => applyTo.includes('.kt'), satisfied: hasLanguage('kotlin') },
    { named: applyTo => applyTo.includes('.java'), satisfied: hasLanguage('java') },
    { named: applyTo => applyTo.includes('.ex'), satisfied: hasLanguage('elixir') },
    { named: applyTo => applyTo.includes('md'), satisfied: configuration => (configuration.profiles ?? []).includes('cratis/documentation') },
];

function ruleMatchesConfiguration(path: string, content: string, configuration: AiConfiguration): boolean {
    if (!profileMatchesSelection(frontmatterValue(content, 'profile'), configuration.profiles ?? [])) return false;
    if ((configuration.languages ?? []).length === 0) return true;
    const applyTo = frontmatterValue(content, 'applyTo') ?? '';
    // A scope that also names model files (`.play`) is not tied to one language, so it is always kept.
    if (applyTo.includes('.play')) return true;
    const named = scopeKinds.filter(kind => kind.named(applyTo, path));
    return named.length === 0 || named.some(kind => kind.satisfied(configuration));
}

/**
 * A rule scoped by `applyTo` to particular files is delivered by the packaged `cratis-path-guidance`
 * extension when such a file is touched, so it stays out of the system prompt. Only rules that apply to
 * every file, or declare no scope, belong there.
 */
function isUniversalRule(content: string): boolean {
    const applyTo = (frontmatterValue(content, 'applyTo') ?? '').split(',').map(glob => glob.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    return applyTo.length === 0 || applyTo.some(glob => ['**', '**/*', '*'].includes(glob));
}

function rules(cwd: string): string {
    const root = join(corpusRoot, 'rules');
    const configurationPath = join(cwd, '.cratis', 'ai.json');
    const configuration = existsSync(configurationPath)
        ? JSON.parse(readFileSync(configurationPath, 'utf8')) as AiConfiguration
        : undefined;
    return readdirSync(root, { recursive: true, encoding: 'utf8' })
        .filter((entry): entry is string => entry.endsWith('.md'))
        .sort()
        .map(entry => ({ path: join(root, entry), content: readFileSync(join(root, entry), 'utf8') }))
        .filter(rule => !configuration || ruleMatchesConfiguration(rule.path, rule.content, configuration))
        .filter(rule => isUniversalRule(rule.content))
        .map(rule => rule.content)
        .join('\n\n');
}

/** Resolves a repository's .cratis/ai.json into Pi skills and instructions without the Cratis CLI. */
export default function (pi: ExtensionAPI): void {
    pi.on('resources_discover', event => isManagedInstallation(event.cwd) ? undefined : ({
        skillPaths: selectedSkillPaths(event.cwd),
        promptPaths: [join(corpusRoot, 'prompts')],
    }));
    pi.on('before_agent_start', (event, context) => isManagedInstallation(context.cwd)
        ? undefined
        : ({ systemPrompt: `${event.systemPrompt}\n\n${rules(context.cwd)}` }));
}
