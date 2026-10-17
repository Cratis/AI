// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { skillBody } from './skill-structure.ts';

const corpus = resolve(import.meta.dirname, '../../.cratis/ai');
const read = (path: string) => readFileSync(join(corpus, path), 'utf8');
const rule = read('rules/review-reports.md');
const skills = ['cratis-code-review', 'cratis-security-review', 'cratis-performance-review'];
const agents = ['code-reviewer', 'security-reviewer', 'performance-reviewer', 'repository-investigation-reviewer'];

test('one report contract defines ordered sections, scope limits, and shared verdicts', () => {
    const sections = [...rule.matchAll(/^- \*\*([^*]+)\*\* —/gm)].map(match => match[1]);
    assert.deepEqual(sections, ['Blockers', 'Suggestions', 'Dismissed (with reason)', 'Verdict']);
    for (const text of [
        'An empty Blockers section is a valid, complete review.',
        'A blocker names a consequence, not a rule number',
        'Reserve **[BLOCKING]** exclusively for\nmust-fix-before-merge findings',
        '**Not examined:**',
        'not measured: code-shape inspection is not a benchmark',
        '**Approved**', '**Approved with suggestions**', '**Changes requested**', '**Incomplete**',
        'Missing required evidence does.',
        'preserve its schema',
    ]) assert.ok(rule.includes(text), text);
});

test('all three skills and four reviewer agents reference the shared contract without old report vocabularies', () => {
    const paths = [...skills.map(skill => `skills/${skill}/SKILL.md`), ...agents.map(agent => `agents/${agent}.md`)];
    for (const path of paths) {
        const content = read(path);
        const pointer = path.startsWith('skills/') ? '../../rules/review-reports.md' : '.cratis/ai/rules/review-reports.md';
        assert.ok(content.includes(pointer), path);
        assert.doesNotMatch(content, /Approved with comments|Low-risk findings|Minor findings|Blocking issues found/, path);
        if (path.endsWith('/SKILL.md')) assert.ok(skillBody(content).length <= 16_000, path);
    }
});

test('specialist agents reuse their skills risk mappings instead of defining competing tables', () => {
    for (const domain of ['code', 'security', 'performance']) {
        const content = read(`agents/${domain}-reviewer.md`);
        assert.ok(content.includes(`.cratis/ai/skills/cratis-${domain}-review/SKILL.md`), domain);
        assert.doesNotMatch(content, /## Risk classification/, domain);
    }
    const investigation = read('agents/repository-investigation-reviewer.md');
    assert.ok(investigation.includes('Return only the requested typed review'));
    assert.ok(investigation.includes('preserve its schema and blocked or inconclusive states'));
});
