// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test, { after } from 'node:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import registerPiPlugin, { selectedSkillPaths } from '../Pi.Plugin/src/index.ts';
import registerCratisHooks from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/index.ts';
import registerManagedRules from '../../.cratis/ai/harnesses/pi/extensions/cratis-rules/index.ts';
import { globToRegExp } from '../../.cratis/ai/harnesses/pi/extensions/shared/globs.ts';
import { managedRules, rulesForPath, universalRules } from '../../.cratis/ai/harnesses/pi/extensions/shared/rules.ts';
import { createPiPackage, createProject, ruleContent, ruleFixtures, rulesMatchingPath, skillNames, universalRuleNames, writeRules } from './pi-package.fixture.ts';
import type { AiConfiguration } from './pi-package.fixture.ts';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
type Handler = (event: { cwd: string; systemPrompt: string }, context: { cwd: string }) => unknown;

function pluginHandlers(register: (pi: ExtensionAPI) => void = registerPiPlugin): Map<string, Handler> {
    const handlers = new Map<string, Handler>();
    register({
        on(name: string, handler: Handler) {
            handlers.set(name, handler);
        },
    } as unknown as ExtensionAPI);
    return handlers;
}

test('Pi exposes every catalog skill when configuration is absent', () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-pi-'));
    try {
        const catalog = JSON.parse(readFileSync(join(repositoryRoot, '.cratis', 'ai', 'profile-catalog.json'), 'utf8'));
        const expected = new Set<string>([...catalog.publicProfiles, ...catalog.engineeringProfiles].flatMap((profile: { availableTargets?: string[] }) => profile.availableTargets ?? []));
        const actual = selectedSkillPaths(project);
        assert.equal(actual.length, expected.size);
        assert.ok(actual.every(existsSync));
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('managed Pi puts only universal rules in the system prompt', () => {
    const prompt = universalRules(repositoryRoot).map(rule => rule.content).join('\n\n');
    assert.match(prompt, /# Working with Cratis/);
    assert.doesNotMatch(prompt, /# Platform sources/);
    assert.doesNotMatch(prompt, /# TypeScript spec assertions/);
    assert.ok(universalRules(repositoryRoot).length < managedRules(repositoryRoot).length);
});

test('managed Pi attaches path-scoped rules by applyTo and paths', () => {
    const csharp = rulesForPath(repositoryRoot, 'Source/Thing/Thing.cs').map(rule => rule.content).join('\n\n');
    assert.match(csharp, /# Platform sources/);
    assert.doesNotMatch(csharp, /# TypeScript spec assertions/);
    assert.doesNotMatch(csharp, /# Working with Cratis/);

    const spec = rulesForPath(repositoryRoot, 'Source/Thing/for_Thing/when_doing.ts').map(rule => rule.name);
    assert.ok(spec.includes('specs.typescript.md'), `expected the specs rule for a for_/when_ path, got ${spec.join(', ')}`);

    assert.deepEqual(rulesForPath(repositoryRoot, 'README.md'), []);
});

test('managed Pi glob dialect covers the forms the corpus uses', () => {
    assert.ok(globToRegExp('**/*.cs').test('Source/A/B.cs'));
    assert.ok(globToRegExp('**/*.cs').test('B.cs'));
    assert.ok(!globToRegExp('**/*.cs').test('Source/B.ts'));
    assert.ok(globToRegExp('**/Documentation/**/*.{md,mdx}').test('Documentation/x.mdx'));
    assert.ok(globToRegExp('**/Documentation/**/*.{md,mdx}').test('Source/Documentation/a/b.md'));
    assert.ok(!globToRegExp('**/Documentation/**/*.{md,mdx}').test('Docs/a.md'));
    assert.ok(globToRegExp('**/for_*/**/*.cs').test('Specs/for_Thing/when_x/given_y.cs'));
    assert.ok(!globToRegExp('**/for_*/**/*.cs').test('Specs/Thing/when_x.cs'));
});

test('managed Pi drops profile-specific rules the repository does not select', () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-pi-'));
    try {
        mkdirSync(join(project, '.cratis'));
        writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify({ profiles: ['cratis/engineering/csharp', 'cratis/documentation'] }));
        const names = managedRules(project).map(rule => rule.name);
        assert.ok(names.includes('framework.md'));

        writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify({ profiles: ['cratis/application/csharp'] }));
        const application = managedRules(project).map(rule => rule.name);
        assert.ok(application.includes('general.md'));
        assert.ok(!application.includes('framework.md'));
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('managed Pi cratis-rules injects only the universal rules and delivers no path-scoped rule', () => {
    const handlers = new Map<string, (event: unknown, context: { cwd: string }) => unknown>();
    registerManagedRules({
        on(name: string, handler: (event: unknown, context: { cwd: string }) => unknown) {
            handlers.set(name, handler);
        },
    } as unknown as ExtensionAPI);
    assert.deepEqual([...handlers.keys()], ['before_agent_start'], 'path delivery lives in cratis-path-guidance');
    const context = { cwd: repositoryRoot };
    const prompt = handlers.get('before_agent_start')?.({ cwd: repositoryRoot, systemPrompt: 'base' }, context) as { systemPrompt: string };
    assert.match(prompt.systemPrompt, /^base\n\n/);
    assert.match(prompt.systemPrompt, /# Working with Cratis/);
    assert.doesNotMatch(prompt.systemPrompt, /# Platform sources/);
});

test('Cratis quality hooks register an explicit gate but no automatic turn-end continuation', () => {
    const handlers: string[] = [];
    const tools: string[] = [];
    registerCratisHooks({
        on(name: string) { handlers.push(name); },
        registerTool(tool: { name: string }) { tools.push(tool.name); },
        sendMessage() { assert.fail('quality hooks must not request a follow-up'); },
        sendUserMessage() { assert.fail('quality hooks must not request a follow-up'); },
    } as unknown as ExtensionAPI);
    assert.ok(tools.includes('cratis_quality_gate'));
    assert.deepEqual(handlers.sort(), ['session_shutdown', 'session_start', 'tool_call', 'tool_result']);
});

test('the Pi package prompt and path guidance select the same rules for every language and documentation choice', () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-pi-'));
    try {
        mkdirSync(join(project, '.cratis'));
        for (const configuration of [
            { profiles: ['cratis/engineering/csharp'], languages: ['csharp'] },
            { profiles: ['cratis/engineering/typescript'], languages: ['typescript'] },
            { profiles: ['cratis/engineering/go'], languages: ['go'] },
            { profiles: ['cratis/application/csharp', 'cratis/documentation'], languages: ['csharp', 'typescript'] },
            { profiles: ['cratis/application/csharp'], languages: [] },
        ]) {
            writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify(configuration));
            const result = pluginHandlers().get('before_agent_start')?.({ cwd: project, systemPrompt: 'base' }, { cwd: project }) as { systemPrompt: string };
            assert.equal(result.systemPrompt, `base\n\n${universalRules(project).map(rule => rule.content).join('\n\n')}`, JSON.stringify(configuration));
        }
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('the Pi package system prompt carries exactly the universal rules so path guidance never duplicates it', () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-pi-'));
    try {
        const result = pluginHandlers().get('before_agent_start')?.({ cwd: project, systemPrompt: 'base' }, { cwd: project }) as { systemPrompt: string };
        assert.equal(result.systemPrompt, `base\n\n${universalRules(project).map(rule => rule.content).join('\n\n')}`);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

// The cases below run the shipped loader over a synthetic corpus (see pi-package.fixture.ts), so they state the
// selection behaviour itself and do not move when the real rules, skills or profiles are renamed.
const piPackage = await createPiPackage();
after(() => piPackage.dispose());

function inProject<T>(configuration: AiConfiguration | undefined, action: (project: string) => T): T {
    const project = createProject(configuration);
    try {
        return action(project);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
}

const allRules = Object.keys(ruleFixtures);
const without = (...excluded: string[]) => allRules.filter(name => !excluded.includes(name));
const unprofiled = without('application.md', 'framework.md', 'framework-always.md', 'optional.md');
const applicationRules = without('framework.md', 'framework-always.md', 'optional.md');

const ruleSelections: Array<{ reason: string; configuration?: AiConfiguration; rules: string[] }> = [
    { reason: 'no configuration keeps every rule', rules: allRules },
    { reason: 'an application profile drops framework and opt-in rules', configuration: { profiles: ['cratis/application/csharp'] }, rules: applicationRules },
    { reason: 'a composing profile inherits the application rules but not the opt-in ones', configuration: { profiles: ['cratis'] }, rules: applicationRules },
    { reason: 'an empty language list filters nothing', configuration: { profiles: ['cratis/full'], languages: [] }, rules: applicationRules },
    { reason: 'an engineering profile selects the framework rules', configuration: { profiles: ['cratis/engineering/csharp'] }, rules: without('application.md', 'optional.md') },
    { reason: 'an opt-in profile selects its own rule', configuration: { profiles: ['cratis/optional'] }, rules: [...unprofiled, 'optional.md'].sort() },
    { reason: 'a profile nested under the opt-in profile selects its rule', configuration: { profiles: ['cratis/optional/team'] }, rules: [...unprofiled, 'optional.md'].sort() },
    { reason: 'a profile that merely shares the opt-in prefix does not', configuration: { profiles: ['cratis/optional-other'] }, rules: unprofiled },
    { reason: 'no profiles keeps only rules without a profile', configuration: { profiles: [] }, rules: unprofiled },
    { reason: 'opting in beside a composing profile adds only the opt-in rule', configuration: { profiles: ['cratis/full', 'cratis/optional'] }, rules: without('framework.md', 'framework-always.md') },
    { reason: 'a selected language drops rules scoped to other languages and to documentation', configuration: { profiles: ['cratis/application/csharp'], languages: ['csharp'] }, rules: ['always.md', 'application.md', 'csharp.md', 'everywhere.md', 'model.md'] },
    { reason: 'the documentation profile keeps documentation rules', configuration: { profiles: ['cratis/application/typescript', 'cratis/documentation'], languages: ['typescript'] }, rules: ['always.md', 'application.md', 'documentation.md', 'everywhere.md', 'model.md', 'typescript.md'] },
    { reason: 'a composed documentation profile counts as selected', configuration: { profiles: ['cratis'], languages: ['csharp'] }, rules: ['always.md', 'application.md', 'csharp.md', 'documentation.md', 'everywhere.md', 'model.md'] },
    { reason: 'a rule naming only unselected languages is dropped even when its profile is selected', configuration: { profiles: ['cratis/engineering/csharp'], languages: ['go'] }, rules: ['always.md', 'everywhere.md', 'framework-always.md', 'go.md', 'model.md'] },
];

for (const { reason, configuration, rules } of ruleSelections) {
    test(`the Pi package scopes rules by profile, composition and language: ${reason}`, () => {
        inProject(configuration, project => {
            assert.deepEqual(piPackage.managedRules(project).map(rule => rule.name), rules);

            const universal = rules.filter(name => universalRuleNames.includes(name));
            const prompt = pluginHandlers(piPackage.register).get('before_agent_start')?.({ cwd: project, systemPrompt: 'base' }, { cwd: project }) as { systemPrompt: string };
            assert.equal(prompt.systemPrompt, `base\n\n${universal.map(ruleContent).join('\n\n')}`, 'the system prompt carries exactly the selected universal rules');

            for (const [path, matching] of Object.entries(rulesMatchingPath)) {
                const delivered = piPackage.rulesForPath(project, path).map(rule => rule.name);
                assert.deepEqual(delivered, matching.filter(name => rules.includes(name)), `${path}: only selected rules whose scope matches reach the file`);
            }
        });
    });
}

const skillSelections: Array<{ reason: string; configuration?: AiConfiguration; skills: string[] }> = [
    { reason: 'no configuration exposes every catalog skill', skills: skillNames },
    { reason: 'no profiles exposes nothing', configuration: { profiles: [] }, skills: [] },
    { reason: 'a composing profile reaches every composed profile when languages are unspecified', configuration: { profiles: ['cratis'] }, skills: ['demo-application', 'demo-csharp', 'demo-documentation', 'demo-typescript'] },
    { reason: 'composition follows only the selected languages and language-agnostic profiles', configuration: { profiles: ['cratis'], languages: ['typescript'] }, skills: ['demo-application', 'demo-documentation', 'demo-typescript'] },
    { reason: 'several languages compose each of their profiles', configuration: { profiles: ['cratis/application'], languages: ['csharp', 'typescript'] }, skills: ['demo-application', 'demo-csharp', 'demo-typescript'] },
    { reason: 'an explicitly selected profile is kept whatever the languages', configuration: { profiles: ['cratis/application/csharp'], languages: ['typescript'] }, skills: ['demo-csharp'] },
    { reason: 'an engineering profile composes its language-agnostic core', configuration: { profiles: ['cratis/engineering/csharp'], languages: ['csharp'] }, skills: ['demo-engineering', 'demo-engineering-csharp'] },
    { reason: 'the opt-in profile resolves only its own skills', configuration: { profiles: ['cratis/optional'] }, skills: ['demo-optional'] },
    { reason: 'opting in beside a composing profile adds the opt-in skills', configuration: { profiles: ['cratis/full', 'cratis/optional'], languages: ['csharp'] }, skills: ['demo-application', 'demo-csharp', 'demo-documentation', 'demo-optional'] },
];

for (const { reason, configuration, skills } of skillSelections) {
    test(`the Pi package resolves skills through profile composition: ${reason}`, () => {
        inProject(configuration, project => {
            const discovered = pluginHandlers(piPackage.register).get('resources_discover')?.({ cwd: project, systemPrompt: '' }, { cwd: project }) as { skillPaths: string[] };
            assert.deepEqual(discovered.skillPaths, skills.map(name => join(piPackage.corpus, 'skills', name)));
            assert.ok(discovered.skillPaths.every(existsSync));
            assert.deepEqual(piPackage.selectedSkillNames(project), skills, 'path guidance hints exactly the skills the package loads');
        });
    });
}

test('the Pi package rejects a profile the catalog does not define, and path guidance then hints nothing', () => {
    inProject({ profiles: ['cratis/unknown'] }, project => {
        assert.throws(() => piPackage.selectedSkillPaths(project), /Unknown Cratis AI profile 'cratis\/unknown'/);
        assert.equal(piPackage.selectedSkillNames(project), undefined);
    });
});

test('the Pi package yields to a managed CLI installation and resumes when it is removed, without writing project files', () => {
    const configurations: AiConfiguration[] = [{ profiles: ['cratis'], languages: ['csharp'] }, { profiles: ['cratis/optional'] }];
    inProject(undefined, project => {
        const configurationPath = join(project, '.cratis', 'ai.json');
        const marker = join(project, '.cratis', 'ai.manifest.json');
        const handlers = pluginHandlers(piPackage.register);
        const discover = () => handlers.get('resources_discover')?.({ cwd: project, systemPrompt: '' }, { cwd: project });
        const start = () => handlers.get('before_agent_start')?.({ cwd: project, systemPrompt: 'base' }, { cwd: project });
        const selections = configurations.map(configuration => {
            const written = JSON.stringify(configuration);
            writeFileSync(configurationPath, written);
            const selected = { resources: discover(), prompt: start() };
            assert.ok(selected.resources && selected.prompt, 'the package serves a repository without a managed installation');
            assert.deepEqual({ resources: discover(), prompt: start() }, selected, 'discovery has no side effects');

            writeFileSync(marker, '{}');
            assert.deepEqual({ resources: discover(), prompt: start() }, { resources: undefined, prompt: undefined }, 'the managed installation owns skills and rules');
            rmSync(marker);
            assert.deepEqual({ resources: discover(), prompt: start() }, selected, 'removing the managed marker restores the package selection');
            assert.equal(readFileSync(configurationPath, 'utf8'), written);
            return selected;
        });
        assert.notDeepEqual(selections[0], selections[1], 'a configuration update changes the selection in the same session');
        assert.equal(existsSync(join(project, '.cratis', 'ai')), false, 'the package discovers its own resources; it installs no corpus');
    });
});

test('a CLI-managed installation filters its installed rules by profile but trusts their language scopes', () => {
    inProject({ profiles: ['cratis/application/csharp'], languages: ['csharp'] }, project => {
        writeRules(join(project, '.cratis', 'ai', 'rules'), ['application.md', 'csharp.md', 'framework.md', 'typescript.md']);
        writeFileSync(join(project, '.cratis', 'ai.manifest.json'), '{}');
        assert.deepEqual(piPackage.managedRules(project).map(rule => rule.name), ['application.md', 'csharp.md', 'typescript.md'], 'the CLI already resolved the languages, so only the profile filter applies');
        assert.deepEqual(piPackage.rulesForPath(project, 'Source/thing.ts').map(rule => rule.name), ['application.md', 'typescript.md']);
        assert.equal(pluginHandlers(piPackage.register).get('before_agent_start')?.({ cwd: project, systemPrompt: 'base' }, { cwd: project }), undefined, 'the managed installation owns rule delivery');
    });
});
