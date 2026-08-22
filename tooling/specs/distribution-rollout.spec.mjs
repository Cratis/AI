// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { generateDistributionFixture } from "../generate-distribution-fixture.mjs";
import {
    emergencyDisableFixtureRollout,
    initializeDistributionRollout,
    promoteFixtureStable,
    recordFixtureCanary,
    rollbackFixtureStable,
    simulateDistributionCanaryRollback,
    stageFixtureRelease,
} from "../simulate-distribution-rollout.mjs";
import { stageDistributionCandidate } from "../stage-distribution-candidate.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);

function withTemporaryDirectory(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-rollout-"));
    try {
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("rollout policy keeps production promotion and retirement blocked", () => {
    const policy = JSON.parse(
        readFileSync(
            join(repositoryRoot, "distribution/rollout-policy.json"),
            "utf8",
        ),
    );
    assert.equal(policy.state, "FIXTURE_ONLY_ROLLOUT_SIMULATION");
    assert.equal(policy.generatedRepository.botOnlyWrites, true);
    assert.equal(policy.canary.productionTargetsEnabled, false);
    assert.equal(policy.promotion.stableEnabled, false);
    assert.equal(policy.promotion.publicationEnabled, false);
    assert.equal(policy.legacyRetirement.enabled, false);
    assert(
        policy.legacyRetirement.blockedOn.includes(
            "NO_PRODUCTION_ROLLBACK_EVIDENCE",
        ),
    );
});

test("candidate staging allows only the authorized sanitized fixture", () => {
    withTemporaryDirectory((root) => {
        const stage = join(root, "stage");
        const recordPath = join(root, "candidate.json");
        const record = stageDistributionCandidate({
            repositoryRoot,
            artifactId: "sanitized-public-materializer-fixture",
            outputRoot: stage,
            candidateRecordPath: recordPath,
        });
        assert.equal(record.state, "FIXTURE_CANDIDATE_ONLY");
        assert.equal(record.publicationEligible, false);
        assert.equal(record.promotionEligible, false);
        assert.deepEqual(JSON.parse(readFileSync(recordPath, "utf8")), record);
        assert.throws(
            () =>
                stageDistributionCandidate({
                    repositoryRoot,
                    artifactId: "planned-passive-public-release",
                    outputRoot: join(root, "public-stage"),
                    candidateRecordPath: join(root, "public-candidate.json"),
                }),
            /not authorized for fixture staging/,
        );
    });
});

test("fixture rollout canaries promotes rolls back and emergency disables", () => {
    withTemporaryDirectory((root) => {
        const result = simulateDistributionCanaryRollback({
            repositoryRoot,
            simulationRoot: join(root, "simulation"),
        });
        assert.notEqual(result.firstRelease, result.secondRelease);
        assert.equal(result.finalState.stableReleaseId, result.firstRelease);
        assert.equal(
            result.finalState.previousStableReleaseId,
            result.secondRelease,
        );
        assert.equal(result.finalState.emergencyDisabled, true);
        assert.deepEqual(
            result.finalState.history.map((item) => item.operation),
            [
                "STAGE_RELEASE",
                "STAGE_RELEASE",
                "CANARY_PASS",
                "PROMOTE_FIXTURE_STABLE",
                "CANARY_PASS",
                "PROMOTE_FIXTURE_STABLE",
                "ROLLBACK_FIXTURE_STABLE",
                "EMERGENCY_DISABLE",
            ],
        );
    });
});

test("failed canary cannot enter fixture stable state", () => {
    withTemporaryDirectory((root) => {
        const rollout = join(root, "rollout");
        const candidate = join(root, "candidate");
        initializeDistributionRollout(rollout);
        generateDistributionFixture({
            repositoryRoot,
            outputRoot: candidate,
            version: "0.0.3-fixture",
        });
        const release = stageFixtureRelease(rollout, candidate);
        recordFixtureCanary(rollout, release, {
            status: "FAIL",
            checks: ["smoke"],
        });
        assert.throws(
            () => promoteFixtureStable(rollout, release),
            /passing fixture canary is required/,
        );
    });
});

test("emergency disable blocks fixture promotion", () => {
    withTemporaryDirectory((root) => {
        const rollout = join(root, "rollout");
        const candidate = join(root, "candidate");
        initializeDistributionRollout(rollout);
        generateDistributionFixture({ repositoryRoot, outputRoot: candidate });
        const release = stageFixtureRelease(rollout, candidate);
        recordFixtureCanary(rollout, release, {
            status: "PASS",
            checks: ["manifest", "smoke"],
        });
        emergencyDisableFixtureRollout(rollout);
        assert.throws(
            () => promoteFixtureStable(rollout, release),
            /emergency disabled/,
        );
    });
});

test("rollback requires a known noncurrent fixture release", () => {
    withTemporaryDirectory((root) => {
        const rollout = join(root, "rollout");
        initializeDistributionRollout(rollout);
        assert.throws(
            () => rollbackFixtureStable(rollout, "0".repeat(64)),
            /Unknown rollback release/,
        );
    });
});

test("tampered candidate cannot be staged as a fixture release", () => {
    withTemporaryDirectory((root) => {
        const rollout = join(root, "rollout");
        const candidate = join(root, "candidate");
        initializeDistributionRollout(rollout);
        generateDistributionFixture({ repositoryRoot, outputRoot: candidate });
        writeFileSync(
            join(
                candidate,
                "canonical/skills/cratis-fundamentals-concept/SKILL.md",
            ),
            "tampered\n",
        );
        assert.throws(
            () => stageFixtureRelease(rollout, candidate),
            /digest mismatch|byte parity|Checksum verification/,
        );
    });
});

test("duplicate fixture release staging fails without overwriting", () => {
    withTemporaryDirectory((root) => {
        const rollout = join(root, "rollout");
        const candidate = join(root, "candidate");
        initializeDistributionRollout(rollout);
        generateDistributionFixture({ repositoryRoot, outputRoot: candidate });
        stageFixtureRelease(rollout, candidate);
        assert.throws(
            () => stageFixtureRelease(rollout, candidate),
            /already exists/,
        );
    });
});
