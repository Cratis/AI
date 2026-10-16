// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { parseFences } from './play/fences.ts';
import { PreferredSyntax, styleCodes } from './play/preferred-syntax.ts';
import type { StyleDiagnostic } from './play/StyleDiagnostic.ts';

const diagnostic: StyleDiagnostic = { code: 'PLAY0479', name: 'LegacyOptionalSuffix', severities: ['information'], reserved: false, retired: false };
const file = '.cratis/ai/skills/cratis-screenplay-example/SKILL.md';
const content = '```screenplay\nmodule Example\n```\n';

function checker(): PreferredSyntax {
    const result = new PreferredSyntax([diagnostic], []);
    result.scan(file, content, parseFences(file, content).fences);
    return result;
}

describe('when selecting preferred syntax diagnostics', () => {
    it('should select exactly the eleven non-error style diagnostics from the pinned contract', async () => {
        const contract = JSON.parse(await readFile('../../.cratis/ai/skills/cratis-screenplay-toolchain/references/screenplay-contract.json', 'utf8'));
        assert.deepEqual(styleCodes(contract.diagnostics), ['PLAY0290', 'PLAY0397', 'PLAY0445', 'PLAY0471', 'PLAY0479', 'PLAY0507', 'PLAY0564', 'PLAY0565', 'PLAY0664', 'PLAY0786', 'PLAY0787']);
    });
    it('should exclude error-capable, reserved and retired diagnostics', () => {
        assert.deepEqual(styleCodes([{ ...diagnostic, severities: ['information', 'error'] }, { ...diagnostic, reserved: true }, { ...diagnostic, retired: true }]), []);
    });
    it('should reject zero selected codes, files or fences', () => {
        assert.match(new PreferredSyntax([], []).finish().join('\n'), /zero contract diagnostics/);
        assert.match(new PreferredSyntax([diagnostic], []).finish().join('\n'), /zero files or Screenplay fences/);
        const result = new PreferredSyntax([diagnostic], []);
        result.scan(file, 'Prose only', []);
        assert.match(result.finish().join('\n'), /zero files or Screenplay fences/);
    });
});

describe('when checking preferred syntax', () => {
    it('should forbid a style diagnostic even in an expect fence', () => {
        const result = checker();
        const fence = parseFences(file, '```screenplay expect PLAY0479\nmodule Example\n```').fences[0];
        result.diagnostics(fence, 'info PLAY0479: legacy optional suffix');
        assert.match(result.finish().join('\n'), /non-preferred.*PLAY0479/);
    });
    it('should catch a legacy spelling in a complete expect fence through diagnostics, not the textual scan', () => {
        const result = checker();
        const text = '```screenplay expect PLAY0479\nconcept Note : String\n  value String?\n```';
        const fences = parseFences(file, text).fences;
        result.scan(file, text, fences);
        assert.deepEqual(result.problems, []);
        result.diagnostics(fences[0], 'info PLAY0479: legacy optional suffix');
        assert.match(result.problems.join('\n'), /non-preferred.*PLAY0479/);
    });
    it('should leave routing and other non-style advice alone', () => {
        const result = checker();
        result.diagnostics(parseFences(file, content).fences[0], 'info PLAY0478: omitted\nwarning PLAY0469: payload\ninfo PLAY0516: advice\ninfo PLAY0553: advice\ninfo PLAY0520: advice');
        assert.deepEqual(result.finish(), []);
    });
    it('should scan prose and uncompiled excerpts but not unrelated code fences', () => {
        const result = checker();
        const text = '`Type?`, `@pii`, `@sensitive`, `sensitive` and `validate csharp` are old.\n```screenplay excerpt\nconcept Note : String sensitive\n  value String[]?\n  validate csharp\n```\n```csharp\nstring? value; // @pii\n```';
        result.scan(file, text, parseFences(file, text).fences);
        const problems = result.finish();
        assert.equal(problems.length, 6);
        assert.ok(problems.every(problem => !problem.includes(':10:')));
    });
    it('should detect language-line bare fences and legacy marker settings in excerpts', () => {
        const result = checker();
        const text = '````screenplay excerpt\nconcept Note : String\n  sensitive reason "Legacy"\n  validate\n    csharp\n    ```\n    return true;\n    ```\n  description\n    ```\n    Old description\n    ```\n````';
        result.scan(file, text, parseFences(file, text).fences);
        assert.equal(result.finish().length, 3);
    });
    it('should not interpret ordinary questions or observable optionality as type suffixes', () => {
        const result = checker();
        const text = 'Forever? What happens when X?\n```screenplay excerpt\nquery Q => observable?\n```';
        result.scan(file, text, parseFences(file, text).fences);
        assert.deepEqual(result.finish(), []);
    });
    it('should allow only an exact reasoned occurrence and reject stale entries', () => {
        const exception = { file, rule: 'optional-suffix', text: '`Type?` is the legacy form.', reason: 'Explains migration to optional.' };
        const result = new PreferredSyntax([diagnostic], [exception]);
        const text = content + exception.text;
        result.scan(file, text, parseFences(file, text).fences);
        assert.deepEqual(result.finish(), []);
        const stale = new PreferredSyntax([diagnostic], [exception]);
        stale.scan(file, content, parseFences(file, content).fences);
        assert.match(stale.finish().join('\n'), /stale preferred syntax exception/);
    });
    it('should require a reason and allow a migration-before diagnostic explicitly', () => {
        const fence = parseFences(file, content).fences[0];
        const entry = { file, rule: 'PLAY0479', text: 'fence:1', reason: 'Migration before example.' };
        const result = new PreferredSyntax([diagnostic], [entry]);
        result.scan(file, content, [fence]);
        result.diagnostics(fence, 'info PLAY0479: legacy');
        assert.deepEqual(result.finish(), []);
        const invalid = new PreferredSyntax([diagnostic], [{ ...entry, reason: '' }]);
        invalid.scan(file, content, [fence]);
        invalid.diagnostics(fence, 'info PLAY0479: legacy');
        assert.match(invalid.finish().join('\n'), /require file, rule, exact text and a reason/);
    });
});
