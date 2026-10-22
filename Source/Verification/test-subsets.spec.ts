// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { slowestReport } from './slowest-reporter.ts';
import { affectedSubsets, subsetFiles, subsets } from './test-subsets.ts';

describe('test subsets', () => {
    it('should name only spec files that exist, each in one subset', () => {
        const seen = new Set<string>();
        for (const name of Object.keys(subsets)) {
            for (const file of subsetFiles(name)) {
                assert.ok(existsSync(fileURLToPath(new URL(file, import.meta.url))), `${file} does not exist`);
                assert.ok(!seen.has(file), `${file} is in more than one subset`);
                seen.add(file);
            }
        }
    });

    it('should reject an unknown subset', () => {
        assert.throws(() => subsetFiles('nope'), /Unknown subset/);
    });

    it('should map changed paths to subsets', () => {
        assert.deepEqual(affectedSubsets(['.cratis/ai/hooks/scripts/guard-writes.sh']).subsets, ['hooks']);
        assert.deepEqual(affectedSubsets(['Source/Harness.Setup/index.ts']).subsets, ['adapters']);
        assert.deepEqual(affectedSubsets(['.cratis/ai/skills/x/SKILL.md', 'Documentation/a.md']).subsets, ['corpus']);
        assert.deepEqual(affectedSubsets(['README.md']), { subsets: [], specs: [], full: false });
    });

    it('should run a changed spec itself and escalate other verification sources to the full suite', () => {
        assert.deepEqual(affectedSubsets(['Source/Verification/skill-hygiene.spec.ts']).specs, ['skill-hygiene.spec.ts']);
        assert.equal(affectedSubsets(['Source/Verification/verify.ts']).full, true);
    });

    it('should print the slowest specs first, capped at ten', () => {
        const timings = Array.from({ length: 12 }, (_, index) => ({ name: `t${index}`, file: `/a/f${index}.spec.ts`, milliseconds: index * 1000 }));
        const lines = slowestReport(timings).trim().split('\n');
        assert.equal(lines.length, 11);
        assert.match(lines[1], / 1\. +11\.00 s +f11\.spec\.ts +t11/);
    });
});
