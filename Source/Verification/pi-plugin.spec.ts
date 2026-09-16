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
import registerManagedRules, { globToRegExp, managedRules, rulesForPath, universalRules } from '../../.cratis/ai/harnesses/pi/extensions/cratis-rules/index.ts';

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

test('managed Pi delivers a scoped rule once per session when its file is touched', () => {
    const handlers = new Map<string, (event: unknown, context: { cwd: string }) => unknown>();
    registerManagedRules({
        on(name: string, handler: (event: unknown, context: { cwd: string }) => unknown) {
            handlers.set(name, handler);
        },
    } as unknown as ExtensionAPI);
    const context = { cwd: repositoryRoot };
    const prompt = handlers.get('before_agent_start')?.({ cwd: repositoryRoot, systemPrompt: 'base' }, context) as { systemPrompt: string };
    assert.match(prompt.systemPrompt, /^base\n\n/);
    assert.doesNotMatch(prompt.systemPrompt, /# C# Conventions/);

    const touch = (path: string, toolName = 'read') => handlers.get('tool_result')?.({ toolName, isError: false, input: { path }, content: [] }, context) as { content: Array<{ text: string }> } | undefined;
    const first = touch('Source/Thing.cs');
    assert.ok(first, 'expected the C# rules to be attached on first touch');
    assert.match(first.content.map(part => part.text).join(''), /# C# Conventions/);
    assert.equal(touch('Source/Other.cs'), undefined, 'the same rules must not be delivered twice in a session');
    assert.equal(touch('README.md'), undefined);
    assert.equal(touch('../outside.cs'), undefined);

    handlers.get('session_start')?.({}, context);
    assert.ok(touch('Source/Thing.cs'), 'a new session delivers the rules again');
});

test('managed Pi delivers scoped rules for files touched through bash', () => {
    const project = mkdtempSync(join(tmpdir(), 'cratis-pi-'));
    try {
        mkdirSync(join(project, 'Source'), { recursive: true });
        writeFileSync(join(project, 'Source', 'Thing.cs'), 'class Thing {}');
        writeFileSync(join(project, 'README.md'), '# readme');
        const handlers = new Map<string, (event: unknown, context: { cwd: string }) => unknown>();
        registerManagedRules({
            on(name: string, handler: (event: unknown, context: { cwd: string }) => unknown) {
                handlers.set(name, handler);
            },
        } as unknown as ExtensionAPI);
        const context = { cwd: project };
        const bash = (command: string) => handlers.get('tool_result')?.({ toolName: 'bash', isError: false, input: { command }, content: [] }, context) as { content: Array<{ text: string }> } | undefined;

        // rtk.md directs bulk reads through the terminal, so this is how many sessions read source.
        const viaRtk = bash('rtk read Source/Thing.cs');
        assert.ok(viaRtk, 'a bash read of a .cs file must deliver the C# rules');
        assert.match(viaRtk.content.map(part => part.text).join(''), /# C# Conventions/);
        assert.equal(bash('cat Source/Thing.cs'), undefined, 'already delivered this session');

        handlers.get('session_start')?.({}, context);
        assert.ok(bash('grep -n "Thing" Source/Thing.cs'), 'grep with flags still finds the path');

        handlers.get('session_start')?.({}, context);
        assert.equal(bash('npm test'), undefined, 'a command with no file path delivers nothing');
        assert.equal(bash('git commit -m "fix Source/Missing.cs"'), undefined, 'a filename that does not exist is not a touch');
        assert.equal(bash('cat README.md'), undefined, 'no scoped rule matches README.md');
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
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

test('Cratis quality hooks do not continue a completed noninteractive session', async () => {
    let settled: ((event: unknown, context: { mode: string }) => Promise<void>) | undefined;
    registerCratisHooks({
        on(name: string, handler: unknown) {
            if (name === 'agent_settled') settled = handler as typeof settled;
        },
    } as unknown as ExtensionAPI);
    assert.ok(settled);
    await assert.doesNotReject(() => settled!({}, { mode: 'print' }));
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
        assert.match(result.systemPrompt, /# C# Conventions/);
        assert.match(result.systemPrompt, /# How to write documentation/);
        assert.doesNotMatch(result.systemPrompt, /# Vertical Slice Architecture/);
        assert.doesNotMatch(result.systemPrompt, /# TypeScript Conventions/);
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
