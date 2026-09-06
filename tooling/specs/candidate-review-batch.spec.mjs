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
import { packageCandidateReviewBatch } from "../package-candidate-review-batch.mjs";
import { buildCandidateComponentCoverage } from "../candidate-component-coverage.mjs";
import { readComponentInventorySeals } from "../component-inventory-counts.mjs";
import { passiveHarnesses } from "../harness-registry.mjs";

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function withTemporaryDirectory(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-candidate-batch-"));
    try {
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("candidate review batch is deterministic complete and non-releasing", () => {
    const seals = readComponentInventorySeals();
    const coverage = buildCandidateComponentCoverage();
    withTemporaryDirectory((root) => {
        const firstRoot = join(root, "first");
        const secondRoot = join(root, "second");
        const first = packageCandidateReviewBatch({ outputRoot: firstRoot });
        const second = packageCandidateReviewBatch({ outputRoot: secondRoot });
        assert.deepEqual(second, first);
        assert.equal(first.state, "CANDIDATE_REVIEW_BATCH_ONLY");
        // Every count on the batch manifest is checked against the coverage document it packages
        // and against the one reviewed seal, never against a literal restated here.
        assert.equal(first.componentCount, seals.componentCount);
        assert.equal(
            first.packagedSkillTargetCount,
            coverage.byDisposition["skill-packaged-candidate"],
        );
        assert.equal(
            first.blockedSkillTargetCount,
            coverage.byDisposition["skill-blocked-candidate"],
        );
        assert.equal(
            first.repositoryOnlyLegacySkillCount,
            seals.byDisposition["skill-legacy-repository-only"],
        );
        assert.equal(
            first.nativeProjectedComponentCount,
            seals.byDisposition["native-static-review-projected"],
        );
        assert.equal(
            first.nativeUnprojectedComponentCount,
            seals.byDisposition["native-static-unprojected"],
        );
        assert.equal(first.skillAssetCount, 2 * passiveHarnesses.length);
        assert(first.nativeAssetCount > 0);
        assert.equal(first.roots.length, 3);
        assert.match(first.sourceCommit, /^[0-9a-f]{40}$/);
        assert.match(first.componentCoverageSha256, /^[0-9a-f]{64}$/);
        for (const field of [
            "approvalEligible",
            "installationSupported",
            "publicationEligible",
            "runtimeEligible",
            "supportGranted",
            "promotionEligible",
        ])
            assert.equal(first[field], false, field);
        const schema = JSON.parse(readFileSync(first.schemaPath, "utf8"));
        assert.deepEqual(validateSchemaVocabulary(schema), []);
        assert.deepEqual(validateAgainstSchema(first, schema, schema), []);
        assert.equal(
            first.schemaSha256,
            sha256(readFileSync(first.schemaPath)),
        );
        const firstChecksums = readFileSync(
            join(firstRoot, "SHA256SUMS"),
            "utf8",
        );
        const secondChecksums = readFileSync(
            join(secondRoot, "SHA256SUMS"),
            "utf8",
        );
        assert.equal(secondChecksums, firstChecksums);
        assert(firstChecksums.includes("candidate-batch.json"));
        assert(firstChecksums.includes("public/candidate-assets.json"));
        assert(firstChecksums.includes("engineering/candidate-assets.json"));
        assert(
            firstChecksums.includes(
                "native-non-skill/native-review-assets.json",
            ),
        );
    });
});

test("candidate review batch rejects release versions and existing roots", () => {
    withTemporaryDirectory((root) => {
        assert.throws(
            () =>
                packageCandidateReviewBatch({
                    outputRoot: join(root, "release"),
                    version: "1.0.0",
                }),
            /must match 0\.0\.N-candidate\.N/,
        );
        const existing = join(root, "existing");
        packageCandidateReviewBatch({ outputRoot: existing });
        assert.throws(
            () => packageCandidateReviewBatch({ outputRoot: existing }),
            /output must not exist/,
        );
    });
});
