// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
    issuePreStateFingerprint,
    mutationManifestDigest,
    renderInversePayload,
    validateMutationManifest,
} from "../agent-mutation-protocol.mjs";

function manifestFor({
    labels = ["bug"],
    inverseState = "open",
    forwardState = "closed",
} = {}) {
    const preState = {
        state: "open",
        labels,
        assignees: ["woksin"],
        updatedAt: "2026-08-27T10:00:00Z",
        fingerprintSha256: "",
    };
    preState.fingerprintSha256 = issuePreStateFingerprint(preState);
    return {
        schemaVersion: 1,
        runId: "chronicle-stale-review-2026-08-27",
        state: "PREPARED",
        provider: "github",
        repository: "Cratis/Chronicle",
        resource: "issue",
        action: "bulk-update",
        policy: {
            dryRunRequired: true,
            inverseRequired: true,
            ageOnlyMutationAllowed: false,
            longLivedLabels: ["idea", "investigate"],
        },
        authorization: {
            state: "pending",
            approvedBy: "",
            approvedAt: "",
        },
        targets: [
            {
                issueNumber: 3812,
                preState,
                forward: {
                    state: forwardState,
                    labels: ["stale-review"],
                    assignees: [],
                },
                inverse: {
                    state: inverseState,
                    labels,
                    assignees: ["woksin"],
                },
            },
        ],
    };
}

test("mutation manifest produces a deterministic non-executing inverse payload", () => {
    const manifest = manifestFor();
    assert.deepEqual(validateMutationManifest(manifest), []);
    assert.match(mutationManifestDigest(manifest), /^[0-9a-f]{64}$/);
    assert.equal(
        mutationManifestDigest(structuredClone(manifest)),
        mutationManifestDigest(manifest),
    );
    const payload = renderInversePayload(manifest);
    assert.equal(payload.state, "REVERSAL_PAYLOAD_PREPARED");
    assert.equal(payload.authorizationState, "pending");
    assert.equal(payload.executionPerformed, false);
    assert.equal(payload.operations.length, 1);
    assert.deepEqual(payload.operations[0], {
        issueNumber: 3812,
        method: "PATCH",
        endpoint: "repos/Cratis/Chronicle/issues/3812",
        expectedPreStateFingerprint:
            manifest.targets[0].preState.fingerprintSha256,
        body: {
            state: "open",
            labels: ["bug"],
            assignees: ["woksin"],
        },
    });
});

test("mutation manifest rejects age-only policy long-lived closure and weak inverses", () => {
    const ageOnly = manifestFor();
    ageOnly.policy.ageOnlyMutationAllowed = true;
    assert(
        validateMutationManifest(ageOnly).some((error) =>
            error.includes("ageOnlyMutationAllowed"),
        ),
    );
    const longLived = manifestFor({ labels: ["idea"] });
    assert(
        validateMutationManifest(longLived).some((error) =>
            error.includes("long-lived issue cannot be closed"),
        ),
    );
    const wrongInverse = manifestFor({ inverseState: "closed" });
    assert(
        validateMutationManifest(wrongInverse).some((error) =>
            error.includes("must exactly restore pre-state"),
        ),
    );
    const wrongFingerprint = manifestFor();
    wrongFingerprint.targets[0].preState.fingerprintSha256 = "0".repeat(64);
    assert(
        validateMutationManifest(wrongFingerprint).some((error) =>
            error.includes("fingerprint mismatch"),
        ),
    );
});

test("mutation manifest rejects duplicate targets unsorted state and invented approval", () => {
    const duplicate = manifestFor();
    duplicate.targets.push(structuredClone(duplicate.targets[0]));
    assert(
        validateMutationManifest(duplicate).some((error) =>
            error.includes("duplicate target"),
        ),
    );
    const unsorted = manifestFor({ labels: ["z-label", "a-label"] });
    assert(
        validateMutationManifest(unsorted).some((error) =>
            error.includes("values must be sorted"),
        ),
    );
    const inventedApproval = manifestFor();
    inventedApproval.authorization.state = "approved";
    assert(
        validateMutationManifest(inventedApproval).some((error) =>
            error.includes("requires identity and time"),
        ),
    );
});

test("shared mutation tooling validates and renders but cannot execute effects", () => {
    const source = readFileSync(
        "tooling/agent-mutation-protocol.mjs",
        "utf8",
    );
    for (const forbidden of [
        "node:child_process",
        "gh api",
        "fetch(",
        "https.request",
        "executionPerformed: true",
    ])
        assert.equal(source.includes(forbidden), false, forbidden);
    const general = readFileSync(".ai/rules/general.md", "utf8");
    for (const required of [
        "## Interactive Agent Mutation Protocol",
        ".ai-work/reversals/<run-id>.json",
        "idea",
        "investigate",
        "age alone",
        "render-inverse",
        "separately authorized operation",
    ])
        assert(general.includes(required), required);
});
