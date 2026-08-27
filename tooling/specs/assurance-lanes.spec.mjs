// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import {
    buildPreviewReadiness,
    generatePreviewReadiness,
} from "../preview-readiness.mjs";

const inputs = [
    "distribution/assurance-lanes.json",
    "distribution/assurance-lanes.schema.json",
    "distribution/preview-readiness.schema.json",
    "distribution/profile-catalog.json",
    "distribution/npm-stage-contract.json",
    "catalog/v2/targets.json",
    "catalog/v2/artifacts.json",
];

function withTemporaryInputs(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-assurance-lanes-"));
    try {
        for (const path of inputs) {
            const destination = join(root, path);
            mkdirSync(dirname(destination), { recursive: true });
            cpSync(path, destination);
        }
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function readJson(root, path) {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function writeJson(root, path, value) {
    writeFileSync(join(root, path), `${JSON.stringify(value, null, 2)}\n`);
}

test("assurance lanes keep preview lightweight and support governed", () => {
    const policy = JSON.parse(
        readFileSync("distribution/assurance-lanes.json", "utf8"),
    );
    assert.equal(policy.defaultLane, "candidate-review");
    assert.deepEqual(
        policy.lanes.map((lane) => [lane.id, lane.assuranceMode, lane.channel]),
        [
            ["candidate-review", "basic", "candidate"],
            ["passive-preview", "basic", "preview"],
            ["governed-support", "governed", "supported"],
        ],
    );
    const preview = policy.lanes.find((lane) => lane.id === "passive-preview");
    assert.equal(preview.passiveOnly, true);
    assert.equal(preview.publicationAllowed, true);
    assert.equal(preview.supportClaimAllowed, false);
    assert.equal(preview.governedReadinessRequired, false);
    assert(!preview.requiredChecks.some((check) => /^s(?:9|10)-/.test(check)));
    const governed = policy.lanes.find(
        (lane) => lane.id === "governed-support",
    );
    assert.equal(governed.supportClaimAllowed, true);
    assert.equal(governed.governedReadinessRequired, true);
    assert(governed.requiredChecks.includes("s9-real-host-evidence"));
    assert(governed.requiredChecks.includes("s10-release-readiness"));
    assert.equal(policy.advancedAssurance.status, "SIDELINED_AVAILABLE");
});

test("current passive preview records owner setup but blocks an undeprecated bootstrap", () => {
    const first = generatePreviewReadiness();
    const second = generatePreviewReadiness();
    assert.deepEqual(second, first);
    assert.equal(first.state, "OWNER_SETUP_REQUIRED");
    assert.equal(first.staticCandidateReady, true);
    assert.equal(first.assuranceMode, "basic");
    assert.equal(first.governedAssurance.requiredForPreview, false);
    assert.equal(first.governedAssurance.availableForGraduation, true);
    assert.deepEqual(
        first.blockers.map((blocker) => blocker.code),
        ["npm-latest-tag-unsafe"],
    );
    assert.equal(first.previewRequestEligible, false);
    assert.equal(first.publicationEligible, false);
    assert.equal(first.supportGranted, false);
});

test("basic owner setup can admit a preview request without granting support", () => {
    withTemporaryInputs((root) => {
        const lanes = readJson(root, "distribution/assurance-lanes.json");
        writeJson(root, "distribution/assurance-lanes.json", lanes);
        const npm = readJson(root, "distribution/npm-stage-contract.json");
        npm.package.productionName = "@cratis/ai-fundamentals";
        npm.package.publicOwnershipConfirmed = true;
        npm.package.latestTagSafe = true;
        npm.workflow.trustedPublisherConfigured = true;
        npm.workflow.oidcEnabled = true;
        npm.workflow.publicPublishEnabled = true;
        writeJson(root, "distribution/npm-stage-contract.json", npm);
        const workflowPath = join(
            root,
            ".github/workflows/release-passive-previews.yml",
        );
        mkdirSync(dirname(workflowPath), { recursive: true });
        const previewLane = lanes.lanes.find(
            (lane) => lane.id === "passive-preview",
        );
        writeFileSync(
            workflowPath,
            `name: ${lanes.selectedPreview.requiredStatusContext}\n` +
                `environment: ${lanes.selectedPreview.protectedEnvironment}\n` +
                `${previewLane.requiredChecks.join("\n")}\n`,
        );
        const readiness = buildPreviewReadiness(root);
        assert.equal(readiness.state, "READY_FOR_PREVIEW_REQUEST");
        assert.deepEqual(readiness.blockers, []);
        assert.equal(readiness.previewRequestEligible, true);
        assert.equal(readiness.publicationEligible, false);
        assert.equal(readiness.supportGranted, false);
        assert.equal(readiness.governedAssurance.requiredForPreview, false);
        assert.equal(readiness.governedAssurance.availableForGraduation, true);
    });
});

test("preview lane cannot silently grant support or require governed evidence", () => {
    withTemporaryInputs((root) => {
        const lanes = readJson(root, "distribution/assurance-lanes.json");
        const preview = lanes.lanes.find(
            (lane) => lane.id === "passive-preview",
        );
        preview.supportClaimAllowed = true;
        preview.governedReadinessRequired = true;
        preview.requiredChecks.pop();
        writeJson(root, "distribution/assurance-lanes.json", lanes);
        assert.throws(
            () => buildPreviewReadiness(root),
            /Passive preview lane authority changed/,
        );
    });
});
