// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';

interface Profile {
    id: string;
    composes?: string[];
    availableTargets?: string[];
    languages?: string[];
}
interface Scenario {
    skill: string;
    input: string;
    assertions: Array<{ kind: string; value: string }>;
}

const root = resolve(process.argv[2] ?? '../..');
const corpus = join(root, '.cratis', 'ai');
const failures: string[] = [];
const scenarioResults: Array<{ scenario: string; skill: string; digest: string }> = [];

async function exists(path: string): Promise<boolean> {
    try {
        await access(path, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

async function files(directory: string): Promise<string[]> {
    const discovered: string[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) discovered.push(...await files(path));
        else if (entry.isFile()) discovered.push(path);
    }
    return discovered;
}

function frontmatter(content: string): Record<string, string> | undefined {
    if (!content.startsWith('---\n')) return undefined;
    const end = content.indexOf('\n---\n', 4);
    if (end < 0) return undefined;
    return Object.fromEntries(content.slice(4, end).split('\n').flatMap(line => {
        const separator = line.indexOf(':');
        return separator < 0 ? [] : [[line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')]];
    }));
}

function requireValues(actual: string[], required: string[], subject: string): void {
    for (const value of required) {
        if (!actual.includes(value)) failures.push(`${subject} is missing '${value}'.`);
    }
}

if (!await exists(corpus)) failures.push('Canonical corpus .cratis/ai is missing.');
if (await exists(join(root, '.ai'))) failures.push('Legacy .ai directory must not exist.');
if (await exists(join(root, '.cratis', 'PROJECT.md'))) failures.push('Legacy .cratis/PROJECT.md must not exist.');
for (const obsolete of ['tooling', 'evidence', 'evals', 'catalog', 'distribution', 'profiles', 'pilots', 'engineering']) {
    if (await exists(join(root, obsolete))) failures.push(`Obsolete root '${obsolete}' must not exist.`);
}
const workflows = (await readdir(join(root, '.github', 'workflows'))).filter(name => name.endsWith('.yml') || name.endsWith('.yaml'));
if (workflows.length !== 1 || workflows[0] !== 'publish.yml') failures.push('Exactly one publish workflow is required.');
for (const marketplace of ['.claude-plugin/marketplace.json', '.cursor-plugin/marketplace.json', '.agents/plugins/marketplace.json', '.github/plugin/marketplace.json']) {
    const document = JSON.parse(await readFile(join(root, marketplace), 'utf8'));
    if (document.plugins?.length !== 1 || document.plugins[0]?.source?.path !== '.cratis/ai' || document.plugins[0]?.skills !== './skills') {
        failures.push(`${marketplace} must expose the canonical .cratis/ai/skills corpus.`);
    }
}
const requiredPiExtensions = ['cratis-hooks', 'cratis-rules', 'subagent'];
for (const extension of requiredPiExtensions) {
    if (!await exists(join(corpus, 'harnesses', 'pi', 'extensions', extension, 'index.ts'))) failures.push(`Pi extension '${extension}' is missing.`);
}
const piPackage = JSON.parse(await readFile(join(root, 'Source', 'Pi.Plugin', 'package.json'), 'utf8'));
const packagedExtensions: string[] = piPackage.pi?.extensions ?? [];
for (const extension of [
    './src/index.ts',
    './package/corpus/harnesses/pi/extensions/cratis-hooks/index.ts',
    './package/corpus/harnesses/pi/extensions/subagent/index.ts',
]) {
    if (!packagedExtensions.includes(extension)) failures.push(`@cratis/pi does not load '${extension}'.`);
}

const manifest = JSON.parse(await readFile(join(corpus, 'manifest.json'), 'utf8'));
requireValues(manifest.harnesses ?? [], ['claude', 'codex', 'copilot', 'cursor', 'opencode', 'pi'], 'manifest harnesses');
requireValues(manifest.profiles ?? [], ['cratis/application', 'cratis/arc', 'cratis/chronicle'], 'manifest profiles');
requireValues(manifest.languages ?? [], ['csharp', 'typescript', 'kotlin', 'elixir'], 'manifest languages');
if (manifest.profileCatalog !== 'profile-catalog.json') failures.push("manifest profileCatalog must be 'profile-catalog.json'.");

const catalog = JSON.parse(await readFile(join(corpus, manifest.profileCatalog), 'utf8')) as { publicProfiles: Profile[]; engineeringProfiles: Profile[] };
const profiles = [...catalog.publicProfiles, ...catalog.engineeringProfiles];
const profileIds = new Set(profiles.map(profile => profile.id));
for (const profile of profiles) {
    for (const composed of profile.composes ?? []) {
        if (!profileIds.has(composed)) failures.push(`Profile '${profile.id}' composes missing profile '${composed}'.`);
    }
    for (const skill of profile.availableTargets ?? []) {
        if (!await exists(join(corpus, 'skills', skill, 'SKILL.md'))) failures.push(`Profile '${profile.id}' references missing skill '${skill}'.`);
    }
}
for (const profile of manifest.profiles ?? []) {
    if (!profileIds.has(profile)) failures.push(`Manifest references missing profile '${profile}'.`);
}

const skillDirectories = (await readdir(join(corpus, 'skills'), { withFileTypes: true })).filter(entry => entry.isDirectory());
for (const directory of skillDirectories) {
    const skillFile = join(corpus, 'skills', directory.name, 'SKILL.md');
    if (!await exists(skillFile)) {
        failures.push(`Skill directory '${directory.name}' has no SKILL.md.`);
        continue;
    }
    const metadata = frontmatter(await readFile(skillFile, 'utf8'));
    if (!metadata?.name || !metadata.description) failures.push(`${relative(root, skillFile)} must declare name and description.`);
    if (metadata?.name && metadata.name !== directory.name) failures.push(`${relative(root, skillFile)} name must match its directory.`);
}

for (const prompt of (await readdir(join(corpus, 'prompts'))).filter(name => name.endsWith('.md'))) {
    const path = join(corpus, 'prompts', prompt);
    const metadata = frontmatter(await readFile(path, 'utf8'));
    if (!prompt.endsWith('.prompt.md') || !metadata?.description) failures.push(`${relative(root, path)} must be a *.prompt.md file with a description.`);
}
for (const agent of (await readdir(join(corpus, 'agents'))).filter(name => name.endsWith('.md'))) {
    const path = join(corpus, 'agents', agent);
    const metadata = frontmatter(await readFile(path, 'utf8'));
    if (!metadata?.name || !metadata.description) failures.push(`${relative(root, path)} must declare name and description.`);
}
for (const script of (await files(join(corpus, 'hooks', 'scripts'))).filter(path => path.endsWith('.sh'))) {
    const mode = (await stat(script)).mode;
    if ((mode & 0o111) === 0) failures.push(`${relative(root, script)} must be executable.`);
}

for (const scenarioPath of (await files(join(corpus, 'skills'))).filter(path => basename(path) === 'verification.json')) {
    const scenario = JSON.parse(await readFile(scenarioPath, 'utf8')) as Scenario;
    if (!scenario.skill || !scenario.input || !Array.isArray(scenario.assertions) || scenario.assertions.length === 0) {
        failures.push(`${relative(root, scenarioPath)} must define skill, input, and non-empty assertions.`);
        continue;
    }
    const skillPath = join(corpus, 'skills', scenario.skill, 'SKILL.md');
    const content = await readFile(skillPath, 'utf8');
    for (const assertion of scenario.assertions) {
        if (assertion.kind !== 'skill-contains' || !content.includes(assertion.value)) {
            failures.push(`${relative(root, scenarioPath)} assertion failed: ${JSON.stringify(assertion)}.`);
        }
    }
    scenarioResults.push({
        scenario: relative(root, scenarioPath),
        skill: scenario.skill,
        digest: createHash('sha256').update(content).digest('hex'),
    });
}
if (scenarioResults.length === 0) failures.push('At least one executable skill verification scenario is required.');

if (failures.length > 0) {
    console.error(JSON.stringify({ passed: false, failures }, null, 2));
    process.exit(1);
}
console.log(JSON.stringify({ passed: true, skills: skillDirectories.length, profiles: profiles.length, scenarios: scenarioResults }, null, 2));
