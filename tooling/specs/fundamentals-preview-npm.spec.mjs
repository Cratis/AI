// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import {
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
} from "node:fs";
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
    id: "cratis-fundamentals-0-1-0-preview-1",
    state: "preview-on-merge",
    profileId: "cratis/fundamentals",
    packageName: "@cratis/pi",
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
    profileId: "cratis/fundamentals",
    packageName: "@cratis/pi",
    previewRequestEligible: true,
    supportGranted: true,
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
        assert.equal(first.packageName, "@cratis/pi");
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
            name: "@cratis/pi",
            version: "0.1.0-preview.1",
            description:
                "The whole public Cratis AI skill set for building event-sourced and CQRS applications, delivered as a passive Pi package",
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
        // The package bundles the whole public skills directory — the same
        // content the marketplace manifests install for other harnesses.
        assert(
            files.has("package/skills/cratis-chronicle-projection/SKILL.md"),
        );
        const publicSkillDirectories = readdirSync("skills", {
            withFileTypes: true,
        })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort();
        assert.deepEqual(first.bundledSkillIds, publicSkillDirectories);
        assert.equal(first.bundledSkillCount, publicSkillDirectories.length);
        assert.match(first.bundleContentDigest, /^[0-9a-f]{64}$/);
        const readme = files.get("package/README.md").toString("utf8");
        assert(
            readme.includes("pi install npm:@cratis/pi"),
        );
        assert(
            readme.includes("pi install -l npm:@cratis/pi"),
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
            id: "cratis-fundamentals-0-1-0-preview-0",
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

test("normal release stages a support-free stable package for latest", () => {
    withTemporaryDirectory((root) => {
        const manifest = packageFundamentalsNpmRelease({
            outputRoot: join(root, "release"),
            version: "1.0.0",
        });
        assert.equal(manifest.state, "PASSIVE_NPM_STAGED");
        assert.equal(manifest.version, "1.0.0");
        assert.equal(manifest.distTag, "latest");
        assert.equal(manifest.publicationEligible, true);
        assert.equal(manifest.previewPublicationEligible, false);
        assert.equal(manifest.supportGranted, true);
        assert.equal(manifest.stablePromotionEligible, false);
        const files = readTarGzip(
            readFileSync(join(root, "release", manifest.filename)),
        );
        const readme = files.get("package/README.md").toString("utf8");
        assert(readme.includes("pi install npm:@cratis/pi"));
        assert(readme.includes("pi -e npm:@cratis/pi"));
        assert(readme.includes("supported stable release"));
    });
});

test("merged Samples registry canary remains exact and non-supporting", () => {
    const evidence = JSON.parse(
        readFileSync(
            "distribution/evidence/registry-fundamentals-samples-canary-0.1.1-2026-08-28.json",
            "utf8",
        ),
    );
    assert.equal(
        evidence.state,
        "REAL_REGISTRY_SAMPLES_CANARY_PASS_NON_SUPPORTING",
    );
    assert.equal(
        evidence.repositoryRevision,
        "c8d149adb8ffc2728f0c54886ad060a27048faa3",
    );
    assert.equal(evidence.package.version, "0.1.1");
    assert.equal(evidence.results.length, 9);
    assert(evidence.results.every((result) => result.status === "PASS"));
    assert.equal(evidence.installationSupported, false);
    assert.equal(evidence.behaviorSupported, false);
    assert.equal(evidence.supportGranted, false);
    assert.equal(evidence.promotionEligible, false);
});

test("npm staging rejects 0.x stable releases and malformed versions", () => {
    withTemporaryDirectory((root) => {
        // The release lane takes stable 1.0.0+ only.
        for (const version of [
            "0.1.0",
            "latest",
            "0.1.0-beta.1",
            "1.0.0-preview.1",
        ]) {
            assert.throws(
                () =>
                    materializeFundamentalsPreviewNpmAsset({
                        outputRoot: join(
                            root,
                            `release-${version.replaceAll(/[^a-z0-9]/gi, "-")}`,
                        ),
                        version,
                        readiness: ready,
                        request: {
                            ...request,
                            state: "release-on-merge",
                            version,
                        },
                    }),
                /must match MAJOR\.MINOR\.PATCH for a release or 0\.MINOR\.PATCH-preview\.N for a preview/,
            );
        }
        // The preview lane stays on 0.x preview tags.
        for (const version of ["1.0.0-preview.1", "0.1.0-preview", "2.0"]) {
            assert.throws(
                () =>
                    materializeFundamentalsPreviewNpmAsset({
                        outputRoot: join(
                            root,
                            `preview-${version.replaceAll(/[^a-z0-9]/gi, "-")}`,
                        ),
                        version,
                        readiness: ready,
                        request: {
                            ...request,
                            state: "preview-on-merge",
                            version,
                        },
                    }),
                /must match MAJOR\.MINOR\.PATCH for a release or 0\.MINOR\.PATCH-preview\.N for a preview/,
            );
        }
    });
});
