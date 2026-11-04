// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';

const workflow = parse(readFileSync(new URL('../../.github/workflows/publish.yml', import.meta.url), 'utf8'));
const verify = workflow.jobs.verify;
const dotnetVerify = workflow.jobs['dotnet-verify'];
const screenplaySync = workflow.jobs['screenplay-sync'];
const release = workflow.jobs.release;
const confirmation = workflow.jobs['release-confirmed'];
const releaseCheck = confirmation.steps.find((step: { name: string }) => step.name === 'Verify the GitHub release exists');
const publishingJobs = Object.entries(workflow.jobs)
    .filter(([name, job]) => name !== 'release-confirmed' && (job as { if?: string }).if === "needs.release.outputs.publish == 'true'");

// Interpret only the event comparisons used by these job guards, not arbitrary Actions expressions.
function allowsEvent(condition: string | undefined, event: string): boolean {
    if (condition === undefined) return true;
    return condition.split(' || ').some(group => group.split(' && ').every(comparison => {
        const match = /^github\.event_name (==|!=) '([^']+)'$/.exec(comparison);
        assert.ok(match, `Unexpected job condition: ${comparison}`);
        return match[1] === '==' ? event === match[2] : event !== match[2];
    }));
}

for (const [name, job] of [['verify', verify], ['dotnet-verify', dotnetVerify]] as const) {
    test(`should exclude only sync events in the ${name} job guard`, () => {
        assert.equal(job.if, "github.event_name != 'repository_dispatch' && github.event_name != 'schedule'");
    });
    for (const event of ['pull_request', 'push', 'workflow_dispatch', 'repository_dispatch', 'schedule']) {
        const syncEvent = event === 'repository_dispatch' || event === 'schedule';
        test(`should ${syncEvent ? 'skip' : 'require'} ${name} for ${event}`, () => {
            assert.equal(allowsEvent(job.if, event), !syncEvent);
        });
    }
}

for (const event of ['pull_request', 'push', 'workflow_dispatch', 'repository_dispatch', 'schedule']) {
    test(`should plan independent contract comparison and guarded release for ${event}`, () => {
        assert.equal(allowsEvent(screenplaySync.if, event), event === 'repository_dispatch' || event === 'schedule');
        assert.equal(allowsEvent(release.if, event), event === 'push' || event === 'workflow_dispatch');
    });
}

test('should require successful verification before push or manual release without a skipped-job bypass', () => {
    assert.equal(release.if, "github.event_name == 'push' || github.event_name == 'workflow_dispatch'");
    assert.deepEqual(release.needs, ['verify', 'dotnet-verify']);
});

test('should compare the external Screenplay contract independently of skipped verification', () => {
    assert.equal(screenplaySync.if, "github.event_name == 'repository_dispatch' || github.event_name == 'schedule'");
    assert.equal(screenplaySync.needs, undefined);
    assert.equal(screenplaySync['continue-on-error'], undefined);
    const download = screenplaySync.steps.find((step: { id?: string }) => step.id === 'contract');
    assert.equal(download.env.DISPATCH_VERSION, '${{ github.event.client_payload.version }}');
    assert.equal(download.env.DISPATCH_SCHEMA, '${{ github.event.client_payload.schemaVersion }}');
    assert.equal(download.if, undefined);
    assert.match(download.run, /version="\$DISPATCH_VERSION"/);
    assert.match(download.run, /gh release view --repo Cratis\/Screenplay --json tagName --jq .tagName/);
    assert.match(download.run, /gh release download "\$tag" --repo Cratis\/Screenplay --pattern screenplay-contract.json/);
    const comparison = screenplaySync.steps.at(-1);
    assert.equal(comparison.if, undefined);
    assert.equal(comparison['continue-on-error'], undefined);
    assert.equal(comparison.env.CONTRACT_VERSION, '${{ steps.contract.outputs.version }}');
    assert.equal(comparison.env.CONTRACT_PATH, '${{ runner.temp }}/screenplay-contract/screenplay-contract.json');
    assert.equal(comparison.run, 'yarn workspace @cratis/ai-verification exec tsx contract/sync.ts --root "$GITHUB_WORKSPACE" --contract "$CONTRACT_PATH" --version "$CONTRACT_VERSION"');
});

for (const status of [0, 1, 2]) {
    test(`should preserve the contract comparison result and drift report (exit ${status})`, () => {
        const comparison = screenplaySync.steps.at(-1);
        // Stub the issue-reconciling command: never contact GitHub or mutate a tracking issue.
        const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail'], {
            input: `yarn() { printf 'comparison argument: <%s>\\n' "$@"; if [ "$SYNC_STATUS" = 1 ]; then printf 'Screenplay contract drift\\n' >&2; fi; return "$SYNC_STATUS"; }\n${comparison.run}`,
            env: { PATH: process.env.PATH, GITHUB_WORKSPACE: '/fixture/ai', CONTRACT_PATH: '/fixture/external-contract.json', CONTRACT_VERSION: 'v1.2.3', SYNC_STATUS: String(status) },
            encoding: 'utf8',
            timeout: 5_000,
        });
        assert.ifError(result.error);
        assert.equal(result.status, status, result.stderr);
        assert.match(result.stdout, /comparison argument: <contract\/sync.ts>/);
        assert.match(result.stdout, /comparison argument: <\/fixture\/external-contract.json>/);
        assert.match(result.stdout, /comparison argument: <v1\.2\.3>/);
        if (status === 1) assert.match(result.stderr, /Screenplay contract drift/);
    });
}

test('should retain the sync schedule and FIFO groups without changing the separate Product drift workflow', () => {
    assert.deepEqual(workflow.on.repository_dispatch.types, ['screenplay-contract-published']);
    assert.deepEqual(workflow.on.schedule, [{ cron: '41 4 * * 3' }]);
    assert.deepEqual(workflow.concurrency, {
        group: "${{ github.workflow }}-${{ (github.event_name == 'repository_dispatch' || github.event_name == 'schedule') && 'screenplay-sync' || github.ref }}",
        queue: 'max',
    });
    const productDrift = parse(readFileSync(new URL('../../.github/workflows/product-drift.yml', import.meta.url), 'utf8'));
    assert.deepEqual(productDrift.on, { schedule: [{ cron: '23 5 * * 1' }], workflow_dispatch: null });
    assert.deepEqual(productDrift.concurrency, { group: 'ai-corpus-product-drift', 'cancel-in-progress': false });
});

test('should pin the release action that rejects a version claimed by another commit', () => {
    const action = release.steps.find((step: { id?: string }) => step.id === 'release');
    assert.equal(action.uses, 'cratis/release-action@31a6d28d6aa36d46970cb29f0d0260b360e81a69');
    assert.equal(release.outputs.publish, '${{ steps.release.outputs.should-publish }}');
    assert.equal(release.outputs.version, '${{ steps.release.outputs.version }}');
    assert.equal(release.outputs.prerelease, '${{ steps.release.outputs.prerelease }}');
});

// release-action creates the GitHub release in its post stage, which runs after every step of the
// release job. A check inside the release job runs before the release exists and always fails.
test('should confirm the GitHub release in a job after the release job, before any publish job can start', () => {
    assert.equal(release.steps.some((step: { name?: string }) => step.name === 'Verify the GitHub release exists'), false);
    assert.equal(confirmation.needs, 'release');
    assert.equal(confirmation.if, "needs.release.outputs.publish == 'true'");
    assert.equal(releaseCheck.if, undefined);
    assert.deepEqual(releaseCheck.env, {
        GH_TOKEN: '${{ github.token }}',
        VERSION: '${{ needs.release.outputs.version }}',
    });
    assert.equal(releaseCheck['continue-on-error'], undefined);
    assert.equal(confirmation['continue-on-error'], undefined);
    assert.ok(publishingJobs.length >= 5);
    for (const [, job] of publishingJobs) assert.deepEqual((job as { needs: string[] }).needs, ['release', 'release-confirmed']);
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
        else assert.match(result.stdout, /::error::GitHub release v1\.2\.3 does not exist in Cratis\/AI; refusing to publish\./);
    });
}
