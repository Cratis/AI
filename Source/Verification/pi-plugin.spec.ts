// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import registerPiPlugin, { selectedSkillPaths } from '../Pi.Plugin/src/index.ts';
import { managedRules } from '../../.cratis/ai/harnesses/pi/extensions/cratis-rules/index.ts';

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

test('managed Pi loads general and task-specific rules from the canonical corpus', () => {
    const rules = managedRules(repositoryRoot);
    assert.match(rules, /# Cratis — Project Instructions/);
    assert.match(rules, /# C# Conventions/);
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
