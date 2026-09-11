import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

type AiConfiguration = { profiles?: string[] };
type Profile = { id: string; composes?: string[]; availableTargets?: string[] };
type Catalog = { publicProfiles: Profile[]; engineeringProfiles: Profile[] };

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const corpusRoot = join(packageRoot, 'corpus');
const catalog = JSON.parse(readFileSync(join(packageRoot, 'profile-catalog.json'), 'utf8')) as Catalog;

function selectedSkillPaths(cwd: string): string[] {
    try {
        const configuration = JSON.parse(readFileSync(join(cwd, '.cratis', 'ai.json'), 'utf8')) as AiConfiguration;
        const profiles = [...catalog.publicProfiles, ...catalog.engineeringProfiles];
        const selected = new Set<string>();
        const select = (id: string): void => {
            if (selected.has(id)) return;
            selected.add(id);
            const profile = profiles.find(candidate => candidate.id === id);
            if (!profile) return;
            profile.composes?.forEach(select);
        };
        configuration.profiles?.forEach(select);
        return [...new Set(profiles.filter(profile => selected.has(profile.id)).flatMap(profile => profile.availableTargets ?? []))]
            .sort()
            .map(skill => join(corpusRoot, 'skills', skill));
    } catch {
        return [];
    }
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
