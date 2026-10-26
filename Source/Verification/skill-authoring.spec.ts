// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import test from 'node:test';
import { alwaysOnFindings, assetReachabilityFindings, instructionAuthoringFindings, skillAuthoringFindings, skillAuthoringProblems, unscopedRuleBudget } from './skill-authoring.ts';
import { evaluationBaseRevision, evaluationCoverageFindings } from './evaluation-coverage.ts';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = '.cratis/ai/skills/example/SKILL.md';
const skill = (description = 'Use when demonstrating behavior. Not for queries.', body = '') => `---\nname: example\ndescription: ${JSON.stringify(description)}\n---\n${body}`;
const rules = (content: string, path = file) => skillAuthoringFindings(path, content).map(finding => finding.rule);

test('description-when requires an anchored invocation condition, not a summary prefix', () => {
    for (const clause of ['Use when writing', 'Use before writing', 'Use when changing café labels', '  Use when writing']) {
        assert.ok(!rules(skill(clause + '. Not for queries.')).includes('description-when'), clause);
    }
    for (const clause of ['Build an example. After discovery.', 'Abuse when writing.', 'Build examples. Use when writing.', 'Load when writing.', 'Read for examples.', 'Use whenever writing.', 'Use if writing.', 'Use when', 'Use before']) {
        assert.ok(rules(skill(clause)).includes('description-when'), clause);
    }
    for (const content of ['---\nname: example\ndescription: Examples.\nmetadata:\n  description: Use when writing.\n---\n', skill('Examples.', 'Use when writing.')]) {
        assert.ok(rules(content).includes('description-when'));
    }
    const finding = skillAuthoringFindings(file, skill('Build examples. Use when writing.'))[0];
    assert.equal(finding.line, 3);
    assert.match(finding.matchedText, /Start with Use when or Use before/);
    assert.equal(skillAuthoringProblems([finding]).length, 1);
});

test('isolated positive triggers and useful sibling boundaries are both valid', () => {
    for (const clause of ['', ' Not for queries.', ' For queries use `example-query` instead.']) {
        assert.deepEqual(rules(skill('Use when writing.' + clause)), []);
    }
});

test('description voice rejects first and second person but allows domain we/our and word substrings', () => {
    for (const word of ['I', "I'll", 'my', 'you', 'your', 'YOUR']) assert.ok(rules(skill(`Use when ${word} write.`)).includes('description-voice'));
    assert.ok(!rules(skill('Use when recording our own facts; we own the young entity. Not for queries.')).includes('description-voice'));
    for (const command of ['`echo "your input"`', '``echo `my` ``', '"who am I"', "'print your input'", '“echo your input”', '‘echo my input’']) {
        assert.ok(!rules(skill(`Use when the user runs ${command}. Not for queries.`)).includes('description-voice'), command);
    }
    assert.ok(rules(skill('Use when running `echo "your input"` with your shell.')).includes('description-voice'));
    assert.ok(rules(skill("Use when I'll run the command.")).includes('description-voice'));
    assert.deepEqual(skillAuthoringFindings(file, '---\ndescription: [broken\n---\n'), []);
    assert.deepEqual(skillAuthoringFindings(file, '---\ndescription: 123\n---\n'), []);
    assert.deepEqual(skillAuthoringFindings(file, '---\nmetadata:\n  description: your\n---\n'), []);
});

test('folded and quoted YAML routing is checked at its physical description location', () => {
    const content = '---\nname: example\ndescription: >-\n  Use when writing.\n  Not for queries; your input.\n---\n';
    for (const source of [content, content.replaceAll('\n', '\r\n')]) {
        const findings = skillAuthoringFindings(file, source);
        assert.deepEqual(findings.map(finding => [finding.rule, finding.line]), [['description-voice', 3]]);
    }
    for (const scalar of ['"Use before writing café labels."', "'Use when writing café labels.'", '>\n  Use when writing\n  café labels.']) {
        assert.deepEqual(rules(`---\nname: example\ndescription: ${scalar}\n---\n`), []);
    }
});

test('description-meta extends description-version detection without using body version budgets', () => {
    for (const word of ['pinned', 'provenance', 'ledger', 'probe', 'probed', 'contradictions', 'v1.2.3']) {
        assert.ok(rules(skill(`Use when reading ${word}. Not for queries.`)).includes('description-meta'), word);
    }
    assert.deepEqual(rules(skill()), []);
    assert.ok(!rules(skill(undefined, '1.2.3')).includes('description-meta'));
});

test('body headroom counts only the body, warning only above the 16000 target', () => {
    assert.ok(!rules(skill(undefined, 'x'.repeat(16_000))).includes('body-headroom'));
    assert.ok(rules(skill(undefined, 'x'.repeat(16_001))).includes('body-headroom'));
    assert.ok(!rules(skill('Use when ' + 'x'.repeat(16_001) + '. Not for queries.')).includes('body-headroom'));
});

test('time words are bounded, skip Requires and fences, and retain physical locations in references', () => {
    const words = ['today', 'currently', 'not yet', 'yet to', 'soon', 'planned', 'upcoming', 'recently', 'as of', 'new in', 'latest'];
    for (const word of words) {
        assert.ok(rules(skill(undefined, word)).includes('time-words'));
        assert.ok(!rules(skill(undefined, `Requires ${word}\n\n\`\`\`text\n${word}\n\`\`\`\n`)).includes('time-words'));
        assert.ok(!rules(skill(undefined, `prefix${word}suffix`)).includes('time-words'));
    }
    assert.equal(skillAuthoringFindings('references/example.md', 'Example\nToday')[0].line, 2);
});

test('instruction hygiene shares version, issue, source-line and history patterns across all instruction kinds', () => {
    for (const kind of ['rules', 'agents', 'prompts']) {
        const path = `.cratis/ai/${kind}/example.md`;
        const noise = '1.2.3 Cratis/Arc#1 File.cs:42 historical today';
        assert.deepEqual(instructionAuthoringFindings(path, noise).map(finding => finding.rule), ['instruction-version', 'issue-reference', 'source-line-citation', 'history-language', 'time-words']);
        assert.deepEqual(instructionAuthoringFindings(path, `---\ndescription: ${noise}\n---\nRequires ${noise}\n~~~\n${noise}\n~~~\n`), []);
        assert.deepEqual(instructionAuthoringFindings(path, 'Describe the command and pass signal.'), []);
    }
    assert.deepEqual(instructionAuthoringFindings('Documentation/example.md', 'today 1.2.3'), []);
});

test('no-meta-docs reports named research pages and source headings, not fenced examples or topical prose', () => {
    for (const name of ['provenance', 'doc-contradictions', 'drift-and-ledger', 'release-baseline']) assert.ok(rules('', `references/${name}.md`).includes('no-meta-docs'));
    for (const heading of ['## Verified sources', '## Verified product sources']) assert.ok(rules(heading).includes('no-meta-docs'));
    assert.deepEqual(rules('~~~\n## Verified product sources\n~~~', 'references/example.md'), []);
    assert.deepEqual(rules('Verify the product before acting.', 'references/example.md'), []);
});

test('asset reachability covers every non-exempt file and exact skill-relative paths', () => {
    const paths = ['LICENSE', 'NOTICE', 'verification.json', 'references/example.md', 'assets/example.play', 'contract.json', 'contract.version', 'scripts/check.sh'];
    const body = '`assets/example.play` `contract.json` `contract.version` `scripts/check.sh`';
    assert.deepEqual(assetReachabilityFindings(file, body, paths, []), []);
    assert.equal(assetReachabilityFindings(file, '', paths, []).length, 4);
    assert.equal(assetReachabilityFindings(file, 'other-skill/assets/example.play', ['assets/example.play'], []).length, 1);
    const exceptions = [{ file: '.cratis/ai/skills/example/assets/example.play', reason: 'Another writer owns this skill; remove once linked.' }];
    assert.deepEqual(assetReachabilityFindings(file, '', ['assets/example.play'], exceptions), []);
    assert.equal(assetReachabilityFindings(file, body, ['assets/example.play'], exceptions).length, 1);
    assert.equal(assetReachabilityFindings(file, '', [], exceptions).length, 1);
    assert.equal(assetReachabilityFindings(file, '', ['assets/example.play'], [{ ...exceptions[0], reason: '' }]).length, 1);
});

test('always-on line and byte thresholds have separate required and informational verdicts', () => {
    const general = (content: string) => alwaysOnFindings([{ file: '.cratis/ai/rules/general.md', content }]);
    assert.deepEqual(general('x\n'.repeat(200)), []);
    assert.deepEqual(general('x\n'.repeat(201)).map(finding => finding.rule), ['always-on-lines']);
    assert.ok(!general('x'.repeat(24_000)).some(finding => finding.rule === 'always-on-bytes'));
    assert.ok(general('é'.repeat(12_001)).some(finding => finding.rule === 'always-on-bytes'));
    // No harness budgets, so only the unscoped-rule total is judged here.
    const unlimited = {};
    // The boundary follows the exported budget, so raising the budget cannot leave this specification behind.
    assert.ok(alwaysOnFindings([{ file: 'rules/x.md', content: 'x'.repeat(unscopedRuleBudget + 1) }], unlimited).some(finding => finding.rule === 'unscoped-rule-bytes'));
    assert.deepEqual(alwaysOnFindings([{ file: 'rules/x.md', content: '---\npaths:\n  - src/**\n---\n' + 'x'.repeat(unscopedRuleBudget + 1) }], unlimited), []);
    assert.deepEqual(alwaysOnFindings([{ file: 'rules/x.md', content: 'x'.repeat(unscopedRuleBudget) }], unlimited), []);
    assert.ok(alwaysOnFindings([{ file: 'rules/x.md', content: '---\napplyTo: "**/*"\n---\n' + 'x'.repeat(4_000) }]).some(finding => finding.rule === 'copilot-budget'));
    assert.deepEqual(alwaysOnFindings([{ file: 'rules/x.md', content: '---\napplyTo: "src/**"\n---\n' + 'x'.repeat(4_000) }], unlimited), []);
});

test('evaluation coverage ratchets only shrink, require reasons, and cannot exempt a new skill', () => {
    const baseline = { existing: 'Existing uncovered skill.' };
    assert.deepEqual(evaluationCoverageFindings(['existing', 'covered'], ['covered'], baseline, baseline), []);
    assert.deepEqual(evaluationCoverageFindings(['existing'], ['existing'], {}, baseline), []);
    assert.ok(evaluationCoverageFindings(['existing'], [], {}, baseline).length > 0);
    assert.ok(evaluationCoverageFindings(['existing', 'new'], [], { ...baseline, new: 'No cases.' }, baseline).some(finding => finding.matchedText.includes('new exemption')));
    for (const reason of ['', 'line\nbreak', 123]) assert.ok(evaluationCoverageFindings(['existing'], [], { existing: reason }, baseline).length > 0);
    assert.ok(evaluationCoverageFindings(['existing'], ['existing'], baseline, baseline).length > 0);
    assert.ok(evaluationCoverageFindings([], [], baseline, baseline).length > 0);
    assert.ok(evaluationCoverageFindings(['existing'], [], [], baseline).length > 0);
    assert.deepEqual(evaluationCoverageFindings(['existing'], [], baseline, undefined), []);
    assert.ok(evaluationCoverageFindings(['existing'], [], baseline, null).length > 0);
});

test('static evaluation coverage checks still reject missing coverage, invalid reasons and stale exemptions without a base', () => {
    assert.ok(evaluationCoverageFindings(['existing'], [], {}, undefined).length > 0);
    for (const reason of ['', 'line\nbreak', 123]) assert.ok(evaluationCoverageFindings(['existing'], [], { existing: reason }, undefined).length > 0);
    assert.ok(evaluationCoverageFindings(['existing'], [], { absent: 'Missing skill.' }, undefined).some(finding => finding.matchedText.includes('stale exemption')));
    assert.ok(evaluationCoverageFindings(['existing'], ['existing'], { existing: 'Now evaluated.' }, undefined).some(finding => finding.matchedText.includes('stale exemption')));
    assert.ok(evaluationCoverageFindings([], [], {}, undefined).length > 0);
    assert.ok(evaluationCoverageFindings(['existing'], [], [], undefined).length > 0);
});

test('CI ratchet selects immutable event bases and rejects malformed or zero revisions', () => {
    const revision = 'a'.repeat(40);
    assert.equal(evaluationBaseRevision('pull_request', { pull_request: { base: { sha: revision } } }), revision);
    assert.equal(evaluationBaseRevision('push', { before: revision }), revision);
    assert.equal(evaluationBaseRevision('schedule', {}), undefined);
    for (const before of ['0'.repeat(40), 'main', '', 123, undefined]) assert.throws(() => evaluationBaseRevision('push', { before }));
    assert.throws(() => evaluationBaseRevision('pull_request', {}));
});

test('required checks fail in warn mode and all other checks obey the single authoring mode', () => {
    for (const rule of ['description-when', 'description-voice', 'eval-coverage-ratchet', 'always-on-lines', 'always-on-harness-bytes', 'asset-reachability']) {
        assert.equal(skillAuthoringProblems([{ file, line: 3, rule, matchedText: 'Defect' }]).length, 1);
    }
    const findings = [{ file, line: 3, rule: 'body-headroom', matchedText: 'Defect' }];
    assert.deepEqual(skillAuthoringProblems(findings), []);
    assert.deepEqual(skillAuthoringProblems(findings, 'fail'), [`${file}:3 [body-headroom] Defect`]);
    assert.deepEqual(skillAuthoringProblems([], 'fail'), []);
    assert.deepEqual(skillAuthoringProblems([], 'invalid'), ['SKILL_AUTHORING_MODE must be warn or fail.']);
});

test('the authoring rule states the unscoped-rule budget the check enforces', () => {
    const rule = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.cratis', 'ai', 'rules', 'authoring-skills.md'), 'utf8');
    assert.ok(rule.includes(`${unscopedRuleBudget.toLocaleString('en-US')} combined bytes for rules without \`paths\``), 'authoring-skills.md must state the budget in skill-authoring.ts');
});
