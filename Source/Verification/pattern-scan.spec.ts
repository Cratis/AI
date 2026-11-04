// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathWithout } from './fixtures/path-without-tool.ts';

const script = resolve(import.meta.dirname, '../../.cratis/ai/hooks/scripts/cratis-pattern-scan.sh');

function withoutJq(check: (run: (input: string) => string) => void, stateUnavailable = false): void {
    const isolated = pathWithout('jq');
    const root = mkdtempSync(join(tmpdir(), 'cratis-pattern-scan-'));
    try {
        const scratch = stateUnavailable ? join(root, 'not-a-directory') : root;
        if (stateUnavailable) writeFileSync(scratch, 'x');
        check(input => {
            const result = spawnSync('bash', [script], {
                input,
                encoding: 'utf8',
                env: { ...process.env, PATH: isolated.path, TMPDIR: scratch, CLAUDE_PROJECT_DIR: root, CRATIS_HOOKS_SKIP_SCAN: '0' },
            });
            assert.equal(result.status, 0, result.stderr);
            assert.equal(result.stdout, '', 'the advisory must not produce hook JSON or block the edit');
            return result.stderr;
        });
    } finally {
        isolated.dispose();
        rmSync(root, { recursive: true, force: true });
    }
}

for (const input of ['{\n "session_id" : "missing-jq-session"\n}', '{}', '']) {
    test(`without jq pattern scanning warns once per session for ${JSON.stringify(input)}`, () => {
        withoutJq(run => {
            const notice = run(input);
            assert.match(notice, /^cratis-pattern-scan: jq is not installed; pattern scanning is off until jq is installed\.\n$/);
            assert.equal(run(input), '');
            assert.equal(run('{"session_id":"another-session"}'), notice, 'a different session gets its own notice');
        });
    });
}

test('without jq pattern scanning still warns when session state is unavailable', () => {
    withoutJq(run => {
        const notice = run('{"session_id":"no-state"}');
        assert.match(notice, /pattern scanning is off until jq is installed/);
        assert.equal(run('{"session_id":"no-state"}'), notice);
    }, true);
});
