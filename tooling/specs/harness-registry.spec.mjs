// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
    artifactForbiddenPathPatterns,
    fixtureOutputRoots,
    forbiddenPathPolicy,
    harnesses,
    passiveHarnesses,
    resolveHarness,
    subscriptionHarnessIds,
} from "../harness-registry.mjs";
import { validateArtifactPath } from "../public-artifact-materializer.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);

function readJson(path) {
    return JSON.parse(readFileSync(join(repositoryRoot, path), "utf8"));
}

function duplicates(values) {
    const seen = new Set();
    return values.filter((value) => seen.has(value) || !seen.add(value));
}

test("harness registry identifiers and output roots are unique", () => {
    assert.deepEqual(duplicates(passiveHarnesses), []);
    assert.deepEqual(duplicates(subscriptionHarnessIds), []);
    assert.deepEqual(duplicates(fixtureOutputRoots), []);
    assert.equal(harnesses.length, passiveHarnesses.length);
    for (const harness of harnesses) {
        assert.equal(resolveHarness(harness.id), harness);
        assert.equal(resolveHarness(harness.subscriptionId), harness);
        for (const alias of harness.aliases)
            assert.equal(resolveHarness(alias), harness);
    }
});

test("subscription aliases resolve to canonical emitted artifact identities", () => {
    const deepSeek = resolveHarness("deepseek-harness");
    assert.equal(deepSeek.id, "deepseek");
    assert.equal(deepSeek.subscriptionId, "deepseek-harness");
    assert.equal(deepSeek.fixtureOutputRoot, "deepseek");
    assert.equal(deepSeek.canonicalArtifactId, "deepseek-harness");
    assert.equal(resolveHarness("deepseek"), deepSeek);

    const claudeArtifact = resolveHarness("claude").canonicalArtifactId;
    assert.equal(resolveHarness("grok").canonicalArtifactId, claudeArtifact);
    assert.equal(resolveHarness("junie").canonicalArtifactId, claudeArtifact);
});

test("subscription schema and artifact matrix derive harness mappings from the registry", () => {
    const schema = readJson("distribution/profile-subscription.schema.json");
    assert.deepEqual(
        schema.properties.harnesses.items.enum,
        subscriptionHarnessIds,
    );

    const targets = new Map(
        readJson("distribution/artifact-matrix.json").targets.map((target) => [
            target.id,
            target,
        ]),
    );
    for (const harness of harnesses)
        assert.equal(
            targets.get(harness.fixtureTargetId)?.outputRoot,
            harness.fixtureOutputRoot,
            harness.id,
        );
});

test("all authoritative ecosystem records reach the generated v2 projection", () => {
    const ecosystems = readJson("catalog/ecosystem-versions.json").ecosystems;
    const ecosystemFacts = readJson("catalog/v2/evidence.json").ecosystemFacts;
    const sourceIds = ecosystems.map((ecosystem) => ecosystem.id).sort();
    const projectedIds = [
        ...new Set(ecosystemFacts.map((fact) => fact.ecosystemId)),
    ].sort();

    assert.equal(ecosystems.length, 26);
    assert.deepEqual(projectedIds, sourceIds);
    for (const ecosystem of ecosystems)
        assert.equal(
            ecosystemFacts.filter((fact) => fact.ecosystemId === ecosystem.id)
                .length,
            ecosystem.facts.length,
            ecosystem.id,
        );
});

test("forbidden path declarations share the strict registry policy", () => {
    const publicCatalog = readJson("catalog/public-skills.yml");
    assert.deepEqual(
        publicCatalog.runtimePayloadPolicy.forbidden,
        forbiddenPathPolicy.publicRuntimePatterns,
    );

    const engineeringMatrix = readJson(
        "distribution/engineering-artifact-matrix.json",
    );
    assert.deepEqual(
        engineeringMatrix.projectOwnedForbiddenPaths,
        forbiddenPathPolicy.projectOwnedPaths,
    );
    assert.deepEqual(
        engineeringMatrix.alwaysForbiddenPaths,
        forbiddenPathPolicy.engineeringAlwaysPatterns,
    );
    assert(engineeringMatrix.alwaysForbiddenPaths.includes("commands/**"));
    assert(engineeringMatrix.alwaysForbiddenPaths.includes("lsp/**"));

    const artifacts = new Map(
        readJson("catalog/v2/artifacts.json").artifacts.map((artifact) => [
            artifact.id,
            artifact,
        ]),
    );
    assert.deepEqual(
        artifacts.get("planned-passive-public-release").forbiddenPathPatterns,
        artifactForbiddenPathPatterns({ audience: "public" }),
    );
    assert.deepEqual(
        artifacts.get("planned-passive-engineering-release")
            .forbiddenPathPatterns,
        artifactForbiddenPathPatterns({ audience: "cratis-engineering" }),
    );
    assert.deepEqual(
        artifacts.get("sanitized-engineering-docs-authoring-fixture")
            .forbiddenPathPatterns,
        artifactForbiddenPathPatterns({
            audience: "cratis-engineering",
            fixture: true,
        }),
    );

    for (const segment of forbiddenPathPolicy.artifactSegments)
        assert.throws(
            () => validateArtifactPath(`skills/example/${segment}/file.md`),
            undefined,
            segment,
        );
});
