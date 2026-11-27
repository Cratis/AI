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

test('site format guidance routes to the shared presentation reference', () => {
    const format = readFileSync(join(corpus, 'skills/cratis-engineering-docs-authoring/references/site-format.md'), 'utf8');
    assert.ok(format.includes('../cratis-documentation-writing/references/cratis-site.md'));
});

// These checks protect routing and reference structure, not reader comprehension or model behavior.
test('drafting and revision entry points require the shared explanation guidance', () => {
    const authoring = 'skills/cratis-engineering-docs-authoring';
    const reference = join(corpus, authoring, 'references/explaining-code.md');
    assert.ok(existsSync(reference));
    const routes = [
        ['rules/documentation.md', '../skills/cratis-engineering-docs-authoring/references/explaining-code.md'],
        ['rules/writing-cratis-docs.md', '../skills/cratis-engineering-docs-authoring/references/explaining-code.md'],
        [`${authoring}/SKILL.md`, 'references/explaining-code.md'],
        [`skills/${canonical}/SKILL.md`, '../cratis-engineering-docs-authoring/references/explaining-code.md'],
        ['skills/cratis-writing-voice-and-cadence/SKILL.md', '../cratis-engineering-docs-authoring/references/explaining-code.md'],
    ];
    for (const [entryPoint, target] of routes) {
        const content = readFileSync(join(corpus, entryPoint), 'utf8');
        assert.ok(content.includes(`(${target})`), `${entryPoint} must route to the explanation reference`);
    }
    // Local links must resolve even when the reference is shipped with a profile.
    const content = readFileSync(reference, 'utf8');
    for (const match of content.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
        if (!match[1].startsWith('https://')) {
            assert.ok(existsSync(resolve(reference, '..', match[1])), `missing explanation reference: ${match[1]}`);
        }
    }
});

test('the documentation prompt routes to applicable skills before drafting', () => {
    const prompt = readFileSync(join(corpus, 'prompts/write-documentation.prompt.md'), 'utf8');
    const drafting = prompt.indexOf('## Determine the reader');
    assert.ok(drafting > 0, 'missing drafting section');
    const preparation = prompt.slice(0, drafting);
    for (const skill of [canonical, 'cratis-engineering-docs-authoring', 'cratis-technical-examples', 'cratis-llm-friendly-documentation', 'cratis-writing-voice-and-cadence']) {
        assert.ok(preparation.includes(`skills/${skill}/SKILL.md`), `missing read route for ${skill}`);
    }
});

test('reader review entry points route to one canonical procedure', () => {
    const skill = readFileSync(join(corpus, 'skills', canonical, 'SKILL.md'), 'utf8');
    assert.match(skill, /\(references\/reader-review\.md\)/);
    for (const specialist of ['cratis-engineering-docs-authoring', 'cratis-technical-examples', 'cratis-llm-friendly-documentation', 'cratis-writing-voice-and-cadence']) {
        const content = readFileSync(join(corpus, 'skills', specialist, 'SKILL.md'), 'utf8');
        assert.ok(content.includes('(../cratis-documentation-writing/references/reader-review.md)'), `${specialist} must route to the shared review`);
        assert.ok(content.includes('(../../rules/documentation.md)'), `${specialist} must route to the naming and claims owner`);
    }
});
