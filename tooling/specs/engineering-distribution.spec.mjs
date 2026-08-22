// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readJson(path) {
    return JSON.parse(readFileSync(join(repositoryRoot, path), "utf8"));
}

test("engineering package matrix accounts for every engineering target once", () => {
    const matrix = readJson("distribution/engineering-artifact-matrix.json");
    const targets = readJson("catalog/v2/targets.json").targets.filter(
        (target) => target.audience === "cratis-engineering",
    );
    const matrixIds = matrix.packageBoundaries
        .flatMap((boundary) => boundary.targetIds)
        .sort();
    assert.deepEqual(
        matrixIds,
        targets.map((target) => target.id).sort(),
    );
    assert.equal(new Set(matrixIds).size, matrixIds.length);
    assert.equal(matrix.installationEligible, false);
    assert.equal(matrix.publicationEligible, false);
    assert.equal(matrix.promotionEligible, false);
});

test("first engineering target is classified but cannot package raw source", () => {
    const matrix = readJson("distribution/engineering-artifact-matrix.json");
    const targets = readJson("catalog/v2/targets.json").targets;
    const first = targets.find(
        (target) => target.id === matrix.firstPassiveTarget.targetId,
    );
    assert.equal(
        matrix.firstPassiveTarget.state,
        "SOURCE_RECONCILED_NOT_EVALUATED",
    );
    assert.equal(
        matrix.firstPassiveTarget.canonicalSourcePath,
        "engineering/skills/cratis-engineering-docs-authoring",
    );
    assert.equal(matrix.firstPassiveTarget.rawSourcePackagingAllowed, false);
    assert.equal(first.trust.class, "passive");
    assert.equal(first.trust.assessmentState, "assessed");
    assert.equal(first.security.risk, "low");
    assert.equal(first.approval.state, "candidate");
    assert.equal(first.includeInRuntime, false);
});

test("effectful and executable engineering capabilities stay separate", () => {
    const matrix = readJson("distribution/engineering-artifact-matrix.json");
    const lowTrust = matrix.packageBoundaries.find(
        (boundary) => boundary.id === "engineering-passive-low-trust",
    );
    const effectful = matrix.packageBoundaries.find(
        (boundary) => boundary.id === "engineering-passive-effectful",
    );
    const executable = matrix.packageBoundaries.find(
        (boundary) => boundary.id === "engineering-executable-tooling",
    );
    assert(lowTrust.targetIds.includes("cratis-engineering-docs-authoring"));
    assert(effectful.targetIds.includes("cratis-engineering-ship-changes"));
    assert.deepEqual(executable.targetIds, ["skill-creator"]);
    assert.equal(effectful.allowedPaths.length, 0);
    assert.equal(executable.allowedPaths.length, 0);
});

test("engineering distribution cannot own project context or executable payloads", () => {
    const matrix = readJson("distribution/engineering-artifact-matrix.json");
    assert.deepEqual(matrix.projectOwnedForbiddenPaths, [
        ".cratis/PROJECT.md",
        ".agents/PROJECT.md",
        "AGENTS.md",
        "CLAUDE.md",
        "GEMINI.md",
    ]);
    for (const forbidden of [
        "**/evals/**",
        "**/scripts/**",
        "rules/**",
        "agents/**",
        "prompts/**",
        "hooks/**",
        "workflows/**",
        "tooling/**",
        ".pi/**",
        ".git/**",
    ])
        assert(matrix.alwaysForbiddenPaths.includes(forbidden), forbidden);
});

test("engineering artifact remains distinct from the public release", () => {
    const artifacts = readJson("catalog/v2/artifacts.json").artifacts;
    const engineering = artifacts.find(
        (artifact) => artifact.id === "planned-passive-engineering-release",
    );
    const publicArtifact = artifacts.find(
        (artifact) => artifact.id === "planned-passive-public-release",
    );
    assert.equal(engineering.audience, "cratis-engineering");
    assert.equal(publicArtifact.audience, "public");
    assert.equal(engineering.materializationAllowed, false);
    assert.equal(engineering.runtimeEligible, false);
    assert.equal(publicArtifact.materializationAllowed, false);
    assert.equal(publicArtifact.runtimeEligible, false);
    assert.deepEqual(
        new Set(engineering.componentInventory.skills),
        new Set(
            readJson("catalog/v2/targets.json")
                .targets.filter(
                    (target) => target.audience === "cratis-engineering",
                )
                .map((target) => target.id),
        ),
    );
});
