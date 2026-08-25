// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import {
    cpSync,
    mkdtempSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { validateReleaseApprovals } from "../release-approval-validation.mjs";

const files = [
    "distribution/release-approvals.json",
    "distribution/profile-catalog.json",
    "catalog/v2/targets.json",
    "catalog/v2/source-contracts.json",
    "catalog/v2/evidence.json",
];

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function withFixture(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-release-approval-"));
    try {
        for (const path of files) {
            const destination = join(root, path);
            mkdirSync(dirname(destination), { recursive: true });
            cpSync(path, destination);
        }
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("current release approval catalog is empty and consistent", () => {
    assert.deepEqual(validateReleaseApprovals(), []);
    const approvals = readJson("distribution/release-approvals.json");
    assert.deepEqual(approvals.profileApprovals, []);
    assert.deepEqual(approvals.targetApprovals, []);
    assert.deepEqual(approvals.sourceContractApprovals, []);
});

test("profile and source admission cannot bypass release approval records", () => {
    withFixture((root) => {
        const profilesPath = join(root, "distribution/profile-catalog.json");
        const profiles = readJson(profilesPath);
        profiles.publicProfiles[0].state = "approved";
        writeJson(profilesPath, profiles);
        const contractsPath = join(root, "catalog/v2/source-contracts.json");
        const contracts = readJson(contractsPath);
        contracts.contracts[0].verificationState = "verified";
        contracts.contracts[0].distributionInputAllowed = true;
        writeJson(contractsPath, contracts);
        const errors = validateReleaseApprovals(root);
        assert(
            errors.includes(
                `${profiles.publicProfiles[0].id}: profile approval state is inconsistent`,
            ),
        );
        assert(
            errors.includes(
                `${contracts.contracts[0].id}: source contract approval is inconsistent`,
            ),
        );
    });
});

test("approval records reject unknown profile target and source contract IDs", () => {
    withFixture((root) => {
        const path = join(root, "distribution/release-approvals.json");
        const approvals = readJson(path);
        const evidenceIds = ["reevaluation-authority"];
        approvals.profileApprovals.push({
            profileId: "unknown-profile",
            reviewer: "reviewer",
            approvedOn: "2026-08-24",
            evidenceIds,
        });
        approvals.targetApprovals.push({
            targetId: "unknown-target",
            reviewer: "reviewer",
            approvedOn: "2026-08-24",
            sourceRevision: "0".repeat(40),
            contentDigest: "0".repeat(64),
            evidenceIds,
        });
        approvals.sourceContractApprovals.push({
            contractId: "unknown-contract",
            reviewer: "reviewer",
            approvedOn: "2026-08-24",
            evidenceIds,
        });
        writeJson(path, approvals);
        const errors = validateReleaseApprovals(root);
        assert(errors.includes("unknown-profile: unknown profile approval"));
        assert(errors.includes("unknown-target: unknown target approval"));
        assert(
            errors.includes(
                "unknown-contract: unknown source contract approval",
            ),
        );
    });
});

test("approval records require known evidence and complete reviewer metadata", () => {
    withFixture((root) => {
        const path = join(root, "distribution/release-approvals.json");
        const approvals = readJson(path);
        approvals.targetApprovals.push({
            targetId: "cratis-fundamentals-concept",
            reviewer: "",
            approvedOn: "not-a-date",
            sourceRevision: "0".repeat(40),
            contentDigest: "0".repeat(64),
            evidenceIds: ["unknown-evidence"],
        });
        writeJson(path, approvals);
        const errors = validateReleaseApprovals(root);
        assert(
            errors.includes(
                "cratis-fundamentals-concept: incomplete target approval",
            ),
        );
        assert(
            errors.includes(
                "cratis-fundamentals-concept: unknown evidence unknown-evidence",
            ),
        );
        assert(
            errors.includes(
                "cratis-fundamentals-concept: target approval state is inconsistent",
            ),
        );
    });
});
