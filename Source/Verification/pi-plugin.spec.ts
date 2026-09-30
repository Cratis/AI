// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import registerPiPlugin, { selectedSkillPaths } from '../Pi.Plugin/src/index.ts';
import registerCratisHooks from '../../.cratis/ai/harnesses/pi/extensions/cratis-hooks/index.ts';
import registerManagedRules from '../../.cratis/ai/harnesses/pi/extensions/cratis-rules/index.ts';
import { globToRegExp } from '../../.cratis/ai/harnesses/pi/extensions/shared/globs.ts';
import { managedRules, rulesForPath, universalRules } from '../../.cratis/ai/harnesses/pi/extensions/shared/rules.ts';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
type Handler = (event: { cwd: string; systemPrompt: string }, context: { cwd: string }) => unknown;

function pluginHandlers(): Map<string, Handler> {
    const handlers = new Map<string, Handler>();
    registerPiPlugin({
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
    assert.match(prompt, /# Cratis — Project Instructions/);
    assert.match(prompt, /# Verification Discipline/);
    assert.doesNotMatch(prompt, /# C# Conventions/);
    assert.doesNotMatch(prompt, /# Code Quality — C#/);
    assert.doesNotMatch(prompt, /# TypeScript Conventions/);
    assert.ok(universalRules(repositoryRoot).length < managedRules(repositoryRoot).length);
});

test('managed Pi attaches path-scoped rules by applyTo and paths', () => {
    const csharp = rulesForPath(repositoryRoot, 'Source/Thing/Thing.cs').map(rule => rule.content).join('\n\n');
    assert.match(csharp, /# C# Conventions/);
    assert.doesNotMatch(csharp, /# TypeScript Conventions/);
    assert.doesNotMatch(csharp, /# Cratis — Project Instructions/);

    const spec = rulesForPath(repositoryRoot, 'Specifications/for_Thing/when_doing.cs').map(rule => rule.name);
    assert.ok(spec.some(name => name.startsWith('specs')), `expected a specs rule for a for_/when_ path, got ${spec.join(', ')}`);

    const docs = rulesForPath(repositoryRoot, 'Documentation/guide/page.md').map(rule => rule.content).join('\n\n');
    assert.match(docs, /# How to write documentation/);
    assert.doesNotMatch(docs, /# C# Conventions/);

    assert.equal(rulesForPath(repositoryRoot, 'README.md').some(rule => /# C# Conventions/.test(rule.content)), false);
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
        assert.ok(!names.includes('vertical-slices.md'));
        assert.ok(!names.includes('react.md'));

        writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify({ profiles: ['cratis/application/csharp'] }));
        const application = managedRules(project).map(rule => rule.name);
        assert.ok(application.includes('vertical-slices.md'));
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
    assert.match(prompt.systemPrompt, /# Cratis — Project Instructions/);
    assert.doesNotMatch(prompt.systemPrompt, /# C# Conventions/);
});

test('Pi package rules exclude owning-repository guidance and approval ceremonies', () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-pi-'));
    try {
        const handlers = pluginHandlers();
        const result = handlers.get('before_agent_start')?.({ cwd: project, systemPrompt: 'base' }, { cwd: project }) as { systemPrompt: string };
        assert.doesNotMatch(result.systemPrompt, /Source\/Harness\.Setup|Source\/Verification|In this repository specifically/);
        assert.match(result.systemPrompt, /The user\s+is sufficient authority/);
        assert.match(result.systemPrompt, /never require a second approver/);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('the Pi package yields to a managed CLI installation', () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-pi-'));
    try {
        mkdirSync(join(project, '.cratis'));
        writeFileSync(join(project, '.cratis', 'ai.manifest.json'), '{}');
        const handlers = pluginHandlers();
        const resources = handlers.get('resources_discover')?.({ cwd: project, systemPrompt: '' }, { cwd: project });
        const prompt = handlers.get('before_agent_start')?.({ cwd: project, systemPrompt: 'base' }, { cwd: project });
        assert.equal(resources, undefined);
        assert.equal(prompt, undefined);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
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
    assert.deepEqual(handlers.sort(), ['session_shutdown', 'tool_call', 'tool_result']);
});

test('the Pi package filters rules for framework CSharp documentation repositories', () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-pi-'));
    try {
        mkdirSync(join(project, '.cratis'));
        writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify({
            profiles: ['cratis/engineering/csharp', 'cratis/documentation'],
            languages: ['csharp'],
        }));
        const handlers = pluginHandlers();
        const result = handlers.get('before_agent_start')?.({ cwd: project, systemPrompt: 'base' }, { cwd: project }) as { systemPrompt: string };
        assert.match(result.systemPrompt, /# Framework Profile/);
        assert.doesNotMatch(result.systemPrompt, /# Vertical Slice Architecture/);
        assert.doesNotMatch(result.systemPrompt, /# TypeScript Conventions/);
        // Path-scoped rules are delivered by the packaged cratis-path-guidance extension, not the system prompt.
        assert.doesNotMatch(result.systemPrompt, /# C# Conventions/);
        assert.doesNotMatch(result.systemPrompt, /# How to write documentation/);
        // The same selection applies to the rules path guidance delivers: csharp and documentation are selected...
        assert.ok(rulesForPath(project, 'Source/Thing.cs').some(rule => /# C# Conventions/.test(rule.content)));
        assert.ok(rulesForPath(project, 'Documentation/page.md').some(rule => /# How to write documentation/.test(rule.content)));
        // ...typescript is not, so no TypeScript rule reaches a .ts file.
        assert.deepEqual(rulesForPath(project, 'Source/Thing.ts').map(rule => rule.name), []);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('path-scoped rules from the packaged corpus follow the selected languages and documentation', () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-pi-'));
    try {
        mkdirSync(join(project, '.cratis'));
        const configure = (configuration: object) => writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify(configuration));

        configure({ profiles: ['cratis/engineering/csharp'], languages: ['csharp'] });
        assert.ok(rulesForPath(project, 'Source/Thing.cs').length > 0, 'csharp is selected');
        assert.deepEqual(rulesForPath(project, 'Source/Thing.ts').map(rule => rule.name), [], 'no TypeScript rules for a csharp-only repository');
        assert.deepEqual(rulesForPath(project, 'Documentation/page.md').map(rule => rule.name), [], 'no documentation rules without cratis/documentation');

        configure({ profiles: ['cratis/engineering/typescript', 'cratis/documentation'], languages: ['typescript'] });
        assert.ok(rulesForPath(project, 'Source/Thing.ts').length > 0, 'typescript is selected');
        assert.deepEqual(rulesForPath(project, 'Source/Thing.cs').map(rule => rule.name), [], 'no C# rules for a typescript-only repository');
        assert.ok(rulesForPath(project, 'Documentation/page.md').length > 0, 'cratis/documentation is selected');

        rmSync(join(project, '.cratis', 'ai.json'));
        assert.ok(rulesForPath(project, 'Source/Thing.cs').length > 0 && rulesForPath(project, 'Source/Thing.ts').length > 0, 'no configuration keeps every rule');

        // A managed corpus is already resolved by the CLI, so the language filter does not run on it again.
        mkdirSync(join(project, '.cratis', 'ai', 'rules'), { recursive: true });
        writeFileSync(join(project, '.cratis', 'ai', 'rules', 'ts.md'), '---\napplyTo: "**/*.ts"\n---\n# Managed TypeScript rule\n');
        configure({ profiles: ['cratis/engineering/csharp'], languages: ['csharp'] });
        assert.deepEqual(rulesForPath(project, 'Source/Thing.ts').map(rule => rule.name), ['ts.md']);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('the Pi package prompt and path guidance select the same rules for every language and documentation choice', () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-pi-'));
    try {
        mkdirSync(join(project, '.cratis'));
        for (const configuration of [
            { profiles: ['cratis/engineering/csharp'], languages: ['csharp'] },
            { profiles: ['cratis/engineering/typescript'], languages: ['typescript'] },
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

test('Pi resolves configured profile composition through selected languages', () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-pi-'));
    try {
        mkdirSync(join(project, '.cratis'));
        writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify({ profiles: ['cratis/chronicle'], languages: ['typescript'] }));
        const names = selectedSkillPaths(project).map(path => path.split('/').pop());
        assert.ok(names.includes('cratis-chronicle-client-typescript'));
        assert.ok(!names.includes('cratis-chronicle-client-kotlin'));
        assert.ok(!names.includes('cratis-chronicle-client-elixir'));
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});
