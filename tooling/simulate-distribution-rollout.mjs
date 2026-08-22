#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import {
    cpSync,
    existsSync,
    mkdirSync,
    readFileSync,
    renameSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    generateDistributionFixture,
    validateDistributionFixture,
} from "./generate-distribution-fixture.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(`Unable to parse rollout state: ${path}`, {
            cause: error,
        });
    }
}

function statePath(rolloutRoot) {
    return join(rolloutRoot, "state.json");
}

function readState(rolloutRoot) {
    return readJson(statePath(rolloutRoot));
}

function writeState(rolloutRoot, state) {
    const path = statePath(rolloutRoot);
    const temporaryPath = `${path}.partial`;
    writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
        flag: "wx",
    });
    renameSync(temporaryPath, path);
}

function appendHistory(state, operation, releaseId = null) {
    state.sequence += 1;
    state.history.push({ sequence: state.sequence, operation, releaseId });
}

function releaseRoot(rolloutRoot, releaseId) {
    if (!/^[0-9a-f]{64}$/.test(releaseId))
        throw new Error(`Invalid rollout release id: ${releaseId}`);
    return join(rolloutRoot, "releases", releaseId);
}

export function initializeDistributionRollout(rolloutRoot) {
    if (existsSync(rolloutRoot))
        throw new Error(`Rollout root must not exist: ${rolloutRoot}`);
    mkdirSync(join(rolloutRoot, "releases"), { recursive: true });
    mkdirSync(join(rolloutRoot, "canary-evidence"), { recursive: true });
    writeState(rolloutRoot, {
        schemaVersion: "1.0.0",
        state: "FIXTURE_ONLY_ROLLOUT_SIMULATION",
        sequence: 0,
        canaryReleaseId: null,
        stableReleaseId: null,
        previousStableReleaseId: null,
        emergencyDisabled: false,
        history: [],
        publicationEligible: false,
        promotionEligible: false,
    });
    return readState(rolloutRoot);
}

export function stageFixtureRelease(rolloutRoot, candidateRoot) {
    validateDistributionFixture(candidateRoot);
    const manifestBytes = readFileSync(
        join(candidateRoot, "distribution-manifest.json"),
    );
    const releaseId = sha256(manifestBytes);
    const destination = releaseRoot(rolloutRoot, releaseId);
    if (existsSync(destination))
        throw new Error(`Fixture release already exists: ${releaseId}`);
    cpSync(candidateRoot, destination, {
        recursive: true,
        errorOnExist: true,
    });
    validateDistributionFixture(destination);
    const state = readState(rolloutRoot);
    appendHistory(state, "STAGE_RELEASE", releaseId);
    writeState(rolloutRoot, state);
    return releaseId;
}

export function recordFixtureCanary(
    rolloutRoot,
    releaseId,
    { status, checks },
) {
    const destination = releaseRoot(rolloutRoot, releaseId);
    if (!existsSync(destination))
        throw new Error(`Unknown fixture release: ${releaseId}`);
    if (!["PASS", "FAIL"].includes(status))
        throw new Error(`Invalid canary status: ${status}`);
    if (
        !Array.isArray(checks) ||
        checks.length === 0 ||
        checks.some((check) => typeof check !== "string" || check.length === 0)
    ) {
        throw new Error("Canary checks must be nonempty strings");
    }
    const evidencePath = join(
        rolloutRoot,
        "canary-evidence",
        `${releaseId}.json`,
    );
    if (existsSync(evidencePath))
        throw new Error(`Canary evidence already exists: ${releaseId}`);
    const evidence = {
        schemaVersion: "1.0.0",
        releaseId,
        status,
        checks,
        fixtureOnly: true,
        productionCanary: false,
    };
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
        flag: "wx",
    });
    const state = readState(rolloutRoot);
    state.canaryReleaseId = releaseId;
    appendHistory(state, `CANARY_${status}`, releaseId);
    writeState(rolloutRoot, state);
    return evidence;
}

export function promoteFixtureStable(rolloutRoot, releaseId) {
    const state = readState(rolloutRoot);
    if (state.emergencyDisabled)
        throw new Error("Fixture rollout is emergency disabled");
    if (state.canaryReleaseId !== releaseId)
        throw new Error(
            "Only the active canary can enter fixture stable state",
        );
    const evidence = readJson(
        join(rolloutRoot, "canary-evidence", `${releaseId}.json`),
    );
    if (evidence.status !== "PASS")
        throw new Error("A passing fixture canary is required");
    state.previousStableReleaseId = state.stableReleaseId;
    state.stableReleaseId = releaseId;
    appendHistory(state, "PROMOTE_FIXTURE_STABLE", releaseId);
    writeState(rolloutRoot, state);
    return readState(rolloutRoot);
}

export function rollbackFixtureStable(rolloutRoot, releaseId) {
    const state = readState(rolloutRoot);
    if (!existsSync(releaseRoot(rolloutRoot, releaseId)))
        throw new Error(`Unknown rollback release: ${releaseId}`);
    if (state.stableReleaseId === releaseId)
        throw new Error("Rollback release is already fixture stable");
    state.previousStableReleaseId = state.stableReleaseId;
    state.stableReleaseId = releaseId;
    appendHistory(state, "ROLLBACK_FIXTURE_STABLE", releaseId);
    writeState(rolloutRoot, state);
    return readState(rolloutRoot);
}

export function emergencyDisableFixtureRollout(rolloutRoot) {
    const state = readState(rolloutRoot);
    state.emergencyDisabled = true;
    appendHistory(state, "EMERGENCY_DISABLE");
    writeState(rolloutRoot, state);
    return readState(rolloutRoot);
}

export function simulateDistributionCanaryRollback({
    repositoryRoot = defaultRepositoryRoot,
    simulationRoot,
} = {}) {
    if (!simulationRoot) throw new Error("simulationRoot is required");
    if (existsSync(simulationRoot))
        throw new Error(`Simulation root must not exist: ${simulationRoot}`);
    mkdirSync(simulationRoot, { recursive: false });
    try {
        const rolloutRoot = join(simulationRoot, "rollout");
        initializeDistributionRollout(rolloutRoot);
        const firstCandidate = join(simulationRoot, "candidate-v1");
        const secondCandidate = join(simulationRoot, "candidate-v2");
        generateDistributionFixture({
            repositoryRoot,
            outputRoot: firstCandidate,
            version: "0.0.1-fixture",
        });
        generateDistributionFixture({
            repositoryRoot,
            outputRoot: secondCandidate,
            version: "0.0.2-fixture",
        });
        const firstRelease = stageFixtureRelease(rolloutRoot, firstCandidate);
        const secondRelease = stageFixtureRelease(rolloutRoot, secondCandidate);
        recordFixtureCanary(rolloutRoot, firstRelease, {
            status: "PASS",
            checks: ["manifest", "checksums", "smoke"],
        });
        promoteFixtureStable(rolloutRoot, firstRelease);
        recordFixtureCanary(rolloutRoot, secondRelease, {
            status: "PASS",
            checks: ["manifest", "checksums", "smoke"],
        });
        promoteFixtureStable(rolloutRoot, secondRelease);
        rollbackFixtureStable(rolloutRoot, firstRelease);
        const finalState = emergencyDisableFixtureRollout(rolloutRoot);
        return {
            firstRelease,
            secondRelease,
            finalState,
        };
    } catch (error) {
        rmSync(simulationRoot, { recursive: true, force: true });
        throw error;
    }
}

function main() {
    const simulationRoot = process.argv[2];
    if (!simulationRoot) {
        process.stderr.write(
            "Usage: node tooling/simulate-distribution-rollout.mjs <empty-simulation-path>\n",
        );
        process.exitCode = 1;
        return;
    }
    try {
        const result = simulateDistributionCanaryRollback({ simulationRoot });
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "Rollout simulation failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
