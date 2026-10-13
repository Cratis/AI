// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import test from 'node:test';
import { alwaysOnFindings, assetReachabilityFindings, instructionAuthoringFindings, skillAuthoringFindings, skillAuthoringProblems } from './skill-authoring.ts';
import { evaluationBaseRevision, evaluationCoverageFindings } from './evaluation-coverage.ts';

const file = '.cratis/ai/skills/example/SKILL.md';
const skill = (description = 'Build an example. Use when demonstrating behavior. Not for queries.', body = '') => `---\nname: example\ndescription: ${JSON.stringify(description)}\n---\n${body}`;
const rules = (content: string, path = file) => skillAuthoringFindings(path, content).map(finding => finding.rule);

test('description-when recognizes explicit routing forms and rejects implicit triggers', () => {
    for (const clause of ['Use when writing', 'Load this skill before writing', 'Read for examples', 'Use to write', 'Use whenever writing', 'Use if writing', 'Trigger on examples']) {
        assert.ok(!rules(skill(clause + '. Not for queries.')).includes('description-when'), clause);
    }
    assert.ok(rules(skill('Build an example. After discovery.')).includes('description-when'));
    assert.ok(rules(skill('Abuse when writing.')).includes('description-when'));
});

test('description-when-not recognizes boundaries and named alternatives', () => {
    for (const clause of ['Not for queries', 'Not when querying', 'Do not use for querying', "Don't use for querying", 'use `example-query` instead']) {
        assert.ok(!rules(skill('Use when writing. ' + clause)).includes('description-when-not'));
    }
    assert.ok(rules(skill('Use when writing.')).includes('description-when-not'));
});

test('description voice rejects first and second person but allows domain we/our and word substrings', () => {
    for (const word of ['I', "I'll", 'my', 'you', 'your', 'YOUR']) assert.ok(rules(skill(`Use when ${word} write.`)).includes('description-voice'));
    assert.ok(!rules(skill('Use when recording our own facts; we own the young entity. Not for queries.')).includes('description-voice'));
    assert.deepEqual(skillAuthoringFindings(file, '---\ndescription: [broken\n---\n'), []);
    assert.deepEqual(skillAuthoringFindings(file, '---\ndescription: 123\n---\n'), []);
    assert.deepEqual(skillAuthoringFindings(file, '---\nmetadata:\n  description: your\n---\n'), []);
});

test('folded and quoted YAML routing is checked at its physical description location', () => {
    const content = '---\nname: example\ndescription: >-\n  Build examples.\n  Use when writing. Not for queries; your input.\n---\n';
    for (const source of [content, content.replaceAll('\n', '\r\n')]) {
        const findings = skillAuthoringFindings(file, source);
        assert.deepEqual(findings.map(finding => [finding.rule, finding.line]), [['description-voice', 3]]);
    }
});

test('description-meta extends description-version detection without using body version budgets', () => {
    for (const word of ['pinned', 'provenance', 'ledger', 'probe', 'probed', 'contradictions', 'v1.2.3']) {
        assert.ok(rules(skill(`Use when reading ${word}. Not for queries.`)).includes('description-meta'), word);
    }
    assert.deepEqual(rules(skill()), []);
    assert.ok(!rules(skill(undefined, '1.2.3')).includes('description-meta'));
});

test('body headroom counts only the body, warning at the exact 18000 threshold', () => {
    assert.ok(!rules(skill(undefined, 'x'.repeat(17_999))).includes('body-headroom'));
    assert.ok(rules(skill(undefined, 'x'.repeat(18_000))).includes('body-headroom'));
    assert.ok(!rules(skill('Use when ' + 'x'.repeat(18_000) + '. Not for queries.')).includes('body-headroom'));
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
    assert.ok(alwaysOnFindings([{ file: 'rules/x.md', content: 'x'.repeat(60_001) }]).some(finding => finding.rule === 'unscoped-rule-bytes'));
    assert.deepEqual(alwaysOnFindings([{ file: 'rules/x.md', content: '---\npaths:\n  - src/**\n---\n' + 'x'.repeat(60_001) }]), []);
    assert.deepEqual(alwaysOnFindings([{ file: 'rules/x.md', content: 'x'.repeat(60_000) }]), []);
    assert.ok(alwaysOnFindings([{ file: 'rules/x.md', content: '---\napplyTo: "**/*"\n---\n' + 'x'.repeat(4_000) }]).some(finding => finding.rule === 'copilot-budget'));
    assert.deepEqual(alwaysOnFindings([{ file: 'rules/x.md', content: '---\napplyTo: "src/**"\n---\n' + 'x'.repeat(4_000) }]), []);
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
    assert.ok(evaluationCoverageFindings(['existing'], [], baseline, undefined).length > 0);
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
    for (const rule of ['description-when', 'description-voice', 'eval-coverage-ratchet', 'always-on-lines', 'asset-reachability']) {
        assert.equal(skillAuthoringProblems([{ file, line: 3, rule, matchedText: 'Defect' }]).length, 1);
    }
    const findings = [{ file, line: 3, rule: 'body-headroom', matchedText: 'Defect' }];
    assert.deepEqual(skillAuthoringProblems(findings), []);
    assert.deepEqual(skillAuthoringProblems(findings, 'fail'), [`${file}:3 [body-headroom] Defect`]);
    assert.deepEqual(skillAuthoringProblems([], 'fail'), []);
    assert.deepEqual(skillAuthoringProblems([], 'invalid'), ['SKILL_AUTHORING_MODE must be warn or fail.']);
});
