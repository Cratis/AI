// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');

export interface AiConfiguration { profiles: string[]; languages?: string[] }

interface RuleFixture { profile?: string; globs?: string[] }

/**
 * A corpus small enough to reason about: one rule per way a rule can be scoped. A rule without globs, or with
 * a glob that matches every file, is universal; the others reach a file only when it is touched.
 */
export const ruleFixtures: Record<string, RuleFixture> = {
    'always.md': {},
    'application.md': { profile: 'application', globs: ['**/*.cs', '**/*.ts'] },
    'csharp.md': { globs: ['**/*.cs'] },
    'documentation.md': { globs: ['**/Documentation/**/*.md'] },
    'everywhere.md': { globs: ['**/*'] },
    'framework-always.md': { profile: 'framework' },
    'framework.md': { profile: 'framework', globs: ['**/*.cs', '**/*.ts'] },
    'go.md': { globs: ['**/*.go', '**/go.mod', '**/go.sum'] },
    'model.md': { globs: ['**/*.play', '**/*.cs'] },
    'optional.md': { profile: 'cratis/optional' },
    'typescript.md': { globs: ['**/*.ts', '**/*.tsx'] },
};

export const universalRuleNames = ['always.md', 'everywhere.md', 'framework-always.md', 'optional.md'];

/** The rules each probed path matches by glob, before any profile or language selection. */
export const rulesMatchingPath: Record<string, string[]> = {
    'Source/Thing.cs': ['application.md', 'csharp.md', 'framework.md', 'model.md'],
    'Source/thing.ts': ['application.md', 'framework.md', 'typescript.md'],
    'Source/main.go': ['go.md'],
    'go.mod': ['go.md'],
    'adapter/go.sum': ['go.md'],
    'Documentation/guide/page.md': ['documentation.md'],
    'model/application.play': ['model.md'],
    'README.md': [],
};

/** The rule as it is written to disk, with the scope in both the Copilot (`applyTo`) and Claude Code (`paths`) form. */
export function ruleContent(name: string): string {
    const { profile, globs } = ruleFixtures[name];
    const fields = [
        ...(globs ? [`applyTo: "${globs.join(', ')}"`, 'paths:', ...globs.map(glob => `  - "${glob}"`)] : []),
        ...(profile ? [`profile: ${profile}`] : []),
    ];
    const frontmatter = fields.length ? `---\n${fields.join('\n')}\n---\n\n` : '';
    return `${frontmatter}# Rule ${name}\n\n- Guidance of ${name}.\n`;
}

/**
 * `cratis` composes everything except the opt-in `cratis/optional`, which only an explicit selection reaches.
 * The language-specific profiles are composed only for the languages a repository selects.
 */
export const catalogFixture = {
    publicProfiles: [
        { id: 'cratis', composes: ['cratis/full'] },
        { id: 'cratis/full', composes: ['cratis/application', 'cratis/documentation'] },
        { id: 'cratis/application', composes: ['cratis/application/csharp', 'cratis/application/typescript'], availableTargets: ['demo-application'] },
        { id: 'cratis/application/csharp', languages: ['csharp'], availableTargets: ['demo-csharp'] },
        { id: 'cratis/application/typescript', languages: ['typescript'], availableTargets: ['demo-typescript'] },
        { id: 'cratis/documentation', languages: ['language-agnostic'], availableTargets: ['demo-documentation'] },
        { id: 'cratis/optional', availableTargets: ['demo-optional'] },
    ],
    engineeringProfiles: [
        { id: 'cratis/engineering/core', languages: ['language-agnostic'], availableTargets: ['demo-engineering'] },
        { id: 'cratis/engineering/csharp', languages: ['csharp'], composes: ['cratis/engineering/core'], availableTargets: ['demo-engineering-csharp'] },
    ],
};

export const skillNames = [...catalogFixture.publicProfiles, ...catalogFixture.engineeringProfiles].flatMap(profile => profile.availableTargets ?? []).sort();

interface Rule { name: string; content: string }

export interface PiPackage {
    corpus: string;
    /** The package entry Pi loads, for specs that go through the Pi SDK. */
    entryPath: string;
    rulesExtensionPath: string;
    register: (pi: ExtensionAPI) => void;
    pathGuidance: (pi: ExtensionAPI) => void;
    selectedSkillPaths: (cwd: string) => string[];
    selectedSkillNames: (cwd: string) => string[] | undefined;
    managedRules: (cwd: string) => Rule[];
    universalRules: (cwd: string) => Rule[];
    rulesForPath: (cwd: string, path: string) => Rule[];
    dispose: () => void;
}

export function writeRules(directory: string, names: string[] = Object.keys(ruleFixtures)): void {
    mkdirSync(directory, { recursive: true });
    for (const name of names) writeFileSync(join(directory, name), ruleContent(name));
}

/**
 * Lays the shipped loader out the way `prepare-package.mjs` publishes it (`src/index.ts` beside
 * `package/{profile-catalog.json,corpus}`), over the synthetic corpus above, and loads the package entry,
 * its path guidance and the shared helpers from that tree. The code under test is the repository's own.
 */
export async function createPiPackage(): Promise<PiPackage> {
    // Resolved, because the loader reports the real path of the files it was loaded from.
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'cratis-pi-package-')));
    const corpus = join(root, 'package', 'corpus');
    const extensions = join(corpus, 'harnesses', 'pi', 'extensions');
    cpSync(join(repositoryRoot, 'Source', 'Pi.Plugin', 'src'), join(root, 'src'), { recursive: true });
    cpSync(join(repositoryRoot, '.cratis', 'ai', 'harnesses', 'pi', 'extensions'), extensions, { recursive: true });
    writeFileSync(join(root, 'package', 'profile-catalog.json'), JSON.stringify(catalogFixture));
    writeRules(join(corpus, 'rules'));
    for (const name of skillNames) {
        mkdirSync(join(corpus, 'skills', name), { recursive: true });
        writeFileSync(join(corpus, 'skills', name, 'SKILL.md'), `---\nname: ${name}\ndescription: Use when exercising the package loader.\n---\n\n# ${name}\n`);
    }
    const load = async (path: string) => await import(pathToFileURL(path).href);
    const entryPath = join(root, 'src', 'index.ts');
    const entry = await load(entryPath);
    const guidance = await load(join(extensions, 'cratis-path-guidance', 'index.ts'));
    const rules = await load(join(extensions, 'shared', 'rules.ts'));
    const selection = await load(join(extensions, 'shared', 'skillSelection.ts'));
    return {
        corpus,
        entryPath,
        rulesExtensionPath: join(extensions, 'cratis-rules', 'index.ts'),
        register: entry.default,
        pathGuidance: guidance.default,
        selectedSkillPaths: entry.selectedSkillPaths,
        selectedSkillNames: selection.selectedSkillNames,
        managedRules: rules.managedRules,
        universalRules: rules.universalRules,
        rulesForPath: rules.rulesForPath,
        dispose: () => rmSync(root, { recursive: true, force: true }),
    };
}

/** A repository with the given `.cratis/ai.json`, or none when the configuration is undefined. */
export function createProject(configuration?: AiConfiguration): string {
    const project = mkdtempSync(join(tmpdir(), 'cratis-pi-project-'));
    mkdirSync(join(project, '.cratis'));
    if (configuration) writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify(configuration));
    return project;
}
