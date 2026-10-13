// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import test from 'node:test';
import { skillHygieneFindings, skillHygieneProblems, skillHygieneReport } from './skill-hygiene.ts';

const skillFile = '.cratis/ai/skills/example/SKILL.md';
const referenceFile = '.cratis/ai/skills/example/references/example.md';
const history = ['decision 0123', 'ledger', 'drift report', 'historical', 'unreleased', 'released in', 'read at v', 'probed on'];
const noise = `1.2.3 2.3.4 3.4.5 4.5.6 Cratis/Arc#12 #123 file.cs:42-50 abc1234 ${history.join(' ')}`;
const skill = (body: string, description = 'Use for an example.') => `---\nname: example\ndescription: ${JSON.stringify(description)}\n---\n${body}`;
const byRule = (content: string, rule: string, file = skillFile) => skillHygieneFindings(file, content).filter(finding => finding.rule === rule);
const reference = (versions: string, lines: number, trailingNewline = true) => [versions, ...Array<string>(lines - 1).fill('Prose.')].join('\n') + (trailingNewline ? '\n' : '');

test('skill version budget permits three occurrences and reports all four above the limit', () => {
    assert.deepEqual(byRule(skill('1.2.3 v2.3.4 3.4.5'), 'skill-version-budget'), []);
    assert.deepEqual(byRule(skill('1.2.3 v2.3.4 3.4.5\n4.5.6'), 'skill-version-budget'), [
        { file: skillFile, line: 5, rule: 'skill-version-budget', matchedText: '1.2.3' },
        { file: skillFile, line: 5, rule: 'skill-version-budget', matchedText: 'v2.3.4' },
        { file: skillFile, line: 5, rule: 'skill-version-budget', matchedText: '3.4.5' },
        { file: skillFile, line: 6, rule: 'skill-version-budget', matchedText: '4.5.6' },
    ]);
    assert.equal(byRule(skill('1.2.3 '.repeat(4)), 'skill-version-budget').length, 4);
    assert.deepEqual(byRule(skill('1.2 1.2.x 1.2.3.4 x1.2.3 1.2.3x'), 'skill-version-budget'), []);
});

test('reference density uses the whole file and the exact one per forty lines threshold', () => {
    for (const trailingNewline of [true, false]) {
        assert.equal(byRule(reference('1.2.3', 39, trailingNewline), 'reference-version-density', referenceFile).length, 1);
        assert.deepEqual(byRule(reference('1.2.3', 40, trailingNewline), 'reference-version-density', referenceFile), []);
        assert.equal(byRule(reference('1.2.3 2.3.4', 79, trailingNewline), 'reference-version-density', referenceFile).length, 2);
        assert.deepEqual(byRule(reference('1.2.3 2.3.4', 80, trailingNewline), 'reference-version-density', referenceFile), []);
    }
    assert.deepEqual(skillHygieneFindings(referenceFile, ''), []);
    assert.deepEqual(skillHygieneFindings(referenceFile, reference('1.2.x 1.2', 1)), []);
});

test('issue references include qualified small numbers and bare numbers with at least three digits', () => {
    for (const file of [skillFile, referenceFile]) {
        const findings = byRule('Cratis/Arc#1 other-org/repo.name#23 (#123) #12345', 'issue-reference', file);
        assert.deepEqual(findings.map(finding => finding.matchedText), ['Cratis/Arc#1', 'other-org/repo.name#23', '#123', '#12345']);
        assert.ok(findings.every(finding => finding.file === file && finding.line === 1));
        assert.deepEqual(byRule('#12 #x123 word#123 ##123 #123word', 'issue-reference', file), []);
        assert.deepEqual(byRule('https://github.com/Cratis/Arc#12', 'issue-reference', file).map(finding => finding.matchedText), ['Cratis/Arc#12']);
    }
});

test('source-line citations include file extensions, directories and optional line ranges', () => {
    for (const file of [skillFile, referenceFile]) {
        assert.deepEqual(byRule('file.cs:42 path/to/file.spec.ts:10-20 README.md:3', 'source-line-citation', file).map(finding => finding.matchedText), ['file.cs:42', 'path/to/file.spec.ts:10-20', 'README.md:3']);
        assert.deepEqual(byRule('file.cs file.cs:N file.cs: path/to/file:10 http://localhost:42', 'source-line-citation', file), []);
        assert.deepEqual(byRule('/Source/File.cs:10-20', 'source-line-citation', file).map(finding => finding.matchedText), ['Source/File.cs:10-20']);
    }
});

test('commit hashes require seven to forty whole hex characters, digits and letters', () => {
    for (const hash of ['abc1234', 'AB12CDE', 'a'.repeat(39) + '1']) {
        assert.deepEqual(byRule(`Commit ${hash}.`, 'commit-hash').map(finding => finding.matchedText), [hash]);
    }
    for (const text of ['abc123', 'a'.repeat(40) + '1', 'deadbeef', '12345678', 'xabc1234', 'abc1234z', '_abc1234', '#abc1234', '#aabbcc11', '#aabbcc', 'decade', 'face', 'cabbed', 'ordinary words']) {
        assert.deepEqual(byRule(text, 'commit-hash'), [], text);
    }
    assert.deepEqual(skillHygieneFindings(skillFile, '#aabbcc11 #aabbcc #abc'), []);
    assert.deepEqual(skillHygieneFindings(referenceFile, 'abc1234'), []);
});

test('each history phrase is case-insensitive and bounded as a word or phrase', () => {
    for (const phrase of history) {
        for (const text of [phrase, phrase.toUpperCase()]) {
            assert.deepEqual(byRule(text, 'history-language').map(finding => finding.matchedText), [text]);
            assert.deepEqual(byRule(`prefix${text}suffix`, 'history-language'), []);
        }
    }
    for (const text of ['decision 1234', 'decision 01234', 'decision 012', 'ledgering', 'prehistorical', 'unreleasedness', 'released into', 'read at version', 'probed once']) {
        assert.deepEqual(byRule(text, 'history-language'), [], text);
    }
    assert.deepEqual(byRule('Read at v4.145.0', 'history-language').map(finding => finding.matchedText), ['Read at v']);
    assert.deepEqual(skillHygieneFindings(referenceFile, history.join(' ')), []);
});

test('Requires lines are exempt after whitespace and unordered or ordered list markers', () => {
    for (const prefix of ['', '  ', '- ', '* ', '+ ', '  1. ', '\t2) ']) {
        for (const file of [skillFile, referenceFile]) assert.deepEqual(skillHygieneFindings(file, `${prefix}Requires ${noise}`), []);
    }
    for (const prefix of ['Does not ', 'requires ', '- Something ']) {
        assert.ok(skillHygieneFindings(skillFile, `${prefix}${prefix === 'requires ' ? '' : 'Requires '}${noise}`).length > 0);
    }
    const body = `1.2.3 2.3.4 3.4.5\nRequires 4.5.6`;
    assert.deepEqual(byRule(body, 'skill-version-budget'), []);
    assert.deepEqual(byRule(reference(`1.2.3\nRequires 2.3.4`, 39), 'reference-version-density', referenceFile), []);
});

test('backtick and tilde fences exempt every body and reference rule, including delimiters with info', () => {
    for (const file of [skillFile, referenceFile]) {
        for (const delimiter of ['```', '~~~', '````', '~~~~']) {
            const content = `${delimiter} ${noise}\n${noise}\n${delimiter}\n`;
            assert.deepEqual(skillHygieneFindings(file, content), []);
        }
    }
    assert.deepEqual(skillHygieneFindings(skillFile, `   \`\`\`text\n${noise}\n   \`\`\`\n`), []);
    assert.deepEqual(skillHygieneFindings(skillFile, `\`\`\`\`text\n\`\`\`\n${noise}\n~~~\n${noise}\n\`\`\`\`\n`), []);
    assert.deepEqual(skillHygieneFindings(skillFile, `~~~\n${noise}`), []);
    assert.deepEqual(skillHygieneFindings(referenceFile, `\`\`\`\n${noise}`), []);
    assert.deepEqual(skillHygieneFindings(skillFile, `\`\`\`\n${noise}\n\`\`\`\n#123`).map(finding => finding.line), [4]);
    assert.deepEqual(byRule(`1.2.3 2.3.4 3.4.5\n\`\`\`\n4.5.6\n\`\`\``, 'skill-version-budget'), []);
    // Fence lines remain part of the physical reference length, but fenced versions do not count.
    assert.deepEqual(byRule(reference('1.2.3\n```\n2.3.4\n```', 37), 'reference-version-density', referenceFile), []);
});

test('description versions are separate from body budgets and other frontmatter is ignored', () => {
    const content = '---\nname: example\ncompatibility: 1.2.3 2.3.4 3.4.5 4.5.6 #123\ndescription: Use at v1.2.3.\n---\n#123';
    assert.deepEqual(skillHygieneFindings(skillFile, content), [
        { file: skillFile, line: 4, rule: 'description-version', matchedText: 'v1.2.3' },
        { file: skillFile, line: 6, rule: 'issue-reference', matchedText: '#123' },
    ]);
    assert.deepEqual(skillHygieneFindings(skillFile, skill('1.2.3 2.3.4 3.4.5')), []);
    assert.deepEqual(skillHygieneFindings(skillFile, skill('', 'No version, #123, file.cs:42, ledger.')), []);
    assert.equal(byRule(skill('', `Requires 1.2.3`), 'description-version').length, 1);
    assert.equal(byRule(skill('', '`1.2.3`'), 'description-version').length, 1);
});

test('multiline YAML and CRLF retain description and body source line numbers', () => {
    for (const style of ['>-', '|-', '"']) {
        const content = `---\nname: example\ndescription: ${style}\n  Use 1.2.3\n  and v2.3.4${style === '"' ? '"' : ''}\n---\nledger\n`;
        for (const source of [content, content.replaceAll('\n', '\r\n')]) {
            assert.deepEqual(skillHygieneFindings(skillFile, source).map(finding => [finding.line, finding.matchedText]), [[4, '1.2.3'], [5, 'v2.3.4'], [7, 'ledger']]);
        }
    }
    assert.deepEqual(skillHygieneFindings(skillFile, '---\ndescription: [invalid\n---\n#123').map(finding => finding.line), [4]);
    assert.deepEqual(skillHygieneFindings(skillFile, '---\nname: example\n---\n'), []);
    assert.deepEqual(skillHygieneFindings(skillFile, '---\ndescription: 123\n---\n'), []);
});

test('only skill entry points and Markdown references are scanned, including Windows paths', () => {
    for (const file of ['notes.md', 'references/example.json', 'other/example.md']) assert.deepEqual(skillHygieneFindings(file, noise), []);
    assert.equal(skillHygieneFindings('references/nested/example.md', '#123').length, 1);
    assert.equal(skillHygieneFindings('example\\references\\example.md', '#123').length, 1);
    assert.equal(skillHygieneFindings('SKILL.md', '#123').length, 1);
});

test('reports count each finding and order files and rules descending with stable name ties', () => {
    const findings = [...skillHygieneFindings('b/SKILL.md', '#123 ledger\n#124'), ...skillHygieneFindings('a/SKILL.md', 'ledger'), ...skillHygieneFindings('c/SKILL.md', 'ledger')];
    assert.deepEqual(skillHygieneReport(findings), {
        total: 5,
        perRule: [{ name: 'history-language', count: 3 }, { name: 'issue-reference', count: 2 }],
        perFile: [{ name: 'b/SKILL.md', count: 3 }, { name: 'a/SKILL.md', count: 1 }, { name: 'c/SKILL.md', count: 1 }],
    });
    assert.deepEqual(skillHygieneReport([]), { total: 0, perRule: [], perFile: [] });
});

test('warn mode never fails on findings, fail mode returns actionable failures, invalid modes fail', () => {
    const findings = skillHygieneFindings(skillFile, '#123');
    assert.deepEqual(skillHygieneProblems(findings), []);
    assert.deepEqual(skillHygieneProblems(findings, 'warn'), []);
    assert.deepEqual(skillHygieneProblems(findings, 'fail'), [`${skillFile}:1 [issue-reference] #123`]);
    assert.deepEqual(skillHygieneProblems([], 'fail'), []);
    assert.deepEqual(skillHygieneProblems(findings, 'unexpected'), ['SKILL_HYGIENE_MODE must be warn or fail.']);
});
