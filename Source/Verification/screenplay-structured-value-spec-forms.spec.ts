// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const skills = new URL('../../.cratis/ai/skills/', import.meta.url);
const skill = new URL('cratis-screenplay-scenario-coverage/', skills);
const reference = new URL('references/spec-forms-by-mode.md', skill);

test('the mode matrix names structured values and identifies the Stage collection-member limit', () => {
    const rows = readFileSync(reference, 'utf8').split('\n');
    const row = rows.find(line => /^\|\s*Structured values\b[^|]*\bin specs\s*\|/i.test(line));
    assert.ok(row, 'the mode matrix has no structured-values row for specs');

    const [, form, design, executable, renderable] = row.split('|').map(cell => cell.trim());
    assert.match(form, /nested objects.*lists of objects/i);
    assert.equal(design, 'yes');
    assert.match(executable, /^yes\b/i);
    assert.match(renderable, /\bcollection-valued members\b[^;]*\bSTAGE-ESM-011\b/i);
});

test('the scenario coverage skill does not label structured values as Composite (JSON)', () => {
    for (const path of globSync('**/*.md', { cwd: fileURLToPath(skill) }).sort()) {
        const text = readFileSync(new URL(path, skill), 'utf8');
        assert.doesNotMatch(text, /Composite\s*\(JSON\)/i, `${path} uses the obsolete Composite (JSON) label`);
    }
});

for (const path of [
    'cratis-stage-rendering-and-sandbox/references/admission.md',
    'cratis-screenplay-toolchain/references/diagnostics.md',
    'cratis-stage-rendering-and-sandbox/references/sandbox-and-specrunner.md',
]) {
    test(`${path} distinguishes the structured-value rendering limit from an outright refusal`, () => {
        const text = readFileSync(new URL(path, skills), 'utf8');
        assert.ok(!/\bcomposite\s+values\b/i.test(text), 'uses the obsolete blanket refusal');

        const sections = text.split(/\r?\n(?:\s*\r?\n|(?=\|))/);
        const describesLimit = sections.some(section =>
            /\bstructured\s+values\b/i.test(section) &&
            /\bcollection-valued\s+members\b/i.test(section) &&
            /\bSTAGE-ESM-011\b/.test(section));
        assert.ok(describesLimit, 'does not associate STAGE-ESM-011 with collection-valued members of structured values');
    });
}
