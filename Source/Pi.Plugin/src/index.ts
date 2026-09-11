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

function allSkillPaths(): string[] {
    return [...new Set(profiles.flatMap(profile => profile.availableTargets ?? []))]
        .sort()
        .map(skillPath);
}

function supportsLanguage(profile: Profile, languages: Set<string>): boolean {
    if (!profile.languages?.length) return true;
    return profile.languages.some(language => language === 'language-agnostic' || languages.has(language));
}

export function selectedSkillPaths(cwd: string): string[] {
    const configurationPath = join(cwd, '.cratis', 'ai.json');
    if (!existsSync(configurationPath)) return allSkillPaths();

    const configuration = JSON.parse(readFileSync(configurationPath, 'utf8')) as AiConfiguration;
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
    return [...new Set(profiles.filter(profile => selected.has(profile.id)).flatMap(profile => profile.availableTargets ?? []))]
        .sort()
        .map(skillPath);
}

function rules(): string {
    const root = join(corpusRoot, 'rules');
    return readdirSync(root, { recursive: true, encoding: 'utf8' })
        .filter((entry): entry is string => entry.endsWith('.md'))
        .sort()
        .map(entry => readFileSync(join(root, entry), 'utf8'))
        .join('\n\n');
}

/** Resolves a repository's .cratis/ai.json into Pi skills and instructions without the Cratis CLI. */
export default function (pi: ExtensionAPI): void {
    pi.on('resources_discover', event => ({
        skillPaths: selectedSkillPaths(event.cwd),
        promptPaths: [join(corpusRoot, 'prompts')],
    }));
    pi.on('before_agent_start', event => ({ systemPrompt: `${event.systemPrompt}\n\n${rules()}` }));
}
