// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// Environment preflight only; not an interaction-quality point for any task.
test('the fixture has one compatible package vector', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    assert.equal(manifest.dependencies['@cratis/arc'], '24.9.0');
    assert.equal(manifest.dependencies['@cratis/arc.react'], '24.9.0');
    assert.equal(manifest.dependencies['@cratis/components'], '4.63.1');
});
