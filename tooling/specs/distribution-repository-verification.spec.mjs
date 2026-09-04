// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
    cpSync,
    mkdtempSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { generateDistributionFixture } from "../generate-distribution-fixture.mjs";
import { generatePublicMarketplaceDistribution } from "../generate-public-marketplace-distribution.mjs";
import { packagePassiveCandidateAssets } from "../package-passive-candidate-assets.mjs";
import {
    distributionCheckNames,
    verifyDistributionCheck,
} from "../../distribution/repository-control-plane/.github/scripts/verify-generated-distribution.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);
const contract = JSON.parse(
    readFileSync(
        join(repositoryRoot, "distribution/generated-repository-contract.json"),
        "utf8",
    ),
);
const controlPlaneRoot = join(
    repositoryRoot,
    contract.repositoryControlPlane.sourceRoot,
);

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function withTemporaryDirectory(callback) {
    const root = mkdtempSync(
        join(tmpdir(), "cratis-distribution-verification-"),
    );
    try {
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function installCandidate(distributionRoot, artifactId, version) {
    const parent = join(distributionRoot, "candidates", artifactId);
    mkdirSync(parent, { recursive: true });
    packagePassiveCandidateAssets({
        repositoryRoot,
        artifactId,
        version,
        outputRoot: join(parent, version),
    });
}

function installControlPlane(distributionRoot) {
    for (const path of contract.repositoryControlPlane.allowedPaths) {
        const destination = join(distributionRoot, path);
        mkdirSync(dirname(destination), { recursive: true });
        cpSync(join(controlPlaneRoot, path), destination);
    }
}

test("generated repository verification runs every exact non-supporting check", () => {
    withTemporaryDirectory((root) => {
        const beforeRoot = join(root, "before");
        const candidateRoot = join(root, "candidate");
        generateDistributionFixture({
            repositoryRoot,
            outputRoot: beforeRoot,
            version: "0.0.1-fixture",
        });
        generateDistributionFixture({
            repositoryRoot,
            outputRoot: candidateRoot,
            version: "0.0.2-fixture",
        });
        installControlPlane(candidateRoot);
        installCandidate(
            candidateRoot,
            "candidate-passive-public-package",
            "0.0.1-candidate.1",
        );
        for (const check of distributionCheckNames) {
            const result = verifyDistributionCheck({
                root: candidateRoot,
                check,
                beforeRoot,
            });
            assert.deepEqual(result, {
                check,
                status: "PASS",
                supporting: false,
            });
        }
    });
});

test("generated repository verification accepts the public marketplace transition", () => {
    withTemporaryDirectory((root) => {
        const beforeRoot = join(root, "before");
        const marketplaceRoot = join(root, "marketplace");
        generateDistributionFixture({
            repositoryRoot,
            outputRoot: beforeRoot,
            version: "0.0.1-fixture",
        });
        generatePublicMarketplaceDistribution({
            repositoryRoot,
            outputRoot: marketplaceRoot,
            version: "0.2.0",
        });
        installControlPlane(marketplaceRoot);
        for (const check of distributionCheckNames) {
            const result = verifyDistributionCheck({
                root: marketplaceRoot,
                check,
                beforeRoot,
            });
            assert.deepEqual(result, {
                check,
                status: "PASS",
                supporting: false,
            });
        }
    });
});

test("generated repository verification rejects marketplace support drift", () => {
    withTemporaryDirectory((root) => {
        const marketplaceRoot = join(root, "marketplace");
        generatePublicMarketplaceDistribution({
            repositoryRoot,
            outputRoot: marketplaceRoot,
            version: "0.2.0",
        });
        const manifestPath = join(
            marketplaceRoot,
            "distribution-manifest.json",
        );
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        manifest.supportGranted = true;
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
        assert.throws(
            () =>
                verifyDistributionCheck({
                    root: marketplaceRoot,
                    check: "fixture-provenance-record",
                }),
            /Marketplace provenance or eligibility state changed/,
        );
    });
});

test("generated repository verification accepts the published candidate skill split", () => {
    withTemporaryDirectory((root) => {
        const candidateRoot = join(root, "candidate");
        generateDistributionFixture({
            repositoryRoot,
            outputRoot: candidateRoot,
        });
        installCandidate(
            candidateRoot,
            "candidate-passive-public-package",
            "0.0.1-candidate.1",
        );
        const reviewRoot = join(
            candidateRoot,
            "candidates/candidate-passive-public-package/0.0.1-candidate.1",
        );
        const coveragePath = join(
            reviewRoot,
            "candidate-component-coverage.json",
        );
        const coverage = JSON.parse(readFileSync(coveragePath, "utf8"));
        const record = coverage.records.find(
            (entry) => entry.disposition === "skill-blocked-candidate",
        );
        record.disposition = "skill-packaged-candidate";
        coverage.byDisposition["skill-blocked-candidate"] -= 1;
        coverage.byDisposition["skill-packaged-candidate"] += 1;
        assert.equal(coverage.byDisposition["skill-packaged-candidate"], 41);
        assert.equal(coverage.byDisposition["skill-blocked-candidate"], 4);
        const coverageContent = `${JSON.stringify(coverage, null, 2)}\n`;
        writeFileSync(coveragePath, coverageContent);
        const assetsPath = join(reviewRoot, "candidate-assets.json");
        const assets = JSON.parse(readFileSync(assetsPath, "utf8"));
        assets.componentCoverageSha256 = sha256(coverageContent);
        const assetsContent = `${JSON.stringify(assets, null, 2)}\n`;
        writeFileSync(assetsPath, assetsContent);
        const checksumsPath = join(reviewRoot, "SHA256SUMS");
        const digests = new Map([
            ["candidate-component-coverage.json", sha256(coverageContent)],
            ["candidate-assets.json", sha256(assetsContent)],
        ]);
        const checksums = readFileSync(checksumsPath, "utf8")
            .trimEnd()
            .split("\n")
            .map((line) => {
                const path = line.slice(66);
                return digests.has(path)
                    ? `${digests.get(path)}  ${path}`
                    : line;
            });
        writeFileSync(checksumsPath, `${checksums.join("\n")}\n`);
        const result = verifyDistributionCheck({
            root: candidateRoot,
            check: "exact-inventory",
        });
        assert.deepEqual(result, {
            check: "exact-inventory",
            status: "PASS",
            supporting: false,
        });
    });
});

test("generated repository verification rejects marketplace eligibility drift", () => {
    withTemporaryDirectory((root) => {
        const marketplaceRoot = join(root, "marketplace");
        generatePublicMarketplaceDistribution({
            repositoryRoot,
            outputRoot: marketplaceRoot,
            version: "0.3.0",
        });
        const provenancePath = join(marketplaceRoot, "provenance.json");
        const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
        provenance.eligibility.policySha256 = "0".repeat(64);
        const provenanceContent = `${JSON.stringify(provenance, null, 2)}\n`;
        writeFileSync(provenancePath, provenanceContent);
        const manifestPath = join(
            marketplaceRoot,
            "distribution-manifest.json",
        );
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        const provenanceRecord = manifest.files.find(
            (file) => file.path === "provenance.json",
        );
        provenanceRecord.size = Buffer.byteLength(provenanceContent);
        provenanceRecord.sha256 = sha256(provenanceContent);
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
        assert.throws(
            () =>
                verifyDistributionCheck({
                    root: marketplaceRoot,
                    check: "fixture-provenance-record",
                }),
            /Marketplace provenance or eligibility state changed/,
        );
    });
});

test("generated repository verification rejects candidate component authority drift", () => {
    withTemporaryDirectory((root) => {
        const candidateRoot = join(root, "candidate");
        generateDistributionFixture({
            repositoryRoot,
            outputRoot: candidateRoot,
        });
        installCandidate(
            candidateRoot,
            "candidate-passive-public-package",
            "0.0.1-candidate.1",
        );
        const reviewRoot = join(
            candidateRoot,
            "candidates/candidate-passive-public-package/0.0.1-candidate.1",
        );
        const coveragePath = join(
            reviewRoot,
            "candidate-component-coverage.json",
        );
        const manifestPath = join(reviewRoot, "candidate-assets.json");
        const coverage = JSON.parse(readFileSync(coveragePath, "utf8"));
        coverage.supportGranted = true;
        const coverageContent = `${JSON.stringify(coverage, null, 2)}\n`;
        writeFileSync(coveragePath, coverageContent);
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        manifest.componentCoverageSha256 = sha256(coverageContent);
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
        assert.throws(
            () =>
                verifyDistributionCheck({
                    root: candidateRoot,
                    check: "exact-inventory",
                }),
            /component coverage authority changed/,
        );
    });
});

test("generated repository verification rejects candidate checksum drift", () => {
    withTemporaryDirectory((root) => {
        const candidateRoot = join(root, "candidate");
        generateDistributionFixture({
            repositoryRoot,
            outputRoot: candidateRoot,
        });
        installCandidate(
            candidateRoot,
            "candidate-passive-engineering-package",
            "0.0.1-candidate.1",
        );
        writeFileSync(
            join(
                candidateRoot,
                "candidates/candidate-passive-engineering-package/0.0.1-candidate.1/REVIEW.md",
            ),
            "tampered\n",
        );
        assert.throws(
            () =>
                verifyDistributionCheck({
                    root: candidateRoot,
                    check: "exact-inventory",
                }),
            /checksum verification failed/,
        );
    });
});

test("generated repository verification rejects unreviewed control-plane files", () => {
    withTemporaryDirectory((root) => {
        const candidateRoot = join(root, "candidate");
        generateDistributionFixture({
            repositoryRoot,
            outputRoot: candidateRoot,
        });
        installControlPlane(candidateRoot);
        writeFileSync(
            join(candidateRoot, ".github/workflows/unreviewed.yml"),
            "name: Unreviewed\n",
        );
        assert.throws(
            () =>
                verifyDistributionCheck({
                    root: candidateRoot,
                    check: "exact-inventory",
                }),
            /control-plane inventory changed/,
        );
    });
});

test("generated repository verification rejects manifested payload drift", () => {
    withTemporaryDirectory((root) => {
        const candidateRoot = join(root, "candidate");
        generateDistributionFixture({
            repositoryRoot,
            outputRoot: candidateRoot,
        });
        const manifest = JSON.parse(
            readFileSync(
                join(candidateRoot, "distribution-manifest.json"),
                "utf8",
            ),
        );
        writeFileSync(
            join(candidateRoot, manifest.files[0].path),
            "tampered\n",
        );
        assert.throws(
            () =>
                verifyDistributionCheck({
                    root: candidateRoot,
                    check: "exact-inventory",
                }),
            /digest mismatch/,
        );
    });
});

test("generated repository verification rejects duplicate JSON keys", () => {
    withTemporaryDirectory((root) => {
        const candidateRoot = join(root, "candidate");
        generateDistributionFixture({
            repositoryRoot,
            outputRoot: candidateRoot,
        });
        const manifestPath = join(candidateRoot, "distribution-manifest.json");
        const manifest = readFileSync(manifestPath, "utf8");
        writeFileSync(
            manifestPath,
            manifest.replace(
                '  "schemaVersion": "1.0.0",',
                '  "schemaVersion": "1.0.0",\n  "schemaVersion": "1.0.0",',
            ),
        );
        assert.throws(
            () =>
                verifyDistributionCheck({
                    root: candidateRoot,
                    check: "exact-inventory",
                }),
            /Unable to parse JSON/,
        );
    });
});

test("pack smoke rejects dependency-bearing packages before npm execution", () => {
    withTemporaryDirectory((root) => {
        const candidateRoot = join(root, "candidate");
        generateDistributionFixture({
            repositoryRoot,
            outputRoot: candidateRoot,
        });
        const manifestPath = join(candidateRoot, "distribution-manifest.json");
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        const packageRecord = manifest.files.find((file) =>
            file.path.endsWith("pi/package/package.json"),
        );
        assert(packageRecord);
        const packagePath = join(candidateRoot, packageRecord.path);
        const packageValue = JSON.parse(readFileSync(packagePath, "utf8"));
        packageValue.dependencies = { malicious: "1.0.0" };
        const packageContent = `${JSON.stringify(packageValue, null, 2)}\n`;
        writeFileSync(packagePath, packageContent);
        packageRecord.size = Buffer.byteLength(packageContent);
        packageRecord.sha256 = sha256(packageContent);
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
        assert.throws(
            () =>
                verifyDistributionCheck({
                    root: candidateRoot,
                    check: "pack-install-smoke-uninstall",
                }),
            /package dependencies must be empty/,
        );
    });
});

test("Distribution workflow exposes the exact read-only required checks", () => {
    const workflow = readFileSync(
        join(
            controlPlaneRoot,
            ".github/workflows/verify-generated-distribution.yml",
        ),
        "utf8",
    );
    assert.deepEqual(distributionCheckNames, contract.requiredChecks);
    for (const check of distributionCheckNames)
        assert(workflow.includes(`          - ${check}`), check);
    for (const required of [
        "permissions:\n  contents: read",
        "persist-credentials: false",
        "github.event.pull_request.head.sha",
        "$GITHUB_WORKSPACE/previous/.github/scripts/verify-generated-distribution.mjs",
        "fail-fast: false",
        "supporting: false",
    ]) {
        if (required === "supporting: false") {
            const validator = readFileSync(
                join(
                    controlPlaneRoot,
                    ".github/scripts/verify-generated-distribution.mjs",
                ),
                "utf8",
            );
            assert(validator.includes(required), required);
        } else {
            assert(workflow.includes(required), required);
        }
    }
    for (const forbidden of [
        "pull_request_target:",
        "contents: write",
        "id-token: write",
        "pull-requests: write",
        "secrets:",
        "npm publish",
        "gh release",
        "git push",
    ])
        assert.equal(workflow.includes(forbidden), false, forbidden);
});
