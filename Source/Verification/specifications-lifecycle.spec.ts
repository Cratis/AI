// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

for (const path of [
    '.cratis/ai/skills/cratis-specifications-csharp/references/shared-lifecycle.md',
    '.cratis/ai/rules/specs.csharp.md',
]) {
    test(`${path} includes disposable specifications in the shared lifecycle`, () => {
        const content = readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');
        assert.doesNotMatch(content, /does? not\s+implement `IDisposable`/);
        assert.match(content, /Cratis\.Specifications 4\.4\.0/);
        assert.match(content, /`IDisposable` specifications/);
        assert.match(content, /construction (?:happens )?once|one construction/);
        assert.match(content, /(?:one `Dispose`|`Dispose` runs once) after the last fact/);
        assert.ok(content.includes('[PerFactSpecificationLifecycle]'));
    });
}
