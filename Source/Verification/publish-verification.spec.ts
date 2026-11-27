// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';

const workflow: { jobs: Record<string, {
    if?: string;
    needs?: string[];
    steps?: { if?: string; run?: string }[];
}> } = parse(readFileSync(new URL('../../.github/workflows/publish.yml', import.meta.url), 'utf8'));
const verifier = workflow.jobs['verify-published'];
const verifierNeeds = verifier.needs ?? [];
const verifierSteps = verifier.steps ?? [];
const releasePublishers = Object.entries(workflow.jobs).filter(([id, job]) =>
    id.startsWith('publish-') && job.if?.includes("needs.release.outputs.publish == 'true'"));
const indirectlyVerifiedPublishers: Record<string, string> = {
    // The multi-architecture publisher requires successful per-architecture image publication.
    'publish-agent-harnesses-arch': 'publish-agent-harnesses',
};

for (const [id, coveringId] of Object.entries(indirectlyVerifiedPublishers)) {
    test(`should verify ${id} through ${coveringId}`, () => {
        assert.ok(releasePublishers.some(([publisherId]) => publisherId === id), `${id} must remain a release publisher`);
        assert.ok(releasePublishers.some(([publisherId]) => publisherId === coveringId), `${coveringId} must remain a release publisher`);
        assert.ok(verifierNeeds.includes(coveringId), `verify-published must need ${coveringId}`);
        const coveringPublisher = workflow.jobs[coveringId];
        assert.ok(coveringPublisher.needs?.includes(id), `${coveringId} must need ${id}`);
        assert.ok(coveringPublisher.if?.includes(`needs.${id}.result == 'success'`), `${coveringId} must require ${id} to succeed`);
    });
}

for (const [id] of releasePublishers.filter(([publisherId]) => !Object.hasOwn(indirectlyVerifiedPublishers, publisherId))) {
    test(`should wait for ${id} before verifying the release`, () => {
        assert.ok(verifierNeeds.includes(id), `verify-published must need ${id}`);
    });

    test(`should check the ${id} result when verifying the release`, () => {
        assert.ok(verifierSteps.some(step => step.if?.includes(`needs.${id}.result`)),
            `verify-published must check needs.${id}.result in a step condition`);
    });
}

test('should fail with a package-specific error when Pi Direct publication did not succeed', () => {
    assert.ok(verifierNeeds.includes('publish-pi-direct'), 'verify-published must need publish-pi-direct');
    const failureStep = verifierSteps.find(step => step.if === "needs.publish-pi-direct.result != 'success'");
    assert.ok(failureStep?.run, 'verify-published must reject every unsuccessful Pi Direct publication');
    const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail'], {
        input: failureStep.run.replaceAll('${{ needs.release.outputs.version }}', '1.2.3'),
        encoding: 'utf8',
        timeout: 5_000,
    });
    assert.ifError(result.error);
    assert.notEqual(result.status, null, 'the Pi Direct failure step must exit normally');
    assert.notEqual(result.status, 0, 'the Pi Direct failure step must exit non-zero');
    assert.match(result.stdout + result.stderr, /::error::[^\n]*@cratis\/pi-direct/);
});
