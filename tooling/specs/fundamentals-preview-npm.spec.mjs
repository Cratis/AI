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
    packageFundamentalsNpmRelease,
    packageFundamentalsPreviewNpm,
} from "../package-fundamentals-preview-npm.mjs";
import {
    smokeFundamentalsPreviewNpm,
    smokeFundamentalsPreviewNpmTransition,
} from "../smoke-fundamentals-preview-npm.mjs";

function withTemporaryDirectory(callback) {
    const root = mkdtempSync(
        join(tmpdir(), "cratis-fundamentals-preview-npm-"),
    );
    try {
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

const request = Object.freeze({
    id: "public-fundamentals-0-1-0-preview-1",
    state: "preview-on-merge",
    profileId: "public-fundamentals",
    packageName: "@cratis/ai-fundamentals",
    version: "0.1.0-preview.1",
    sourceRevision: "b53caa555b9a3f05ba1462b86202fe3ccb8a9470",
    sourceContentDigest:
        "9e537c48a95c414709008c69ebfb616354d60992578ddd9da3d7dc7308c42caa",
    assuranceMode: "basic",
    supportClaim: false,
    releaseNotes: "Preview",
});

const ready = Object.freeze({
    state: "READY_FOR_PREVIEW_REQUEST",
    assuranceMode: "basic",
    profileId: "public-fundamentals",
    packageName: "@cratis/ai-fundamentals",
    previewRequestEligible: true,
    supportGranted: false,
});

const currentRequest = Object.freeze(
    JSON.parse(
        readFileSync("distribution/preview-requests.json", "utf8"),
    ).requests.at(-1),
);

test("publishable Fundamentals preview npm asset is deterministic and scriptless", () => {
    withTemporaryDirectory((root) => {
        const firstRoot = join(root, "first");
        const secondRoot = join(root, "second");
        const first = materializeFundamentalsPreviewNpmAsset({
            outputRoot: firstRoot,
            version: "0.1.0-preview.1",
            readiness: ready,
            request,
        });
        const second = materializeFundamentalsPreviewNpmAsset({
            outputRoot: secondRoot,
            version: "0.1.0-preview.1",
            readiness: ready,
            request,
        });
        assert.deepEqual(second, first);
        assert.equal(first.state, "PASSIVE_NPM_STAGED");
        assert.equal(first.packageName, "@cratis/ai-fundamentals");
        assert.equal(first.distTag, "preview");
        assert.equal(first.publicationEligible, true);
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
        assert.deepEqual(packageJson, {
            name: "@cratis/ai-fundamentals",
            version: "0.1.0-preview.1",
            description: "Cratis Fundamentals concept guidance",
            private: false,
            license: "MIT",
            repository: {
                type: "git",
                url: "https://github.com/Cratis/AI",
            },
            homepage: "https://cratis.io/ai",
            files: ["skills"],
            keywords: ["pi-package", "cratis"],
            pi: {
                skills: ["./skills"],
            },
        });
        assert(
            files.has("package/skills/cratis-fundamentals-concept/SKILL.md"),
        );
        const readme = files.get("package/README.md").toString("utf8");
        assert(
            readme.includes(
                "pi install npm:@cratis/ai-fundamentals@0.1.0-preview.1",
            ),
        );
        assert(
            readme.includes(
                "pi install -l npm:@cratis/ai-fundamentals@0.1.0-preview.1",
            ),
        );
        assert(readme.includes("unsupported evaluation release"));
        const checksums = readFileSync(join(firstRoot, "SHA256SUMS"), "utf8");
        assert(checksums.includes(first.filename));
        assert(checksums.includes("preview-npm-manifest.json"));
    });
});

test("public preview archive passes exact lifecycle and A-to-B-to-A transition", () => {
    withTemporaryDirectory((root) => {
        const previousRequest = {
            ...request,
            id: "public-fundamentals-0-1-0-preview-0",
            version: "0.1.0-preview.0",
        };
        const previous = materializeFundamentalsPreviewNpmAsset({
            outputRoot: join(root, "previous"),
            version: previousRequest.version,
            readiness: ready,
            request: previousRequest,
        });
        const current = materializeFundamentalsPreviewNpmAsset({
            outputRoot: join(root, "current"),
            version: request.version,
            readiness: ready,
            request,
        });
        const currentArchive = join(root, "current", current.filename);
        const smoke = smokeFundamentalsPreviewNpm({
            archivePath: currentArchive,
            expectedVersion: request.version,
        });
        assert.deepEqual(smoke.phases, [
            "install",
            "discovery",
            "uninstall",
            "rollback-reinstall",
            "cleanup",
            "project-context-preservation",
        ]);
        const transition = smokeFundamentalsPreviewNpmTransition({
            previousArchivePath: join(root, "previous", previous.filename),
            previousVersion: previousRequest.version,
            currentArchivePath: currentArchive,
            currentVersion: request.version,
        });
        assert.deepEqual(transition.phases, [
            "install-previous",
            "update-current",
            "rollback-previous",
            "uninstall",
            "cleanup",
            "project-context-preservation",
        ]);
        assert.equal(transition.networkAccessPerformed, false);
        assert.equal(transition.supportGranted, false);
    });
});

test("publishable preview staging requires exact request source authority", () => {
    withTemporaryDirectory((root) => {
        assert.throws(
            () =>
                materializeFundamentalsPreviewNpmAsset({
                    outputRoot: join(root, "wrong-source"),
                    version: request.version,
                    readiness: ready,
                    request: {
                        ...request,
                        sourceContentDigest: "0".repeat(64),
                    },
                }),
            /source does not match immutable authority/,
        );
    });
});

test("current request stages the exact publishable preview", () => {
    withTemporaryDirectory((root) => {
        const manifest = packageFundamentalsPreviewNpm({
            outputRoot: join(root, "current-request"),
            version: currentRequest.version,
        });
        assert.equal(manifest.requestId, currentRequest.id);
        assert.equal(manifest.version, currentRequest.version);
        assert.equal(manifest.sourceRevision, currentRequest.sourceRevision);
        assert.equal(manifest.previewPublicationEligible, true);
        assert.equal(manifest.supportGranted, false);
    });
});

test("normal release stages a support-free 0.x package for latest", () => {
    withTemporaryDirectory((root) => {
        const manifest = packageFundamentalsNpmRelease({
            outputRoot: join(root, "release"),
            version: "0.1.0",
        });
        assert.equal(manifest.state, "PASSIVE_NPM_STAGED");
        assert.equal(manifest.version, "0.1.0");
        assert.equal(manifest.distTag, "latest");
        assert.equal(manifest.publicationEligible, true);
        assert.equal(manifest.previewPublicationEligible, false);
        assert.equal(manifest.supportGranted, false);
        assert.equal(manifest.stablePromotionEligible, false);
        const files = readTarGzip(
            readFileSync(join(root, "release", manifest.filename)),
        );
        const readme = files.get("package/README.md").toString("utf8");
        assert(readme.includes("pi install npm:@cratis/ai-fundamentals@0.1.0"));
        assert(readme.includes("pi -e npm:@cratis/ai-fundamentals@0.1.0"));
    });
});

test("npm staging rejects 1.x and malformed versions", () => {
    withTemporaryDirectory((root) => {
        for (const version of [
            "1.0.0",
            "latest",
            "0.1.0-preview",
            "0.1.0-beta.1",
        ]) {
            assert.throws(
                () =>
                    materializeFundamentalsPreviewNpmAsset({
                        outputRoot: join(
                            root,
                            version.replaceAll(/[^a-z0-9]/gi, "-"),
                        ),
                        version,
                        readiness: ready,
                        request: { ...request, version },
                    }),
                /must match 0\.MINOR\.PATCH or 0\.MINOR\.PATCH-preview\.N/,
            );
        }
    });
});
