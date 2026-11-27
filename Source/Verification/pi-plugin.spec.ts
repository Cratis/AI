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

const arcTypeScriptServerSkills = ['cratis-arc-command-typescript', 'cratis-arc-query-typescript', 'cratis-arc-validation-typescript', 'cratis-arc-tenancy-typescript', 'cratis-arc-storage-typescript', 'cratis-arc-testing-typescript', 'cratis-arc-code-analysis-typescript'];

function resolvedSkills(configuration: { profiles: string[]; languages?: string[] }): (string | undefined)[] {
    const project = mkdtempSync(join(tmpdir(), 'cratis-pi-'));
    try {
        mkdirSync(join(project, '.cratis'));
        writeFileSync(join(project, '.cratis', 'ai.json'), JSON.stringify(configuration));
        return selectedSkillPaths(project).map(path => path.split('/').pop());
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
}

test('Pi does not load the Arc for TypeScript server skills into C# applications with a React frontend', () => {
    for (const configuration of [
        { profiles: ['cratis/application/csharp'], languages: ['csharp', 'typescript'] },
        { profiles: ['cratis/application'] },
        { profiles: ['cratis/application'], languages: ['csharp', 'typescript'] },
        { profiles: ['cratis/arc'], languages: ['csharp', 'typescript'] },
        { profiles: ['cratis/application/typescript'], languages: ['typescript'] },
    ]) {
        const names = resolvedSkills(configuration);
        for (const skill of arcTypeScriptServerSkills) {
            assert.ok(!names.includes(skill), `${JSON.stringify(configuration)}: ${skill}`);
        }
    }
});
