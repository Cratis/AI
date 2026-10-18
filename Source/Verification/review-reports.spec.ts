// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { skillBody } from './skill-structure.ts';
import { selectedSkillPaths } from '../Pi.Plugin/src/index.ts';
import { frontmatter } from '../../.cratis/ai/harnesses/pi/extensions/shared/frontmatter.ts';
import { managedRules, rulesForPath, universalRules } from '../../.cratis/ai/harnesses/pi/extensions/shared/rules.ts';

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
        'Any blocker means Changes requested;',
        'otherwise any Incomplete review means Incomplete;',
        'otherwise any remaining suggestion\nmeans Approved with suggestions;',
        'Do not drop dismissals or\nscope limits when combining reports.',
    ]) assert.ok(rule.includes(text), text);
});

test('all three skills and four reviewer agents reference the shared contract without old report vocabularies', () => {
    const paths = [...skills.map(skill => `skills/${skill}/SKILL.md`), ...agents.map(agent => `agents/${agent}.md`)];
    for (const path of paths) {
        const content = read(path);
        assert.ok(content.includes('.cratis/ai/rules/review-reports.md'), path);
        assert.ok(!content.includes('../../rules/review-reports.md'), path);
        assert.doesNotMatch(content, /Approved with comments|Low-risk findings|Minor findings|Blocking issues found/, path);
        if (path.endsWith('/SKILL.md')) assert.ok(skillBody(content).length <= 16_000, path);
    }
});

test('review prompts and coordinating agents preserve the shared report and aggregation contract', () => {
    const paths = [
        ...['code-review', 'review-pr', 'review-skill'].map(name => `prompts/${name}.prompt.md`),
        ...['orchestrator', 'coordinator', 'planner'].map(name => `agents/${name}.md`),
    ];
    for (const path of paths) {
        const content = read(path);
        assert.ok(content.includes('.cratis/ai/rules/review-reports.md'), path);
        assert.doesNotMatch(content, /Approved with comments|Blocking issues found|finds no vulnerabilities/, path);
    }
    const pullRequest = read('prompts/review-pr.prompt.md');
    assert.ok(pullRequest.includes('one report per reviewer'));
    assert.ok(pullRequest.includes('shared aggregation rule'));
    assert.ok(pullRequest.includes('dismissals, and scope limits'));
});

test('review rule scopes survive CLI language classification without requiring documentation', () => {
    const fields = frontmatter(rule);
    assert.ok(!fields.has('profile'), 'the shared report is not tied to a profile');
    for (const key of ['applyTo', 'paths']) {
        const scopes = fields.get(key)!;
        assert.ok(scopes.length > 0, key);
        assert.ok(scopes.every(scope => scope.startsWith('.cratis/ai/')), key);
        // CLI classifies rule requirements from literal language tokens in applyTo.
        // Keep both harness scope forms free of those tokens, not just *.cs/*.ts globs.
        for (const scope of scopes) assert.doesNotMatch(scope, /\.cs|\.ts|\.go|go\.mod|go\.sum|\.kt|\.java|\.ex|md/i, scope);
    }
});

test('packaged Pi selects and path-delivers shared reports for review profiles without documentation', () => {
    const workspace = resolve(import.meta.dirname, '../../.ai-work');
    mkdirSync(workspace, { recursive: true });
    const project = mkdtempSync(join(workspace, 'review-selection-'));
    try {
        mkdirSync(join(project, '.cratis'));
        for (const language of ['csharp', 'typescript']) {
            writeFileSync(join(project, '.cratis/ai.json'), JSON.stringify({ profiles: ['cratis/review'], languages: [language] }));
            for (const skill of skills) assert.ok(selectedSkillPaths(project).some(path => path.endsWith(`/${skill}`)), `${language}: ${skill}`);
            assert.ok(managedRules(project).some(rule => rule.name === 'review-reports.md'), language);
            assert.ok(!universalRules(project).some(rule => rule.name === 'review-reports.md'), language);
            for (const path of [
                ...skills.map(skill => `skills/${skill}/SKILL.md`),
                ...[...agents, 'orchestrator', 'planner', 'coordinator'].map(agent => `agents/${agent}.md`),
                'prompts/review-pr.prompt.md',
            ]) assert.ok(rulesForPath(project, `.cratis/ai/${path}`).some(rule => rule.name === 'review-reports.md'), `${language}: ${path}`);
            assert.ok(!rulesForPath(project, 'Source/Thing.cs').some(rule => rule.name === 'review-reports.md'), language);
        }
    } finally {
        rmSync(project, { recursive: true, force: true });
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
