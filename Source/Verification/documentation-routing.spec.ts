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

// These checks protect routing and reference structure, not reader comprehension or model behavior.
test('the documentation prompt requires applicable skill reads before drafting', () => {
    const prompt = readFileSync(join(corpus, 'prompts/write-documentation.prompt.md'), 'utf8');
    const preparation = prompt.slice(0, prompt.indexOf('## Determine the reader'));
    assert.match(preparation, /Read the actual applicable `SKILL\.md` files before drafting/);
    for (const skill of [canonical, 'cratis-engineering-docs-authoring', 'cratis-technical-examples', 'cratis-llm-friendly-documentation', 'cratis-writing-voice-and-cadence']) {
        assert.ok(preparation.includes(`skills/${skill}/SKILL.md`), `missing read route for ${skill}`);
    }
    assert.match(preparation, /paths, source revision, and observed read order/);
    assert.match(preparation, /availability or invocation alone is not a read/);
});

test('reader review has one canonical procedure with separate evidence levels', () => {
    const skill = readFileSync(join(corpus, 'skills', canonical, 'SKILL.md'), 'utf8');
    assert.match(skill, /\(references\/reader-review\.md\)/);
    const review = readFileSync(join(corpus, 'skills', canonical, 'references/reader-review.md'), 'utf8');
    assert.match(review, /not the author's\s+answers/);
    for (const level of ['Comprehension', 'Source checking', 'Compilation', 'Runtime', 'Deployed']) {
        assert.ok(review.includes(`| ${level} |`), `missing evidence boundary: ${level}`);
    }
    assert.match(review, /smallest gap/);
    assert.match(review, /not a public verification\s+receipt/);
    for (const specialist of ['cratis-engineering-docs-authoring', 'cratis-technical-examples', 'cratis-llm-friendly-documentation', 'cratis-writing-voice-and-cadence']) {
        const content = readFileSync(join(corpus, 'skills', specialist, 'SKILL.md'), 'utf8');
        assert.ok(content.includes('(../cratis-documentation-writing/references/reader-review.md)'), `${specialist} must route to the shared review`);
        assert.ok(content.includes('(../../rules/documentation.md)'), `${specialist} must route to the naming and claims owner`);
    }
});

test('the shared documentation rule owns Platform naming without renaming APIs', () => {
    const rule = readFileSync(join(corpus, 'rules/documentation.md'), 'utf8');
    assert.match(rule, /\*\*Cratis\*\* is the organization/);
    assert.match(rule, /\*\*Cratis Platform\*\* is the umbrella offering/);
    assert.match(rule, /adopt one component independently/);
    assert.match(rule, /literal package IDs and API names/);
    assert.match(rule, /authoritative source for capability, compatibility, dependency and maturity/);
});
