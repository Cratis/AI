// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const corpus = resolve(import.meta.dirname, '../../.cratis/ai');
const canonical = 'cratis-documentation-writing';
const entryPoints = [
    'prompts/write-documentation.prompt.md',
    'agents/orchestrator.md',
];

test('documentation entry points route to the installed writing skill', () => {
    const catalog = JSON.parse(readFileSync(join(corpus, 'profile-catalog.json'), 'utf8')) as {
        publicProfiles: Array<{ id: string; availableTargets?: string[] }>;
        engineeringProfiles: Array<{ id: string; availableTargets?: string[] }>;
    };
    // Agents such as the orchestrator install regardless of profile, so the skill they name must be
    // reachable from the documentation profile and from the engineering core the engineering profiles compose.
    for (const id of ['cratis/documentation', 'cratis/engineering/core']) {
        const profile = [...catalog.publicProfiles, ...catalog.engineeringProfiles].find(candidate => candidate.id === id);
        assert.ok(profile?.availableTargets?.includes(canonical), `${id} does not expose ${canonical}`);
    }
    assert.ok(existsSync(join(corpus, 'skills', canonical, 'SKILL.md')));
    for (const entryPoint of entryPoints) {
        const content = readFileSync(join(corpus, entryPoint), 'utf8');
        assert.match(content, /cratis-documentation-writing/, entryPoint);
        assert.doesNotMatch(content, /(?:\*\*|\[)write-documentation(?:\*\*| skill\])/, entryPoint);
    }
});
