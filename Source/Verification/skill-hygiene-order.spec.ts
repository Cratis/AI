// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { instructionHygieneFindings, skillHygieneFindings } from './skill-hygiene.ts';

const text = 'today v1.2.3 #123 file.cs:12 historical';

describe('hygiene finding order', () => {
    it('should keep instruction findings in rule order rather than textual order', () => {
        const findings = instructionHygieneFindings('.cratis/ai/rules/demo.md', text);
        assert.deepEqual(findings.map(finding => [finding.line, finding.rule, finding.matchedText]), [
            [1, 'instruction-version', 'v1.2.3'],
            [1, 'issue-reference', '#123'],
            [1, 'source-line-citation', 'file.cs:12'],
            [1, 'history-language', 'historical'],
            [1, 'time-words', 'today'],
        ]);
    });

    it('should sort skill findings by line and then rule while retaining the original path', () => {
        const file = 'skills\\demo\\SKILL.md';
        const findings = skillHygieneFindings(file, `${text}\r\n#456`, true);
        assert.deepEqual(findings.map(finding => [finding.line, finding.rule]), [
            [1, 'history-language'],
            [1, 'issue-reference'],
            [1, 'source-line-citation'],
            [1, 'time-words'],
            [2, 'issue-reference'],
        ]);
        assert.ok(findings.every(finding => finding.file === file));
    });

    it('should not scan an invalid description but should still scan the body', () => {
        const content = '---\nname: demo\ndescription: [v1.2.3\n---\n#123';
        assert.deepEqual(skillHygieneFindings('demo/SKILL.md', content).map(finding => [finding.line, finding.rule]), [[5, 'issue-reference']]);
    });
});
