// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
    createTarGzip,
    packageFundamentalsPreviewAssets,
    readTarGzip,
} from "../package-fundamentals-preview-assets.mjs";
import { passiveHarnesses } from "../harness-registry.mjs";

function withTemporaryDirectory(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-preview-assets-"));
    try {
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function assetPath(root, manifest, harness) {
    const asset = manifest.assets.find(
        (candidate) => candidate.harness === harness,
    );
    if (!asset) throw new Error(`Missing ${harness} preview asset`);
    return join(root, asset.filename);
}

function packageVersion(consumerRoot) {
    return JSON.parse(
        readFileSync(
            join(
                consumerRoot,
                "node_modules/@cratis/ai-fundamentals/package.json",
            ),
            "utf8",
        ),
    ).version;
}

test("tar creation rejects traversal symlinks and path collisions", () => {
    withTemporaryDirectory((root) => {
        const sourceRoot = join(root, "source");
        mkdirSync(sourceRoot);
        writeFileSync(join(sourceRoot, "safe.txt"), "safe\n");
        writeFileSync(join(root, "outside.txt"), "outside\n");
        assert.throws(
            () => createTarGzip(sourceRoot, ["../outside.txt"]),
            /Tar source path is unsafe|escaped root/,
        );
        assert.throws(
            () => createTarGzip(sourceRoot, ["safe.txt"], "../package"),
            /Tar path prefix is unsafe/,
        );
        writeFileSync(join(sourceRoot, "SAFE.TXT"), "collision\n");
        symlinkSync(join(root, "outside.txt"), join(sourceRoot, "link.txt"));
        assert.throws(
            () => createTarGzip(sourceRoot, ["link.txt"]),
            /Tar source must be a regular file/,
        );
        assert.throws(
            () => createTarGzip(sourceRoot, ["safe.txt", "SAFE.TXT"]),
            /path collision/,
        );
    });
});

test("source-corrected Fundamentals preview assets remain approval-pending", () => {
    const evidence = JSON.parse(
        readFileSync(
            "distribution/evidence/local-fundamentals-preview-assets-b53caa5-2026-08-23.json",
            "utf8",
        ),
    );
    assert.equal(
        evidence.state,
        "PREVIEW_ASSET_STAGING_PASS_OWNER_APPROVAL_PENDING",
    );
    assert.equal(
        evidence.sourceRevision,
        "b53caa555b9a3f05ba1462b86202fe3ccb8a9470",
    );
    assert.equal(
        evidence.sourceContentDigest,
        "9e537c48a95c414709008c69ebfb616354d60992578ddd9da3d7dc7308c42caa",
    );
    assert.equal(evidence.assets.length, 11);
    assert(evidence.results.every((result) => result.status === "PASS"));
    assert.equal(evidence.approvalEligible, false);
    assert.equal(evidence.installationSupported, false);
    assert.equal(evidence.publicationEligible, false);
    assert.equal(evidence.promotionEligible, false);
});

test("hosted Fundamentals preview evidence remains short-lived and non-promoting", () => {
    const evidence = JSON.parse(
        readFileSync(
            "distribution/evidence/hosted-fundamentals-preview-assets-2026-08-23.json",
            "utf8",
        ),
    );
    assert.equal(evidence.status, "PASS_APPROVAL_PENDING");
    assert.equal(evidence.workflow.runId, 32646884884);
    assert.equal(
        evidence.workflow.sourceCommit,
        "9b13e6a24b8c2505b317a00e9406dc576469b98b",
    );
    assert.equal(evidence.workflow.conclusion, "success");
    assert.equal(
        evidence.artifact.name,
        "fundamentals-0.1.0-preview.1-approval-pending",
    );
    assert.equal(evidence.artifact.shortLived, true);
    assert.equal(evidence.approvalEligible, false);
    assert.equal(evidence.installationSupported, false);
    assert.equal(evidence.publicationEligible, false);
    assert.equal(evidence.promotionEligible, false);
});

test("recorded Fundamentals preview evidence is immutable and non-promoting", () => {
    const evidence = JSON.parse(
        readFileSync(
            "distribution/evidence/local-fundamentals-preview-assets-2026-08-23.json",
            "utf8",
        ),
    );
    assert.equal(evidence.state, "PREVIEW_ASSET_STAGING_PASS_APPROVAL_PENDING");
    assert.match(evidence.sourceCommit, /^[0-9a-f]{40}$/);
    const generatorHash = createHash("sha256");
    for (const path of [
        "tooling/package-fundamentals-preview-assets.mjs",
        "tooling/passive-profile-adapters.mjs",
    ]) {
        generatorHash.update(path);
        generatorHash.update("\0");
        generatorHash.update(
            execFileSync("git", ["show", `${evidence.sourceCommit}:${path}`]),
        );
        generatorHash.update("\0");
    }
    assert.equal(evidence.generatorDigest, generatorHash.digest("hex"));
    assert.equal(
        evidence.sourceRevision,
        "e9d161a70e25334bb468a33240bcf00f03f87522",
    );
    assert.equal(evidence.assets.length, 11);
    assert(evidence.results.every((result) => result.status === "PASS"));
    assert.equal(evidence.sbom.dependencies, 0);
    assert.equal(evidence.sbom.executableComponents, 0);
    assert.equal(evidence.approvalEligible, false);
    assert.equal(evidence.installationSupported, false);
    assert.equal(evidence.publicationEligible, false);
    assert.equal(evidence.promotionEligible, false);
});

test("Fundamentals preview assets are deterministic and non-publishable", () => {
    withTemporaryDirectory((root) => {
        const firstRoot = join(root, "first");
        const secondRoot = join(root, "second");
        const first = packageFundamentalsPreviewAssets({
            outputRoot: firstRoot,
            version: "0.1.0-preview.1",
        });
        const second = packageFundamentalsPreviewAssets({
            outputRoot: secondRoot,
            version: "0.1.0-preview.1",
        });
        assert.deepEqual(second, first);
        assert.equal(first.state, "PREVIEW_ASSETS_APPROVAL_PENDING");
        assert.equal(first.artifactId, "cratis-fundamentals-concept-preview");
        assert.equal(first.targetId, "cratis-fundamentals-concept");
        assert.equal(
            first.sourceRevision,
            "b53caa555b9a3f05ba1462b86202fe3ccb8a9470",
        );
        assert.equal(first.assets.length, passiveHarnesses.length);
        assert.match(first.generatorDigest, /^[0-9a-f]{64}$/);
        assert.deepEqual(first.generatorPaths, [
            "tooling/catalog-ordering.mjs",
            "tooling/catalog-validation.mjs",
            "tooling/deterministic-release-tree.mjs",
            "tooling/harness-registry.mjs",
            "tooling/package-fundamentals-preview-assets.mjs",
            "tooling/passive-profile-adapters.mjs",
            "tooling/portable-compliance-validation.mjs",
            "tooling/public-artifact-materializer.mjs",
            "tooling/release-assurance-validation.mjs",
            "tooling/release-context.mjs",
        ]);
        assert.match(
            first.deterministicReleaseTree.sourceProjectionManifestSha256,
            /^[0-9a-f]{64}$/,
        );
        assert.match(
            first.deterministicReleaseTree.releaseAssetManifestSha256,
            /^[0-9a-f]{64}$/,
        );
        assert.match(
            first.deterministicReleaseTree.assuranceReceiptSha256,
            /^[0-9a-f]{64}$/,
        );
        assert.equal(first.portableCompliance.profile, "cratis-passive-v1");
        assert.match(first.portableCompliance.profileDigest, /^[0-9a-f]{64}$/);
        assert.match(first.portableCompliance.receiptSha256, /^[0-9a-f]{64}$/);
        assert.equal(
            first.portableCompliance.staticValidationInput.supporting,
            false,
        );
        assert.equal(first.portableCompliance.approvalGranted, false);
        assert.equal(first.portableCompliance.supportGranted, false);
        assert.equal(first.portableCompliance.publicationGranted, false);
        assert.equal(first.approvalEligible, false);
        assert.equal(first.installationSupported, false);
        assert.equal(first.publicationEligible, false);
        assert.equal(first.promotionEligible, false);
        const releaseAssets = JSON.parse(
            readFileSync(
                join(
                    firstRoot,
                    first.deterministicReleaseTree.releaseAssetManifestPath,
                ),
                "utf8",
            ),
        );
        assert.deepEqual(
            releaseAssets.files.map((file) => file.path).sort(),
            first.assets.map((asset) => asset.filename).sort(),
        );
        for (const file of releaseAssets.files) {
            const asset = first.assets.find(
                (candidate) => candidate.filename === file.path,
            );
            assert.equal(file.sha256, asset.sha256);
            assert.equal(file.size, asset.size);
        }
        for (const asset of first.assets) {
            assert.match(asset.sha256, /^[0-9a-f]{64}$/);
            assert.deepEqual(
                readFileSync(join(firstRoot, asset.filename)),
                readFileSync(join(secondRoot, asset.filename)),
            );
            assert(
                readTarGzip(readFileSync(join(firstRoot, asset.filename)))
                    .size > 0,
            );
        }
        const sbom = JSON.parse(
            readFileSync(join(firstRoot, "preview-sbom.json"), "utf8"),
        );
        assert.equal(sbom.format, "cratis-passive-profile-sbom-v1");
        assert.deepEqual(sbom.licenseEvidence, {
            license: "MIT",
            path: "LICENSE",
            sha256: "8db23da452b8cee0e9aa8d49801000475bbcc30ab4e6e322e28d1146df7230a7",
        });
        assert.deepEqual(sbom.dependencies, []);
        assert.deepEqual(sbom.executableComponents, []);
        assert.deepEqual(
            sbom.components.map((component) => component.name),
            ["cratis-fundamentals-concept"],
        );
        const piFiles = readTarGzip(
            readFileSync(assetPath(firstRoot, first, "pi")),
        );
        const piPackage = JSON.parse(
            piFiles.get("package/package.json").toString("utf8"),
        );
        assert.equal(piPackage.name, "@cratis/ai-fundamentals");
        assert.equal(piPackage.private, true);
        assert.equal(piPackage.scripts, undefined);
        assert.equal(piPackage.dependencies, undefined);
        const codexFiles = readTarGzip(
            readFileSync(assetPath(firstRoot, first, "codex")),
        );
        const codexMarketplace = JSON.parse(
            codexFiles.get(".agents/plugins/marketplace.json").toString("utf8"),
        );
        assert.equal(
            codexMarketplace.plugins[0].policy.installation,
            "NOT_AVAILABLE",
        );
        assert.equal(
            codexMarketplace.plugins[0].policy.authentication,
            undefined,
        );
        const checksums = readFileSync(join(firstRoot, "SHA256SUMS"), "utf8");
        assert(checksums.includes("preview-assets.json"));
        assert(checksums.includes("preview-sbom.json"));
        assert(checksums.includes("deterministic-release-manifest.json"));
        assert(checksums.includes("release-asset-manifest.json"));
        assert(checksums.includes("artifact-assurance-receipt.json"));
        assert.equal(
            checksums.trim().split("\n").length,
            passiveHarnesses.length + 6,
        );
    });
});

test("preview asset generation fails closed on current authority drift", () => {
    withTemporaryDirectory((root) => {
        for (const version of ["latest", "1.0.0", "0.1.0-rc.1"]) {
            assert.throws(
                () =>
                    packageFundamentalsPreviewAssets({
                        outputRoot: join(
                            root,
                            `invalid-${version.replaceAll(/[^a-z0-9]/gi, "-")}`,
                        ),
                        version,
                    }),
                /must match 0\.MINOR\.PATCH-preview\.N/,
            );
        }
        const existing = join(root, "existing");
        mkdirSync(existing);
        assert.throws(
            () =>
                packageFundamentalsPreviewAssets({
                    outputRoot: existing,
                    version: "0.1.0-preview.1",
                }),
            /must not exist/,
        );
    });
});

test("Pi npm preview asset updates rolls back uninstalls and preserves context", () => {
    withTemporaryDirectory((root) => {
        const firstRoot = join(root, "first");
        const secondRoot = join(root, "second");
        const first = packageFundamentalsPreviewAssets({
            outputRoot: firstRoot,
            version: "0.1.0-preview.1",
        });
        const second = packageFundamentalsPreviewAssets({
            outputRoot: secondRoot,
            version: "0.1.0-preview.2",
        });
        const consumer = join(root, "consumer");
        mkdirSync(consumer);
        writeFileSync(
            join(consumer, "package.json"),
            `${JSON.stringify(
                { name: "preview-consumer", version: "1.0.0", private: true },
                null,
                2,
            )}\n`,
        );
        const context = {
            "AGENTS.md": "# Project instructions\n",
            ".cratis/PROJECT.md": "# Project context\n",
            ".cratis/ai.json": '{"version":"existing"}\n',
            ".pi/settings.json": '{"packages":[]}\n',
        };
        for (const [path, content] of Object.entries(context)) {
            mkdirSync(join(consumer, path, ".."), { recursive: true });
            writeFileSync(join(consumer, path), content);
        }
        const install = (tarball) =>
            execFileSync(
                "npm",
                [
                    "install",
                    tarball,
                    "--ignore-scripts",
                    "--no-audit",
                    "--no-fund",
                ],
                { cwd: consumer, stdio: "pipe" },
            );
        install(assetPath(firstRoot, first, "pi"));
        assert.equal(packageVersion(consumer), "0.1.0-preview.1");
        install(assetPath(secondRoot, second, "pi"));
        assert.equal(packageVersion(consumer), "0.1.0-preview.2");
        install(assetPath(firstRoot, first, "pi"));
        assert.equal(packageVersion(consumer), "0.1.0-preview.1");
        execFileSync(
            "npm",
            [
                "uninstall",
                "@cratis/ai-fundamentals",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
            ],
            { cwd: consumer, stdio: "pipe" },
        );
        assert.equal(
            existsSync(join(consumer, "node_modules/@cratis/ai-fundamentals")),
            false,
        );
        for (const [path, content] of Object.entries(context))
            assert.equal(readFileSync(join(consumer, path), "utf8"), content);
    });
});

test("Pi loads and removes the extracted exact preview package in an isolated home", {
    skip: "Real host execution moved to the explicit S9 runner",
}, () => {
    withTemporaryDirectory((root) => {
        const outputRoot = join(root, "assets");
        const manifest = packageFundamentalsPreviewAssets({
            outputRoot,
            version: "0.1.0-preview.1",
        });
        const extractRoot = join(root, "extract");
        mkdirSync(extractRoot);
        execFileSync(
            "tar",
            ["-xzf", assetPath(outputRoot, manifest, "pi"), "-C", extractRoot],
            { stdio: "pipe" },
        );
        const packageRoot = join(extractRoot, "package");
        const isolatedHome = join(root, "home");
        mkdirSync(isolatedHome);
        const environment = { ...process.env, HOME: isolatedHome };
        execFileSync("pi", ["install", packageRoot], {
            env: environment,
            stdio: "pipe",
        });
        assert(
            execFileSync("pi", ["list"], {
                env: environment,
                encoding: "utf8",
            }).includes(packageRoot),
        );
        execFileSync("pi", ["remove", packageRoot], {
            env: environment,
            stdio: "pipe",
        });
        assert(
            execFileSync("pi", ["list"], {
                env: environment,
                encoding: "utf8",
            }).includes("No packages installed"),
        );
    });
});
