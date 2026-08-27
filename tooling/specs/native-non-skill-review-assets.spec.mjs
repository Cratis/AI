// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readTarGzip } from "../package-fundamentals-preview-assets.mjs";
import { packageNativeNonSkillReviewAssets } from "../package-native-non-skill-review-assets.mjs";

function withTemporaryDirectory(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-native-review-assets-"));
    try {
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function assertBlocked(manifest) {
    assert.equal(manifest.state, "NATIVE_NON_SKILL_REVIEW_ONLY");
    assert.equal(manifest.approvalEligible, false);
    assert.equal(manifest.installationSupported, false);
    assert.equal(manifest.packageIdentity, null);
    assert.equal(manifest.publicationEligible, false);
    assert.equal(manifest.runtimeEligible, false);
    assert.equal(manifest.supportGranted, false);
    assert.equal(manifest.promotionEligible, false);
}

test("native non-skill review assets are deterministic exact and non-installable", () => {
    withTemporaryDirectory((root) => {
        const firstRoot = join(root, "first");
        const secondRoot = join(root, "second");
        const first = packageNativeNonSkillReviewAssets({
            outputRoot: firstRoot,
            version: "0.0.1-candidate.1",
        });
        const second = packageNativeNonSkillReviewAssets({
            outputRoot: secondRoot,
            version: "0.0.1-candidate.1",
        });
        assert.deepEqual(second, first);
        assertBlocked(first);
        assert.equal(first.rootCount, 4);
        assert.equal(first.projectedFileCount, 70);
        assert.equal(first.projectedComponentCount, 35);
        assert.deepEqual(
            first.assets.map((asset) => [asset.rootId, asset.fileCount]),
            [
                ["devin-hosted-instructions", 1],
                ["jetbrains-ai-assistant-rules", 34],
                ["tabnine-guidelines", 34],
                ["visual-studio-copilot-instructions", 1],
            ],
        );
        assert.deepEqual(
            first.componentExclusions.map((item) => item.componentId),
            [
                "cratis-rule-github-actions",
                "cratis-rule-local-work-artifacts",
            ],
        );
        for (const asset of first.assets) {
            assert.equal(asset.packageIdentity, null);
            assert.equal(asset.hostActivation, "none");
            assert.deepEqual(
                readFileSync(join(firstRoot, asset.filename)),
                readFileSync(join(secondRoot, asset.filename)),
            );
            const files = readTarGzip(
                readFileSync(join(firstRoot, asset.filename)),
            );
            assert.equal(files.size, asset.fileCount);
            for (const path of files.keys())
                assert.doesNotMatch(
                    path,
                    /(?:SKILL\.md|plugin\.json|package\.json|(?:^|\/)(?:scripts?|hooks?|mcp|lsp|agents?|prompts?|commands?)(?:\/|$))/iu,
                );
        }
        const receipt = JSON.parse(
            readFileSync(join(firstRoot, "projection-receipt.json"), "utf8"),
        );
        assert.equal(receipt.fileCount, 70);
        assert.equal(receipt.uniqueComponentCount, 35);
        assert.equal(receipt.hostTestingPerformed, false);
        assert.equal(receipt.installationPerformed, false);
        assert.equal(receipt.supportGranted, false);
        const coverage = JSON.parse(
            readFileSync(join(firstRoot, "component-coverage.json"), "utf8"),
        );
        assert.equal(coverage.componentCount, 137);
        const checksums = readFileSync(join(firstRoot, "SHA256SUMS"), "utf8");
        assert(checksums.includes("native-review-assets.json"));
        assert(checksums.includes("native-review-sbom.json"));
        assert.equal(checksums.trim().split("\n").length, first.assets.length + 5);
    });
});

test("native non-skill review packaging rejects release versions and existing outputs", () => {
    withTemporaryDirectory((root) => {
        for (const version of ["latest", "1.0.0", "0.1.0-preview.1"]) {
            assert.throws(
                () =>
                    packageNativeNonSkillReviewAssets({
                        outputRoot: join(
                            root,
                            `invalid-${version.replaceAll(/[^a-z0-9]/gi, "-")}`,
                        ),
                        version,
                    }),
                /must match 0\.0\.N-candidate\.N/,
            );
        }
        const existingRoot = join(root, "existing");
        mkdirSync(existingRoot);
        assert.throws(
            () =>
                packageNativeNonSkillReviewAssets({
                    outputRoot: existingRoot,
                }),
            /output must not exist/,
        );
    });
});
