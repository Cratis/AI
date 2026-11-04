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

test('version guidance distinguishes ordinary installation from deliberate reproducibility', () => {
    const rule = readFileSync(join(corpus, 'rules/documentation.md'), 'utf8');
    const examples = readFileSync(join(corpus, 'skills/cratis-technical-examples/SKILL.md'), 'utf8');
    for (const content of [rule, examples]) {
        assert.match(content, /supported latest-release/);
        assert.match(content, /reproducib/);
        assert.match(content, /security/);
        assert.match(content, /deployment/);
    }
    assert.doesNotMatch(rule, /pin what the reader runs/);
    assert.doesNotMatch(examples, /part of the command, not a note, and stays/);
});

test('site presentation guidance owns format choices and export limitations', () => {
    const site = readFileSync(join(corpus, 'skills', canonical, 'references/cratis-site.md'), 'utf8');
    const format = readFileSync(join(corpus, 'skills/cratis-engineering-docs-authoring/references/site-format.md'), 'utf8');
    assert.ok(format.includes('../cratis-documentation-writing/references/cratis-site.md'));
    for (const component of ['Steps', 'Tabs', 'Card', 'Mermaid', 'LinkCard', 'Aside', 'FullStackTabs']) {
        assert.ok(site.includes(component), `missing supported presentation boundary: ${component}`);
    }
    assert.match(site, /prose\/children/);
    assert.match(site, /canonical URL/);
    assert.doesNotMatch(site, /mirror behind "Copy Markdown" keeps its\s+imports and JSX/);
    assert.doesNotMatch(site, /Two independently readable alternatives \(C# and TypeScript\)/);
});

test('reader review selects relevant perspectives without creating a mandatory review board', () => {
    const review = readFileSync(join(corpus, 'skills', canonical, 'references/reader-review.md'), 'utf8');
    for (const lens of ['Newcomer', 'Experienced developer', 'Operator', 'AI/text reader', 'Security/trust boundary', 'Accessibility/visual/editorial']) {
        assert.ok(review.includes(lens), `missing conditional reader lens: ${lens}`);
    }
    assert.match(review, /One reviewer may cover several/);
    assert.match(review, /not a mandatory review board/);
    assert.match(review, /source-backed recovery/);
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
        assert.match(content, /read and (?:apply|use)|work through/i, entryPoint);
    }
    // Local links must resolve even when the reference is shipped with a profile.
    const content = readFileSync(reference, 'utf8');
    for (const match of content.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
        if (!match[1].startsWith('https://')) {
            assert.ok(existsSync(resolve(reference, '..', match[1])), `missing explanation reference: ${match[1]}`);
        }
    }
});
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
