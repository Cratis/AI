// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readTarGzip } from "../package-fundamentals-preview-assets.mjs";
import {
    materializeFundamentalsPreviewNpmAsset,
    packageFundamentalsPreviewNpm,
} from "../package-fundamentals-preview-npm.mjs";

function withTemporaryDirectory(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-fundamentals-preview-npm-"));
    try {
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

const ready = Object.freeze({
    state: "READY_FOR_PREVIEW_REQUEST",
    assuranceMode: "basic",
    profileId: "public-fundamentals",
    packageName: "@cratis/ai-fundamentals",
    previewRequestEligible: true,
    supportGranted: false,
});

test("publishable Fundamentals preview npm asset is deterministic and scriptless", () => {
    withTemporaryDirectory((root) => {
        const firstRoot = join(root, "first");
        const secondRoot = join(root, "second");
        const first = materializeFundamentalsPreviewNpmAsset({
            outputRoot: firstRoot,
            version: "0.1.0-preview.1",
            readiness: ready,
        });
        const second = materializeFundamentalsPreviewNpmAsset({
            outputRoot: secondRoot,
            version: "0.1.0-preview.1",
            readiness: ready,
        });
        assert.deepEqual(second, first);
        assert.equal(first.state, "PASSIVE_PREVIEW_NPM_STAGED");
        assert.equal(first.packageName, "@cratis/ai-fundamentals");
        assert.equal(first.previewPublicationEligible, true);
        assert.equal(first.supportGranted, false);
        assert.equal(first.stablePromotionEligible, false);
        assert.deepEqual(
            readFileSync(join(firstRoot, first.filename)),
            readFileSync(join(secondRoot, second.filename)),
        );
        const files = readTarGzip(
            readFileSync(join(firstRoot, first.filename)),
        );
        const packageJson = JSON.parse(
            files.get("package/package.json").toString("utf8"),
        );
        assert.equal(packageJson.name, "@cratis/ai-fundamentals");
        assert.equal(packageJson.version, "0.1.0-preview.1");
        assert.notEqual(packageJson.private, true);
        assert.equal(packageJson.scripts, undefined);
        assert.equal(packageJson.dependencies, undefined);
        assert.equal(
            packageJson.repository.url,
            "https://github.com/Cratis/AI",
        );
        assert(files.has("package/skills/cratis-fundamentals-concept/SKILL.md"));
        const checksums = readFileSync(join(firstRoot, "SHA256SUMS"), "utf8");
        assert(checksums.includes(first.filename));
        assert(checksums.includes("preview-npm-manifest.json"));
    });
});

test("current owner setup blocks publishable preview staging", () => {
    withTemporaryDirectory((root) => {
        assert.throws(
            () =>
                packageFundamentalsPreviewNpm({
                    outputRoot: join(root, "blocked"),
                    version: "0.1.0-preview.1",
                }),
            /does not authorize npm staging/,
        );
    });
});

test("publishable preview staging rejects stable and malformed versions", () => {
    withTemporaryDirectory((root) => {
        for (const version of ["1.0.0", "latest", "0.1.0-preview"]) {
            assert.throws(
                () =>
                    materializeFundamentalsPreviewNpmAsset({
                        outputRoot: join(
                            root,
                            version.replaceAll(/[^a-z0-9]/gi, "-"),
                        ),
                        version,
                        readiness: ready,
                    }),
                /must match 0\.MINOR\.PATCH-preview\.N/,
            );
        }
    });
});
