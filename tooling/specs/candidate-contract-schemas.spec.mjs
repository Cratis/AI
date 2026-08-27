// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "../catalog-validation.mjs";
import { packageNativeNonSkillReviewAssets } from "../package-native-non-skill-review-assets.mjs";
import { packagePassiveCandidateAssets } from "../package-passive-candidate-assets.mjs";

const schemas = {
    passive: "distribution/passive-candidate-assets.schema.json",
    coverage: "distribution/candidate-component-coverage.schema.json",
    native: "distribution/native-non-skill-review-assets.schema.json",
};

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

function withTemporaryDirectory(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-candidate-schemas-"));
    try {
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function validate(value, schemaPath) {
    const schema = readJson(schemaPath);
    return [
        ...validateSchemaVocabulary(schema),
        ...validateAgainstSchema(value, schema, schema),
    ];
}

test("candidate contract schemas are closed and accept generated review records", () => {
    withTemporaryDirectory((root) => {
        const publicRoot = join(root, "public");
        const engineeringRoot = join(root, "engineering");
        const nativeRoot = join(root, "native");
        const publicManifest = packagePassiveCandidateAssets({
            artifactId: "candidate-passive-public-package",
            outputRoot: publicRoot,
        });
        const engineeringManifest = packagePassiveCandidateAssets({
            artifactId: "candidate-passive-engineering-package",
            outputRoot: engineeringRoot,
        });
        const nativeManifest = packageNativeNonSkillReviewAssets({
            outputRoot: nativeRoot,
        });
        for (const [manifest, outputRoot] of [
            [publicManifest, publicRoot],
            [engineeringManifest, engineeringRoot],
        ]) {
            assert.deepEqual(validate(manifest, schemas.passive), []);
            assert.equal(
                manifest.schemaSha256,
                sha256(readFileSync(schemas.passive)),
            );
            const coverage = readJson(
                join(outputRoot, manifest.componentCoveragePath),
            );
            assert.deepEqual(validate(coverage, schemas.coverage), []);
            assert.equal(
                coverage.schemaSha256,
                sha256(readFileSync(schemas.coverage)),
            );
        }
        assert.deepEqual(validate(nativeManifest, schemas.native), []);
        assert.equal(
            nativeManifest.schemaSha256,
            sha256(readFileSync(schemas.native)),
        );
        const nativeCoverage = readJson(
            join(nativeRoot, nativeManifest.componentCoveragePath),
        );
        assert.deepEqual(validate(nativeCoverage, schemas.coverage), []);
    });
});

test("candidate contract schemas reject grants count drift and unknown fields", () => {
    withTemporaryDirectory((root) => {
        const publicRoot = join(root, "public");
        const nativeRoot = join(root, "native");
        const manifest = packagePassiveCandidateAssets({
            artifactId: "candidate-passive-public-package",
            outputRoot: publicRoot,
        });
        manifest.runtimeEligible = true;
        manifest.unknownAuthority = true;
        const manifestErrors = validate(manifest, schemas.passive);
        assert(
            manifestErrors.some((error) =>
                error.includes("runtimeEligible: expected constant false"),
            ),
        );
        assert(
            manifestErrors.some((error) =>
                error.includes("unknown property unknownAuthority"),
            ),
        );
        const coverage = readJson(
            join(publicRoot, manifest.componentCoveragePath),
        );
        coverage.componentCount = 136;
        coverage.records[0].supportGranted = true;
        const coverageErrors = validate(coverage, schemas.coverage);
        assert(
            coverageErrors.some((error) =>
                error.includes("componentCount: expected constant 137"),
            ),
        );
        assert(
            coverageErrors.some((error) =>
                error.includes("supportGranted: expected constant false"),
            ),
        );
        const native = packageNativeNonSkillReviewAssets({
            outputRoot: nativeRoot,
        });
        native.packageIdentity = "invented-package";
        native.assets.pop();
        const nativeErrors = validate(native, schemas.native);
        assert(
            nativeErrors.some((error) =>
                error.includes("packageIdentity: expected null"),
            ),
        );
        assert(
            nativeErrors.some((error) =>
                error.includes("assets: must contain at least 4 items"),
            ),
        );
    });
});
