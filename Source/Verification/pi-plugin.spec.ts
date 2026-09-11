// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { selectedSkillPaths } from '../Pi.Plugin/src/index.ts';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');

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
