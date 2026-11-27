// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const skill = new URL('../../.cratis/ai/skills/cratis-screenplay-scenario-coverage/', import.meta.url);
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
