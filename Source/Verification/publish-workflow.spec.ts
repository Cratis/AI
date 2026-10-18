// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';

const workflow = parse(readFileSync(new URL('../../.github/workflows/publish.yml', import.meta.url), 'utf8'));
const verification = workflow.jobs['verify-published'];
const releaseCheck = verification.steps.find((step: { name: string }) => step.name === 'Verify the GitHub release exists');

test('should pin the release action that rejects a version claimed by another commit', () => {
    const release = workflow.jobs.release;
    const action = release.steps.find((step: { id?: string }) => step.id === 'release');
    assert.equal(action.uses, 'cratis/release-action@31a6d28d6aa36d46970cb29f0d0260b360e81a69');
    assert.equal(release.outputs.publish, '${{ steps.release.outputs.should-publish }}');
    assert.equal(release.outputs.version, '${{ steps.release.outputs.version }}');
    assert.equal(release.outputs.prerelease, '${{ steps.release.outputs.prerelease }}');
});

test('should verify the determined release with a read-only token whenever publishing was requested', () => {
    assert.equal(verification.if, "always() && needs.release.outputs.publish == 'true'");
    assert.ok(verification.needs.includes('release'));
    assert.deepEqual(verification.permissions, { contents: 'read' });
    assert.deepEqual(releaseCheck.env, {
        GH_TOKEN: '${{ github.token }}',
        VERSION: '${{ needs.release.outputs.version }}',
    });
    assert.equal(verification.steps[0], releaseCheck);
    assert.equal(releaseCheck.if, undefined);
    assert.equal(releaseCheck['continue-on-error'], undefined);
});

for (const status of [0, 1, 4]) {
    test(`should ${status === 0 ? 'accept an existing release' : `reject an unverified release (gh exit ${status})`}`, () => {
        const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail'], {
            input: `gh() { printf 'gh argument: <%s>\\n' "$@"; return "$GH_STATUS"; }\n${releaseCheck.run}`,
            env: { PATH: process.env.PATH, GH_TOKEN: 'test-token', VERSION: '1.2.3', GITHUB_REPOSITORY: 'Cratis/AI', GH_STATUS: String(status) },
            encoding: 'utf8',
            timeout: 5_000,
        });
        assert.ifError(result.error);
        assert.equal(result.status, status === 0 ? 0 : 1, result.stderr);
        assert.ok(result.stdout.startsWith('gh argument: <release>\ngh argument: <view>\ngh argument: <v1.2.3>\ngh argument: <--repo>\ngh argument: <Cratis/AI>\n'));
        if (status === 0) assert.doesNotMatch(result.stdout, /::error::/);
        else assert.match(result.stdout, /::error::GitHub release v1\.2\.3 could not be verified in Cratis\/AI\./);
    });
}
