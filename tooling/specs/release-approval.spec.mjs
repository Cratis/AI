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

test("current release approval catalog selects only Fundamentals", () => {
    assert.deepEqual(validateReleaseApprovals(), []);
    const approvals = readJson("distribution/release-approvals.json");
    assert.deepEqual(
        approvals.profileApprovals.map((approval) => approval.profileId),
        ["public-fundamentals"],
    );
    assert.deepEqual(
        approvals.targetApprovals.map((approval) => approval.targetId),
        ["cratis-fundamentals-concept"],
    );
    assert.deepEqual(
        approvals.sourceContractApprovals.map(
            (approval) => approval.contractId,
        ),
        ["cratis-fundamentals-source", "cratis-chronicle-source"],
    );
});

test("profile and source admission cannot bypass release approval records", () => {
    withFixture((root) => {
        const profilesPath = join(root, "distribution/profile-catalog.json");
        const profiles = readJson(profilesPath);
        const unapprovedProfile = profiles.publicProfiles.find(
            (profile) => profile.state !== "approved",
        );
        unapprovedProfile.state = "approved";
        writeJson(profilesPath, profiles);
        const contractsPath = join(root, "catalog/v2/source-contracts.json");
        const contracts = readJson(contractsPath);
        contracts.contracts[0].verificationState = "verified";
        contracts.contracts[0].distributionInputAllowed = true;
        writeJson(contractsPath, contracts);
        const errors = validateReleaseApprovals(root);
        assert(
            errors.includes(
                `${unapprovedProfile.id}: profile approval state is inconsistent`,
            ),
        );
        assert(
            errors.includes(
                `${contracts.contracts[0].id}: source contract approval is inconsistent`,
            ),
        );
    });
});

test("approval records require known evidence and complete reviewer metadata", () => {
    withFixture((root) => {
        const path = join(root, "distribution/release-approvals.json");
        const approvals = readJson(path);
        approvals.targetApprovals.push({
            targetId: "cratis-arc-command",
            reviewer: "",
            approvedOn: "not-a-date",
            sourceRevision: "0".repeat(40),
            contentDigest: "0".repeat(64),
            evidenceIds: ["unknown-evidence"],
        });
        writeJson(path, approvals);
        const errors = validateReleaseApprovals(root);
        assert(
            errors.includes("cratis-arc-command: incomplete target approval"),
        );
        assert(
            errors.includes(
                "cratis-arc-command: unknown evidence unknown-evidence",
            ),
        );
        assert(
            errors.includes(
                "cratis-arc-command: target approval state is inconsistent",
            ),
        );
    });
});
