// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { slowestReport } from './slowest-reporter.ts';
import { affectedSubsets, main, subsetFiles, subsets } from './test-subsets.ts';

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

    it('should select a subset only for allowlisted paths', () => {
        assert.deepEqual(affectedSubsets(['.cratis/ai/hooks/scripts/cratis-guard-writes.sh']), { subsets: ['hooks'], specs: [], full: false });
        assert.deepEqual(affectedSubsets(['Source/Harness.Setup/setup.ts']).subsets, ['adapters']);
        assert.deepEqual(affectedSubsets(['Source/Verification/skill-hygiene.spec.ts']), { subsets: [], specs: ['skill-hygiene.spec.ts'], full: false });
    });

    it('should require the full suite for any other path, even beside a mapped one', () => {
        for (const path of ['Evaluations/skills/x/SKILL.md', '.cratis/ai/rules/general.md', '.cratis/ai/hooks/scripts/hook-lib.sh', 'Source/Verification/verify.ts', 'README.md', 'package.json', '.cratis/ai/agents/a.md']) {
            assert.equal(affectedSubsets([path]).full, true, path);
        }
        assert.equal(affectedSubsets(['.cratis/ai/hooks/scripts/cratis-guard-writes.sh', 'README.md']).full, true);
    });

    function harness(paths: string[], status = 0) {
        const runs: string[][] = [];
        const dependencies = { changedPaths: () => paths, allSpecs: () => ['a.spec.ts', 'b.spec.ts', 'c.spec.ts'], run: (files: string[]) => { runs.push(files); return status; }, log: () => undefined };
        return { runs, dependencies };
    }

    it('should execute every spec and propagate the exit status for an unmapped path', () => {
        const { runs, dependencies } = harness(['.cratis/ai/rules/general.md'], 1);
        assert.equal(main(['affected'], dependencies), 1);
        assert.deepEqual(runs, [['a.spec.ts', 'b.spec.ts', 'c.spec.ts']]);
    });

    it('should run the full suite for Evaluations and rules changes', () => {
        for (const path of ['Evaluations/skills/x/SKILL.md', '.cratis/ai/rules/general.md']) {
            const { runs, dependencies } = harness([path]);
            assert.equal(main(['affected'], dependencies), 0);
            assert.equal(runs[0].length, 3, path);
        }
    });

    it('should run only the hooks subset for a hook-script-only change', () => {
        const { runs, dependencies } = harness(['.cratis/ai/hooks/scripts/cratis-guard-secrets.sh']);
        assert.equal(main(['affected'], dependencies), 0);
        assert.deepEqual(runs, [subsetFiles('hooks')]);
    });

    it('should print the slowest specs first, capped at ten', () => {
        const timings = Array.from({ length: 12 }, (_, index) => ({ name: `t${index}`, file: `/a/f${index}.spec.ts`, milliseconds: index * 1000 }));
        const lines = slowestReport(timings).trim().split('\n');
        assert.equal(lines.length, 11);
        assert.match(lines[1], / 1\. +11\.00 s +f11\.spec\.ts +t11/);
    });
});
