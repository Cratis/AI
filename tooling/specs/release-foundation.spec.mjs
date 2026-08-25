// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    createReleaseContext,
    releaseCatalogDescriptors,
} from "../release-context.mjs";
import {
    buildReleaseAssuranceReceipt,
    validateReleaseAssurancePolicy,
} from "../release-assurance-validation.mjs";
import { harnesses } from "../harness-registry.mjs";

test("release context reads each catalog and schema once and freezes ordinal planning inputs", () => {
    const reads = new Map();
    const context = createReleaseContext({
        readFile(path) {
            reads.set(path, (reads.get(path) ?? 0) + 1);
            return Buffer.from(readFileSync(path));
        },
    });
    assert.equal(
        [...reads.values()].every((count) => count === 1),
        true,
    );
    assert.equal(context.readCount, reads.size);
    assert.equal(Object.isFrozen(context), true);
    assert.equal(Object.isFrozen(context.catalogs), true);
    assert.equal(Object.isFrozen(context.ordinalMaps.targets.ids), true);
    assert.deepEqual(
        context.ordinalMaps.targets.ids,
        [...context.ordinalMaps.targets.ids].sort(),
    );
    assert.equal(
        context.require("targets", "cratis-fundamentals-concept").id,
        "cratis-fundamentals-concept",
    );
    assert.equal(
        Object.keys(context.catalogPaths).length,
        Object.keys(releaseCatalogDescriptors).length,
    );
});

test("harness descriptors explicitly declare one or more profile and fixture projections", () => {
    for (const harness of harnesses) {
        assert.equal(harness.profileProjectionRoots.length >= 1, true);
        assert.equal(harness.fixtureProjectionRoots.length >= 1, true);
        for (const projection of [
            ...harness.profileProjectionRoots,
            ...harness.fixtureProjectionRoots,
        ]) {
            assert.equal(typeof projection.id, "string");
            assert.equal(typeof projection.outputRoot, "string");
            assert.equal(typeof projection.skillRoot, "string");
        }
    }
});

test("release assurance policy is closed and current S4 use remains passive only", () => {
    assert.deepEqual(validateReleaseAssurancePolicy(), []);
    const receipt = buildReleaseAssuranceReceipt({
        artifactClasses: [
            "passive-skill-package",
            "passive-native-metadata",
            "marketplace-index",
        ],
        assurances: [
            "canonical-parity",
            "immutable-source",
            "path-scanning",
            "secret-scanning",
            "sha256-inventory",
        ],
        releaseManifest: "release-manifest.json",
    });
    assert.equal(receipt.staticValidationInput.outcome, "pass");
    assert.equal(receipt.staticValidationInput.supporting, false);
    assert.equal(receipt.supportGranted, false);
    assert.equal(receipt.publicationGranted, false);
    assert.equal(receipt.runtimeGranted, false);
    assert.equal(receipt.promotionGranted, false);
});

test("S4 refuses executable and MCP artifact classes", () => {
    for (const artifactClass of [
        "local-executable-extension",
        "stdio-mcp-server",
        "remote-mcp-server",
    ])
        assert.throws(
            () =>
                buildReleaseAssuranceReceipt({
                    artifactClasses: [artifactClass],
                    assurances: [],
                    releaseManifest: "release-manifest.json",
                }),
            /missing executable assurances/,
        );
});
