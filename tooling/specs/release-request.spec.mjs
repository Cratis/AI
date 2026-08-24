// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    validateReleaseRequest,
    validateReleaseRequests,
} from "../release-request-validation.mjs";

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

function approvedInputs() {
    const inputs = structuredClone({
        profileCatalog: readJson("distribution/profile-catalog.json"),
        targets: readJson("catalog/v2/targets.json").targets,
        sources: readJson("catalog/v2/sources.json").sources,
        sourceContracts: readJson("catalog/v2/source-contracts.json").contracts,
        authoringContracts: readJson("catalog/v2/authoring-contracts.json")
            .contracts,
        artifacts: readJson("catalog/v2/artifacts.json").artifacts,
    });
    const profile = inputs.profileCatalog.publicProfiles.find(
        (candidate) => candidate.id === "public-fundamentals",
    );
    profile.state = "approved";
    const target = inputs.targets.find(
        (candidate) => candidate.id === "cratis-fundamentals-concept",
    );
    target.approval = {
        state: "approved",
        reviewer: "woksin",
        approvedOn: "2026-08-23",
        sourceRevision: "b53caa555b9a3f05ba1462b86202fe3ccb8a9470",
        contentDigest:
            "9e537c48a95c414709008c69ebfb616354d60992578ddd9da3d7dc7308c42caa",
        evidenceIds: [
            "fundamentals-concept-source-review-2026-08-23",
            "fundamentals-concept-focused-evaluation-2026-08-23",
            "fundamentals-concept-samples-canary-2026-08-23",
        ],
    };
    target.lifecycle = "approved";
    target.includeInRuntime = true;
    for (const id of [
        "cratis-fundamentals-source",
        "cratis-chronicle-source",
    ]) {
        const contract = inputs.sourceContracts.find(
            (candidate) => candidate.id === id,
        );
        contract.verificationState = "verified";
        contract.distributionInputAllowed = true;
    }
    const artifact = inputs.artifacts.find(
        (candidate) => candidate.id === "planned-passive-public-release",
    );
    artifact.materializationAllowed = true;
    artifact.runtimeEligible = true;
    return inputs;
}

test("repository release request resolves the approved Fundamentals profile", () => {
    const result = validateReleaseRequests();
    assert.deepEqual(result.errors, []);
    assert.equal(result.requests.length, 1);
    assert.equal(
        result.requests[0].relativePath,
        "distribution/releases/v0.1.0-preview.1.json",
    );
    assert.deepEqual(result.requests[0].request.profiles, [
        "public-fundamentals",
    ]);
    assert.equal(
        result.requests[0].plans[0].state,
        "READY_FOR_BOT_MATERIALIZATION",
    );
});

test("approved release request resolves every requested profile", () => {
    const request = readJson(
        "Documentation/examples/ai-release/v0.1.0-preview.1.json",
    );
    const schema = readJson("distribution/release-request.schema.json");
    const result = validateReleaseRequest(
        request,
        "distribution/releases/v0.1.0-preview.1.json",
        approvedInputs(),
        schema,
    );
    assert.deepEqual(result.errors, []);
    assert.equal(result.plans.length, 1);
    assert.equal(result.plans[0].state, "READY_FOR_BOT_MATERIALIZATION");
    assert.equal(result.plans[0].profileId, "public-fundamentals");
});

test("release request rejects partial automation and canary drift", () => {
    const request = readJson(
        "Documentation/examples/ai-release/v0.1.0-preview.1.json",
    );
    request.automation.npmPublish = false;
    request.canaries = [];
    const schema = readJson("distribution/release-request.schema.json");
    const result = validateReleaseRequest(
        request,
        "distribution/releases/wrong.json",
        approvedInputs(),
        schema,
    );
    assert(
        result.errors.some((error) => error.includes("expected constant true")),
    );
    assert(
        result.errors.some((error) =>
            error.includes("every profile needs exactly one named canary"),
        ),
    );
    assert(result.errors.some((error) => error.includes("filename must be")));
});
