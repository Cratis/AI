// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
    issuePreStateFingerprint,
    mutationManifestDigest,
    renderInversePayload,
    validateMutationManifest,
} from "../agent-mutation-protocol.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);
const validFixturePath =
    "tooling/specs/fixtures/agent-mutation-manifest.valid.json";
const invalidFixturePath =
    "tooling/specs/fixtures/agent-mutation-manifest.invalid.json";

function readFixture(path) {
    return JSON.parse(readFileSync(join(repositoryRoot, path), "utf8"));
}

function runProtocol(...args) {
    return spawnSync(
        process.execPath,
        ["tooling/agent-mutation-protocol.mjs", ...args],
        { cwd: repositoryRoot, encoding: "utf8" },
    );
}

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

test("the tracked fixtures are what the in-memory manifests describe", () => {
    assert.deepEqual(readFixture(validFixturePath), manifestFor());
    const invalid = readFixture(invalidFixturePath);
    assert.equal(Object.hasOwn(invalid, "policy"), false);
    assert.deepEqual(
        validateMutationManifest(readFixture(validFixturePath)),
        [],
    );
    assert(validateMutationManifest(invalid).length > 0);
});

test("the manifest schema points at the tracked positive fixture", () => {
    const schema = readFixture("tooling/agent-mutation-manifest.schema.json");
    assert.deepEqual(schema.examples, [validFixturePath]);
    assert(schema.description.includes(invalidFixturePath));
});

test("the CLI accepts the tracked fixture on disk and refuses its invalid sibling", () => {
    const accepted = runProtocol("validate", validFixturePath);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.equal(accepted.stdout, "Mutation manifest is valid.\n");

    const refused = runProtocol("validate", invalidFixturePath);
    assert.notEqual(refused.status, 0);
    assert(refused.stderr.includes("missing required property policy"));
    assert.equal(refused.stdout, "");

    const digest = runProtocol("digest", validFixturePath);
    assert.equal(digest.status, 0, digest.stderr);
    assert.match(digest.stdout.trim(), /^[0-9a-f]{64}$/);

    const inverse = runProtocol("render-inverse", validFixturePath);
    assert.equal(inverse.status, 0, inverse.stderr);
    assert.equal(
        JSON.parse(inverse.stdout).state,
        "REVERSAL_PAYLOAD_PREPARED",
    );
});
