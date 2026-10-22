// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { slowestReport } from './slowest-reporter.ts';
import { affectedSubsets, defaultFullSuiteBudgetSeconds, judgeBudget, main, subsetFiles, subsets } from './test-subsets.ts';

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

    describe('full-suite wall-time budget', () => {
        it('should pass quietly within the default budget', () => {
            const verdict = judgeBudget(884, {});
            assert.deepEqual([verdict.exceeded, verdict.fail], [false, false]);
            assert.match(verdict.message, new RegExp(`of its ${defaultFullSuiteBudgetSeconds} s budget`));
        });

        it('should only warn when over budget locally', () => {
            const verdict = judgeBudget(defaultFullSuiteBudgetSeconds + 1, {});
            assert.deepEqual([verdict.exceeded, verdict.fail], [true, false]);
            assert.match(verdict.message, /^WARNING/);
        });

        it('should fail when over budget and CI is set', () => {
            const verdict = judgeBudget(defaultFullSuiteBudgetSeconds + 1, { CI: 'true' });
            assert.deepEqual([verdict.exceeded, verdict.fail], [true, true]);
            assert.match(verdict.message, /^FAILED.*CRATIS_TEST_BUDGET_SECONDS/);
        });

        it('should honour a valid override and ignore an invalid one', () => {
            assert.equal(judgeBudget(500, { CRATIS_TEST_BUDGET_SECONDS: '400', CI: '1' }).fail, true);
            assert.equal(judgeBudget(500, { CRATIS_TEST_BUDGET_SECONDS: '2000', CI: '1' }).exceeded, false);
            for (const invalid of ['abc', '0', '-5', '']) assert.equal(judgeBudget(1100, { CRATIS_TEST_BUDGET_SECONDS: invalid, CI: '1' }).exceeded, false, invalid);
        });

        function timedRun(elapsedMilliseconds: number, status: number, env: NodeJS.ProcessEnv) {
            const clock = [0, elapsedMilliseconds];
            const logs: string[] = [];
            const dependencies = { changedPaths: () => [], allSpecs: () => ['a.spec.ts'], run: () => status, log: (message: string) => { logs.push(message); }, now: () => clock.shift() ?? 0, env };
            return { exit: main(['full'], dependencies), logs };
        }

        it('should keep the exit status of a passing run within budget', () => {
            assert.equal(timedRun(10_000, 0, { CI: '1' }).exit, 0);
        });

        it('should fail the full run over budget only under CI', () => {
            assert.equal(timedRun(1_300_000, 0, { CI: '1' }).exit, 1);
            const local = timedRun(1_300_000, 0, {});
            assert.equal(local.exit, 0);
            assert.match(local.logs.join('\n'), /WARNING/);
        });

        it('should never mask a failing run', () => {
            assert.equal(timedRun(10_000, 3, {}).exit, 3);
        });
    });
});
