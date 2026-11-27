// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const reference = new URL('../../.cratis/ai/skills/cratis-screenplay-toolchain/references/diagnostics.md', import.meta.url);
const diagnoses = [
    ['PLAY0291', 'malformed structured value'],
    ['PLAY0292', 'unknown member'],
    ['PLAY0293', 'incompatible shape'],
    ['PLAY0294', 'duplicate member'],
];

test('the toolchain reference distinguishes the structured-value diagnostics', () => {
    const rows = readFileSync(reference, 'utf8').split('\n');
    for (const [code, meaning] of diagnoses) {
        const row = rows.find(line => line.startsWith(`| ${code} |`));
        assert.ok(row?.toLowerCase().includes(meaning), `${code} should describe ${meaning}`);
    }
});
