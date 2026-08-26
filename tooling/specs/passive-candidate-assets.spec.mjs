// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { passiveHarnesses } from "../harness-registry.mjs";
import {
    packagePassiveCandidateAssets,
    passiveCandidateConfigurations,
} from "../package-passive-candidate-assets.mjs";
import { readTarGzip } from "../package-fundamentals-preview-assets.mjs";

function withTemporaryDirectory(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-passive-candidates-"));
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
    if (!asset) throw new Error(`Missing ${harness} candidate asset`);
    return join(root, asset.filename);
}

function assertBlocked(manifest) {
    assert.equal(manifest.state, "PASSIVE_CANDIDATE_REVIEW_ONLY");
    assert.equal(manifest.approvalEligible, false);
    assert.equal(manifest.installationSupported, false);
    assert.equal(manifest.publicationEligible, false);
    assert.equal(manifest.runtimeEligible, false);
    assert.equal(manifest.supportGranted, false);
    assert.equal(manifest.promotionEligible, false);
    assert.equal(manifest.portableCompliance.approvalGranted, false);
    assert.equal(manifest.portableCompliance.supportGranted, false);
    assert.equal(manifest.portableCompliance.publicationGranted, false);
    assert.equal(manifest.portableCompliance.runtimeGranted, false);
    assert.equal(manifest.portableCompliance.promotionGranted, false);
    assert.equal(
        manifest.portableCompliance.staticValidationInput.supporting,
        false,
    );
}

test("passive candidate assets package every currently safe target and account for exclusions", () => {
    assert.equal(passiveHarnesses.length, 34);
    withTemporaryDirectory((root) => {
        const publicRoot = join(root, "public");
        const engineeringRoot = join(root, "engineering");
        const publicManifest = packagePassiveCandidateAssets({
            artifactId: "candidate-passive-public-package",
            outputRoot: publicRoot,
            version: "0.0.1-candidate.1",
        });
        const engineeringManifest = packagePassiveCandidateAssets({
            artifactId: "candidate-passive-engineering-package",
            outputRoot: engineeringRoot,
            version: "0.0.1-candidate.1",
        });
        assertBlocked(publicManifest);
        assertBlocked(engineeringManifest);
        assert.equal(publicManifest.targetIds.length, 34);
        assert.equal(publicManifest.sourceSkills.length, 34);
        assert.equal(publicManifest.targetExclusions.length, 3);
        assert.equal(engineeringManifest.targetIds.length, 7);
        assert.equal(engineeringManifest.sourceSkills.length, 7);
        assert.equal(engineeringManifest.targetExclusions.length, 1);
        assert.equal(
            publicManifest.targetIds.length +
                publicManifest.targetExclusions.length,
            37,
        );
        assert.equal(
            engineeringManifest.targetIds.length +
                engineeringManifest.targetExclusions.length,
            8,
        );
        assert.deepEqual(
            publicManifest.targetExclusions.map((item) => item.targetId),
            [
                "cratis-arc-observable-query-http",
                "cratis-chronicle-mcp-inspection",
                "cratis-studio-mcp-safety-guidance",
            ],
        );
        assert.deepEqual(engineeringManifest.targetExclusions, [
            {
                targetId: "cratis-engineering-docs-visual-qa",
                reason: "private-or-local-content",
            },
        ]);
        assert.deepEqual(publicManifest.repositoryOnlySkillExclusions, []);
        assert.deepEqual(
            engineeringManifest.repositoryOnlySkillExclusions.map(
                (item) => item.componentId,
            ),
            [
                "cratis-legacy-add-concept",
                "cratis-legacy-add-cratis-docs-page",
                "cratis-legacy-edit-cratis-docs",
                "cratis-legacy-write-documentation",
            ],
        );
        const skillComponentIds = JSON.parse(
            readFileSync("catalog/v2/components.json", "utf8"),
        ).components
            .filter((component) => component.kind === "skill")
            .map((component) => component.id)
            .sort();
        const accountedSkillComponentIds = [
            ...publicManifest.targetIds,
            ...publicManifest.targetExclusions.map((item) => item.targetId),
            ...publicManifest.repositoryOnlySkillExclusions.map(
                (item) => item.componentId,
            ),
            ...engineeringManifest.targetIds,
            ...engineeringManifest.targetExclusions.map(
                (item) => item.targetId,
            ),
            ...engineeringManifest.repositoryOnlySkillExclusions.map(
                (item) => item.componentId,
            ),
        ].sort();
        assert.equal(skillComponentIds.length, 49);
        assert.deepEqual(accountedSkillComponentIds, skillComponentIds);
        for (const manifest of [publicManifest, engineeringManifest]) {
            assert.equal(manifest.assets.length, passiveHarnesses.length);
            assert.match(manifest.sourceCommit, /^[0-9a-f]{40}$/);
            assert.match(manifest.generatorDigest, /^[0-9a-f]{64}$/);
            assert(
                manifest.sourceSkills.every(
                    (source) =>
                        source.packagedSourcePaths.length > 0 &&
                        source.packagedSourcePaths.every(
                            (path) => !path.includes("/evals/"),
                        ),
                ),
            );
            const sbom = JSON.parse(
                readFileSync(
                    join(
                        manifest === publicManifest
                            ? publicRoot
                            : engineeringRoot,
                        "candidate-sbom.json",
                    ),
                    "utf8",
                ),
            );
            assert.deepEqual(sbom.dependencies, []);
            assert.deepEqual(sbom.executableComponents, []);
            assert.equal(sbom.components.length, manifest.sourceSkills.length);
        }
    });
});

test("passive candidate archives are deterministic private and non-installable", () => {
    withTemporaryDirectory((root) => {
        const firstRoot = join(root, "first");
        const secondRoot = join(root, "second");
        const first = packagePassiveCandidateAssets({
            artifactId: "candidate-passive-public-package",
            outputRoot: firstRoot,
            version: "0.0.2-candidate.3",
        });
        const second = packagePassiveCandidateAssets({
            artifactId: "candidate-passive-public-package",
            outputRoot: secondRoot,
            version: "0.0.2-candidate.3",
        });
        assert.deepEqual(second, first);
        for (const asset of first.assets) {
            assert.deepEqual(
                readFileSync(join(firstRoot, asset.filename)),
                readFileSync(join(secondRoot, asset.filename)),
            );
            const files = readTarGzip(
                readFileSync(join(firstRoot, asset.filename)),
            );
            assert(files.size > first.sourceSkills.length);
            assert(
                [...files.keys()].every(
                    (path) =>
                        !path.includes("/evals/") &&
                        !path.endsWith("/mcp.json") &&
                        !path.includes("/.pi/extensions/"),
                ),
            );
        }
        const piFiles = readTarGzip(
            readFileSync(assetPath(firstRoot, first, "pi")),
        );
        const piPackage = JSON.parse(
            piFiles.get("package/package.json").toString("utf8"),
        );
        assert.equal(piPackage.name, "@cratis/ai-public-candidate");
        assert.equal(piPackage.private, true);
        assert.equal(piPackage.scripts, undefined);
        assert.equal(piPackage.dependencies, undefined);
        const codexFiles = readTarGzip(
            readFileSync(assetPath(firstRoot, first, "codex")),
        );
        const marketplacePath = [...codexFiles.keys()].find((path) =>
            path.endsWith("marketplace.json"),
        );
        const marketplace = JSON.parse(
            codexFiles.get(marketplacePath).toString("utf8"),
        );
        assert.equal(
            marketplace.plugins[0].policy.installation,
            "NOT_AVAILABLE",
        );
        const review = readFileSync(join(firstRoot, "REVIEW.md"), "utf8");
        assert.match(review, /not an installation recommendation/i);
        assert.match(review, /not.*supported package/i);
        const checksums = readFileSync(join(firstRoot, "SHA256SUMS"), "utf8");
        assert(checksums.includes("candidate-assets.json"));
        assert(checksums.includes("candidate-sbom.json"));
        assert(checksums.includes("candidate-support-matrix.json"));
        assert.equal(checksums.trim().split("\n").length, first.assets.length + 8);
    });
});

test("passive candidate packaging rejects release versions unknown artifacts and existing outputs", () => {
    withTemporaryDirectory((root) => {
        for (const version of [
            "latest",
            "1.0.0",
            "0.1.0-preview.1",
            "0.0.1-candidate",
        ]) {
            assert.throws(
                () =>
                    packagePassiveCandidateAssets({
                        artifactId: "candidate-passive-public-package",
                        outputRoot: join(
                            root,
                            `invalid-${version.replaceAll(/[^a-z0-9]/gi, "-")}`,
                        ),
                        version,
                    }),
                /must match 0\.0\.N-candidate\.N/,
            );
        }
        assert.throws(
            () =>
                packagePassiveCandidateAssets({
                    artifactId: "planned-passive-public-release",
                    outputRoot: join(root, "unknown"),
                    version: "0.0.1-candidate.1",
                }),
            /Unknown passive candidate artifact/,
        );
        const existingRoot = join(root, "existing");
        mkdirSync(existingRoot);
        assert.throws(
            () =>
                packagePassiveCandidateAssets({
                    artifactId: "candidate-passive-public-package",
                    outputRoot: existingRoot,
                    version: "0.0.1-candidate.1",
                }),
            /output must not exist/,
        );
        assert(existsSync(existingRoot));
    });
});

test("passive candidate workflow is manual read-only and short-lived", () => {
    const workflow = readFileSync(
        ".github/workflows/package-passive-candidate-assets.yml",
        "utf8",
    );
    for (const required of [
        "workflow_dispatch:",
        "permissions:\n  contents: read",
        "persist-credentials: false",
        "candidate-passive-public-package",
        "candidate-passive-engineering-package",
        "PASSIVE_CANDIDATE_REVIEW_ONLY",
        "installationSupported",
        "supportGranted",
        "retention-days: 7",
    ])
        assert(workflow.includes(required), required);
    for (const forbidden of [
        "pull_request:",
        "push:",
        "contents: write",
        "id-token: write",
        "packages: write",
        "secrets:",
        "npm publish",
        "gh release",
        "git push",
    ])
        assert.equal(workflow.includes(forbidden), false, forbidden);
});

test("passive candidate configuration is closed to the two audience review bundles", () => {
    assert.deepEqual(Object.keys(passiveCandidateConfigurations).sort(), [
        "candidate-passive-engineering-package",
        "candidate-passive-public-package",
    ]);
});
