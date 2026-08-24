// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const evaluation = JSON.parse(
    readFileSync(
        "distribution/apm-managed-install-evaluation.json",
        "utf8",
    ),
);

const sha256Pattern = /^[0-9a-f]{64}$/;

function assertHashes(values) {
    for (const value of Object.values(values)) assert.match(value, sha256Pattern);
}

test("APM evaluation records a bounded optional-path decision", () => {
    assert.equal(evaluation.schemaVersion, "1.0.0");
    assert.equal(
        evaluation.state,
        "OPTIONAL_MANAGED_PATH_RECOMMENDED_AFTER_DISTRIBUTION_CANARY",
    );
    assert.equal(evaluation.tool.version, "0.28.0");
    assert.equal(evaluation.tool.buildRevision, "e041462");
    assert.match(evaluation.tool.assetSha256, sha256Pattern);
    assert.match(evaluation.decision.individualDevelopers, /native Cratis marketplace/);
    assert.match(evaluation.decision.managedTeams, /optional exact-lock/);
    assert.match(evaluation.decision.pi, /does not support Pi/);
    assert.match(evaluation.decision.customInstaller, /Do not build/);
    assert.equal(evaluation.installationEligible, false);
    assert.equal(evaluation.publicationEligible, false);
    assert.equal(evaluation.promotionEligible, false);
});

test("APM evaluation covers reproducibility security lifecycle and both audiences", () => {
    assert.deepEqual(
        evaluation.results.map((result) => result.gate),
        [
            "release-asset-checksum",
            "exact-remote-install-and-lock",
            "frozen-second-machine-restore",
            "audit-and-drift-detection",
            "repair",
            "update-and-rollback",
            "uninstall-and-context-preservation",
            "public-safe-engineering-fixture",
        ],
    );
    assert(evaluation.results.every((result) => result.status === "PASS"));
    assert.notEqual(
        evaluation.publicFixture.oldSkillSha256,
        evaluation.publicFixture.newSkillSha256,
    );
    assert.match(evaluation.publicFixture.oldRevision, /^[0-9a-f]{40}$/);
    assert.match(evaluation.publicFixture.newRevision, /^[0-9a-f]{40}$/);
    assert.match(evaluation.engineeringFixture.revision, /^[0-9a-f]{40}$/);
    assertHashes(evaluation.publicFixture.projectContextSha256);
    assertHashes(evaluation.engineeringFixture.projectContextSha256);
    assert.equal(
        evaluation.publicFixture.projectContextSha256[
            ".agents/skills/local-context/SKILL.md"
        ],
        evaluation.engineeringFixture.projectContextSha256[
            ".agents/skills/local-context/SKILL.md"
        ],
    );
});

test("APM evaluation keeps unresolved ownership and support boundaries explicit", () => {
    for (const expected of [
        "AI.Distribution",
        "namespace",
        "policy fetch failure",
        "deployed host files",
        "Pi exact package settings",
        "pre-1.0",
        "Workflows#73",
    ])
        assert(
            evaluation.adoptionGates.some((gate) => gate.includes(expected)),
            expected,
        );
    assert(
        evaluation.observations.some((observation) =>
            observation.includes("shared host directories"),
        ),
    );
    assert(
        evaluation.observations.some((observation) =>
            observation.includes("no Git remote"),
        ),
    );
});

test("managed adoption documentation reflects the evidence decision", () => {
    const documentation = readFileSync(
        "Documentation/ai-distribution-and-subscriptions.md",
        "utf8",
    );
    assert.match(documentation, /## Managed multi-tool installation/);
    assert.match(documentation, /optional managed-team path/);
    assert.match(documentation, /\(APM\) 0\.28\.0/);
    assert.match(documentation, /does not support Pi/);
    assert.match(documentation, /AI\.Distribution/);
});
