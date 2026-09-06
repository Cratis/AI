// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { validateAgainstSchema } from "../catalog-validation.mjs";
import { distributionPointerOutputs } from "../component-catalog-validation.mjs";
import { generateDistributionFixture } from "../generate-distribution-fixture.mjs";
import {
    createMarketplacePointerManifests,
    generateMarketplacePointerManifests,
    marketplacePointerManifestPaths,
} from "../generate-marketplace-pointer-manifests.mjs";
import {
    generatePublicMarketplaceDistribution,
    publicMarketplaceDistributionTag,
    publicMarketplaceIdentity,
    selectEvaluationEligibleAuthority,
} from "../generate-public-marketplace-distribution.mjs";
import { loadPassiveCandidateAuthority } from "../package-passive-candidate-assets.mjs";
import { packagePublicMarketplaceSubmissions } from "../package-public-marketplace-submissions.mjs";
import { stagePublicMarketplaceRepository } from "../stage-public-marketplace-repository.mjs";
import {
    distributionCheckNames,
    verifyDistributionCheck,
} from "../../distribution/repository-control-plane/.github/scripts/verify-generated-distribution.mjs";

function withTemporaryDirectory(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-marketplace-spec-"));
    try {
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

function skillNames(root) {
    return readdirSync(join(root, "skills"), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
}

test("public marketplace distribution is deterministic and support-free", () => {
    withTemporaryDirectory((temporaryRoot) => {
        const firstRoot = join(temporaryRoot, "first");
        const secondRoot = join(temporaryRoot, "second");
        const first = generatePublicMarketplaceDistribution({
            outputRoot: firstRoot,
            version: "0.2.0",
        });
        const second = generatePublicMarketplaceDistribution({
            outputRoot: secondRoot,
            version: "0.2.0",
        });
        assert.deepEqual(second, first);
        const firstManifest = readFileSync(
            join(firstRoot, "distribution-manifest.json"),
        );
        assert.deepEqual(
            readFileSync(join(secondRoot, "distribution-manifest.json")),
            firstManifest,
        );
        assert.equal(first.release.targetCount, 29);
        assert.equal(first.release.skillCount, 29);
        assert.equal(first.provenance.resourceClosure.skillCount, 29);
        assert(first.provenance.resourceClosure.fileCount > 29);
        assert.equal(first.release.piDistribution, "git-only-private-manifest");
        assert.equal(first.release.installationAvailable, true);
        assert.equal(first.release.installationSupported, false);
        assert.equal(first.release.supportGranted, false);
        assert.equal(first.release.promotionEligible, false);
        assert.equal(skillNames(firstRoot).length, 29);
        assert.equal(
            skillNames(firstRoot).includes("inspect-running-chronicle"),
            false,
        );
    });
});

test("public evaluation policy closes every target and denies by default", () => {
    const policy = readJson("distribution/public-evaluation-eligibility.json");
    const schema = readJson(
        "distribution/public-evaluation-eligibility.schema.json",
    );
    const publicTargetIds = readJson("catalog/v2/targets.json")
        .targets.filter((target) => target.audience === "public")
        .map((target) => target.id)
        .sort();
    assert.deepEqual(validateAgainstSchema(policy, schema, schema), []);
    assert.equal(policy.defaultPolicy, "deny");
    assert.equal(policy.approval.state, "approved-for-unsupported-evaluation");
    assert.equal(policy.approval.reviewer, "woksin");
    assert.equal(policy.eligibleTargetIds.length, 29);
    assert.deepEqual(
        [
            ...policy.eligibleTargetIds,
            ...policy.excludedTargets.map((entry) => entry.targetId),
        ].sort(),
        publicTargetIds,
    );
    assert.equal(policy.installationSupported, false);
    assert.equal(policy.behaviorSupported, false);
    assert.equal(policy.supportGranted, false);
    assert.equal(policy.promotionEligible, false);
});

test("public evaluation selection rejects overlap and incomplete closure", () => {
    const authority = loadPassiveCandidateAuthority(
        process.cwd(),
        "candidate-passive-public-package",
    );
    const policy = readJson("distribution/public-evaluation-eligibility.json");
    const overlapping = structuredClone(policy);
    overlapping.eligibleTargetIds.push("cratis-chronicle-cli-operations");
    assert.throws(
        () =>
            selectEvaluationEligibleAuthority(authority, {
                policy: overlapping,
            }),
        /does not close the target inventory/,
    );
    const missing = structuredClone(policy);
    missing.excludedTargets.pop();
    assert.throws(
        () =>
            selectEvaluationEligibleAuthority(authority, {
                policy: missing,
            }),
        /does not close the target inventory/,
    );
});

test("marketplace root contains every first-class install shape", () => {
    withTemporaryDirectory((temporaryRoot) => {
        const root = join(temporaryRoot, "marketplace");
        const generated = generatePublicMarketplaceDistribution({
            outputRoot: root,
            version: "0.2.0",
        });
        for (const path of [
            "plugin.json",
            "package.json",
            "gemini-extension.json",
            ".claude-plugin/marketplace.json",
            ".github/plugin/marketplace.json",
            ".cursor-plugin/marketplace.json",
            ".agents/plugins/marketplace.json",
            "plugins/public-cratis-ai/.claude-plugin/plugin.json",
            "plugins/public-cratis-ai/.codex-plugin/plugin.json",
            "plugins/public-cratis-ai/plugin.json",
            "assets/cratis-logo.png",
            "plugins/public-cratis-ai/assets/cratis-logo.png",
            "README.md",
            "submissions/openai.json",
            "submissions/cursor.json",
            "SHA256SUMS",
            "provenance.json",
            "marketplace-release.json",
        ]) {
            assert(
                generated.manifest.files.some((file) => file.path === path),
                path,
            );
        }
        const codexManifest = readJson(
            join(root, "plugins/public-cratis-ai/.codex-plugin/plugin.json"),
        );
        assert.equal(codexManifest.author.name, "SINDRE ALSTAD WILTING");
        assert.equal(
            codexManifest.interface.developerName,
            "SINDRE ALSTAD WILTING",
        );
        assert.equal(
            codexManifest.interface.composerIcon,
            "./assets/cratis-logo.png",
        );
        assert.equal(codexManifest.interface.logo, "./assets/cratis-logo.png");
        assert.deepEqual(
            readFileSync(join(root, "assets/cratis-logo.png")),
            readFileSync(
                join(root, "plugins/public-cratis-ai/assets/cratis-logo.png"),
            ),
        );
        const packageJson = readJson(join(root, "package.json"));
        assert.equal(packageJson.name, "@cratis/ai");
        assert.equal(packageJson.private, true);
        assert.equal(
            packageJson.repository.url,
            "https://github.com/Cratis/AI",
        );
        assert.deepEqual(packageJson.pi.skills, ["./skills"]);
        for (const forbidden of [
            "scripts",
            "dependencies",
            "devDependencies",
            "optionalDependencies",
        ])
            assert.equal(packageJson[forbidden], undefined, forbidden);
        const readme = readFileSync(join(root, "README.md"), "utf8");
        for (const command of [
            "/plugin marketplace add Cratis/AI#dist/v0.2.0",
            "codex plugin marketplace add Cratis/AI --ref dist/v0.2.0",
            "copilot plugin marketplace add Cratis/AI#dist/v0.2.0",
            "gemini extensions install https://github.com/Cratis/AI --ref dist/v0.2.0",
            "pi install git:github.com/Cratis/AI@dist/v0.2.0",
        ])
            assert(readme.includes(command), command);
        assert.equal(readme.includes("Cratis/AI.Distribution"), false);
    });
});

test("the marketplace records where its immutable bytes actually live", () => {
    withTemporaryDirectory((temporaryRoot) => {
        const root = join(temporaryRoot, "marketplace");
        const { provenance } = generatePublicMarketplaceDistribution({
            outputRoot: root,
            version: "0.2.0",
        });
        assert.equal(provenance.canonicalRepository, "Cratis/AI");
        assert.equal(provenance.distributionRepository, "Cratis/AI");
        assert.equal(provenance.distributionRef, "dist/v0.2.0");
        assert.equal(
            publicMarketplaceIdentity.distributionBranch,
            "distribution",
        );
        assert.equal(
            publicMarketplaceIdentity.pluginRoot,
            "plugins/public-cratis-ai",
        );
        assert.equal(publicMarketplaceDistributionTag("0.3.0"), "dist/v0.3.0");
        assert.throws(
            () => publicMarketplaceDistributionTag("1.0.0"),
            /exact 0\.x\.y version/,
        );
    });
});

test("default-branch pointer manifests resolve only an immutable ref", () => {
    withTemporaryDirectory((temporaryRoot) => {
        const root = join(temporaryRoot, "pointers");
        mkdirSync(root, { recursive: true });
        const result = generateMarketplacePointerManifests({
            outputRoot: root,
            version: "0.3.0",
        });
        assert.deepEqual(result.paths, [...marketplacePointerManifestPaths]);
        assert.equal(result.tag, "dist/v0.3.0");
        assert.equal(result.ref, "dist/v0.3.0");
        const requirements = readJson(
            "distribution/marketplace-requirements.json",
        );
        const requiredRoots = new Set(
            requirements.requirements.flatMap(
                (requirement) => requirement.requiredRoots,
            ),
        );
        for (const path of marketplacePointerManifestPaths) {
            assert(requiredRoots.has(path), path);
            const manifest = readJson(join(root, path));
            assert.equal(manifest.name, "cratis");
            assert.equal(manifest.plugins.length, 1);
            assert.deepEqual(manifest.plugins[0].source, {
                source: "github",
                repo: "Cratis/AI",
                ref: "dist/v0.3.0",
                path: "plugins/public-cratis-ai",
            });
        }
        // The hosts that read a repository root directly must never be pointed
        // at the Cratis/AI default branch, or they would discover the authored
        // root skills/ tree instead of the generated package.
        for (const forbidden of [
            "gemini-extension.json",
            "plugin.json",
            "package.json",
        ])
            assert.equal(
                marketplacePointerManifestPaths.includes(forbidden),
                false,
                forbidden,
            );
    });
});

// The publish workflow passes the exact distribution-branch commit it just
// pushed, because dist/vX.Y.Z is created on main by cratis/release-action and is
// never applied to the distribution branch. The version keeps driving every
// display field; only the install pointer moves to the commit.
test("an explicit ref pins the install pointer without changing the version", () => {
    withTemporaryDirectory((temporaryRoot) => {
        const root = join(temporaryRoot, "pointers");
        mkdirSync(root, { recursive: true });
        const sha = "5f2c0a1b9d3e4f6a7b8c9d0e1f2a3b4c5d6e7f80";
        const result = generateMarketplacePointerManifests({
            outputRoot: root,
            version: "0.3.0",
            ref: sha,
        });
        assert.equal(result.tag, "dist/v0.3.0");
        assert.equal(result.ref, sha);
        for (const path of marketplacePointerManifestPaths) {
            const manifest = readJson(join(root, path));
            assert.equal(manifest.plugins[0].source.ref, sha);
            assert.equal(manifest.plugins[0].source.repo, "Cratis/AI");
        }
        const portable = readJson(join(root, ".claude-plugin/marketplace.json"));
        assert.equal(portable.metadata.version, "0.3.0");
        assert.equal(portable.plugins[0].version, "0.3.0");
        // The 0.x cap holds whether or not a ref overrides the pointer.
        assert.throws(
            () =>
                createMarketplacePointerManifests("1.0.0", sha),
            /exact 0\.x\.y version/,
        );
    });
});

test("pointer manifests are owned by distribution, not by a host projection", () => {
    assert.deepEqual(
        [...distributionPointerOutputs].sort(),
        [...marketplacePointerManifestPaths],
    );
    const inventoryGenerator = readFileSync(
        "tooling/generate-repository-inventory.mjs",
        "utf8",
    );
    assert(inventoryGenerator.includes('id: "marketplace-pointer-manifests"'));
    assert(inventoryGenerator.includes("absentUntilGenerated: true"));
    assert(
        inventoryGenerator.includes(
            'generator: "tooling/generate-marketplace-pointer-manifests.mjs"',
        ),
    );
    for (const path of marketplacePointerManifestPaths)
        assert(inventoryGenerator.includes(`"${path}"`), path);
});

test("canonical skills and plugin copies remain byte-identical", () => {
    withTemporaryDirectory((temporaryRoot) => {
        const root = join(temporaryRoot, "marketplace");
        const { provenance } = generatePublicMarketplaceDistribution({
            outputRoot: root,
            version: "0.2.0",
        });
        assert(provenance.canonicalFiles.length > 34);
        for (const file of provenance.canonicalFiles) {
            assert.deepEqual(file.copies, [
                file.path,
                `plugins/public-cratis-ai/${file.path}`,
            ]);
            assert.deepEqual(
                readFileSync(join(root, file.copies[0])),
                readFileSync(join(root, file.copies[1])),
                file.path,
            );
        }
        assert.equal(provenance.targetIds.length, 29);
        assert.deepEqual(
            provenance.targetExclusions.map((entry) => entry.targetId).sort(),
            [
                "cratis-arc-command-execution",
                "cratis-arc-ef-core-migration",
                "cratis-arc-observable-query-http",
                "cratis-chronicle-cli-operations",
                "cratis-chronicle-event-type-migration",
                "cratis-chronicle-mcp-inspection",
                "cratis-chronicle-reactor",
                "cratis-studio-mcp-safety-guidance",
            ],
        );
        assert.equal(
            provenance.eligibility.approval.state,
            "approved-for-unsupported-evaluation",
        );
        assert.equal(provenance.licenseClosure.license, "MIT");
        assert.equal(
            provenance.brandAsset.sha256,
            "da99d76b1513c92617e4f3104437fe8988a3b94cc27d457955eb7e155403b7f6",
        );
        assert.deepEqual(provenance.brandAsset.copies, [
            "assets/cratis-logo.png",
            "plugins/public-cratis-ai/assets/cratis-logo.png",
        ]);
        assert.equal(
            provenance.openAiInterface.developerName,
            "SINDRE ALSTAD WILTING",
        );
        assert.equal(provenance.nativeComponentsIncluded, false);
        assert.equal(provenance.supportGranted, false);
    });
});

test("OpenAI and Cursor handoff metadata is complete but non-supporting", () => {
    withTemporaryDirectory((temporaryRoot) => {
        const root = join(temporaryRoot, "marketplace");
        generatePublicMarketplaceDistribution({
            outputRoot: root,
            version: "0.2.0",
        });
        const openAi = readJson(join(root, "submissions/openai.json"));
        const cursor = readJson(join(root, "submissions/cursor.json"));
        assert.equal(openAi.submissionType, "skills-only");
        assert.equal(openAi.positiveTests.length, 5);
        assert.equal(openAi.negativeTests.length, 3);
        assert.equal(
            openAi.portalReadiness,
            "OWNER_IDENTITY_AND_LEGAL_METADATA_REQUIRED",
        );
        assert.equal(openAi.developerName, "SINDRE ALSTAD WILTING");
        assert.equal(
            openAi.logo,
            "plugins/public-cratis-ai/assets/cratis-logo.png",
        );
        assert(openAi.requiredOwnerInputs.includes("privacy policy URL"));
        assert.equal(openAi.requiredOwnerInputs.includes("logo"), false);
        assert.equal(openAi.supportGranted, false);
        assert.equal(cursor.repository, "https://github.com/Cratis/AI");
        assert.equal(cursor.pluginManifest, "plugin.json");
        assert.equal(cursor.supportGranted, false);
    });
});

test("vendor portal handoff archive is deterministic and skills-only", () => {
    withTemporaryDirectory((temporaryRoot) => {
        const marketplaceRoot = join(temporaryRoot, "marketplace");
        const firstRoot = join(temporaryRoot, "first");
        const secondRoot = join(temporaryRoot, "second");
        generatePublicMarketplaceDistribution({
            outputRoot: marketplaceRoot,
            version: "0.2.0",
        });
        const first = packagePublicMarketplaceSubmissions({
            marketplaceRoot,
            outputRoot: firstRoot,
        });
        const second = packagePublicMarketplaceSubmissions({
            marketplaceRoot,
            outputRoot: secondRoot,
        });
        assert.deepEqual(second, first);
        assert.deepEqual(
            readFileSync(join(firstRoot, first.openAi.archive)),
            readFileSync(join(secondRoot, second.openAi.archive)),
        );
        const python =
            "import json,sys,zipfile; print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))";
        const paths = JSON.parse(
            execFileSync(
                "python3",
                ["-c", python, join(firstRoot, first.openAi.archive)],
                { encoding: "utf8" },
            ),
        );
        assert(paths.includes("public-cratis-ai/.codex-plugin/plugin.json"));
        assert(
            paths.includes(
                "public-cratis-ai/skills/cratis-fundamentals-concept/SKILL.md",
            ),
        );
        assert(paths.includes("public-cratis-ai/assets/cratis-logo.png"));
        assert.equal(
            paths.some((path) => path.includes(".mcp.json")),
            false,
        );
        assert.equal(first.openAi.positiveTestCount, 5);
        assert.equal(first.openAi.negativeTestCount, 3);
        assert.equal(first.openAi.interactivePortalRequired, true);
        assert.equal(first.openAi.ownerMetadataRequired, true);
        assert(first.openAi.requiredOwnerInputs.includes("terms URL"));
        assert.equal(first.cursor.interactivePortalRequired, true);
        assert.equal(first.supportGranted, false);
    });
});

test("complete staged repository passes every protected Distribution check", () => {
    withTemporaryDirectory((temporaryRoot) => {
        const currentRoot = join(temporaryRoot, "current");
        const stagedRoot = join(temporaryRoot, "staged");
        generateDistributionFixture({
            outputRoot: currentRoot,
            version: "0.0.1-fixture",
        });
        stagePublicMarketplaceRepository({
            currentDistributionRoot: currentRoot,
            outputRoot: stagedRoot,
            version: "0.2.0",
        });
        for (const check of distributionCheckNames) {
            assert.deepEqual(
                verifyDistributionCheck({
                    root: stagedRoot,
                    check,
                    beforeRoot: currentRoot,
                }),
                { check, status: "PASS", supporting: false },
            );
        }
    });
});

test("bootstrapping an empty distribution branch stages a complete tree", () => {
    withTemporaryDirectory((temporaryRoot) => {
        const stagedRoot = join(temporaryRoot, "staged");
        stagePublicMarketplaceRepository({
            currentDistributionRoot: join(temporaryRoot, "never-published"),
            outputRoot: stagedRoot,
            version: "0.2.0",
        });
        for (const check of distributionCheckNames) {
            assert.deepEqual(
                verifyDistributionCheck({
                    root: stagedRoot,
                    check,
                    beforeRoot: stagedRoot,
                }),
                { check, status: "PASS", supporting: false },
            );
        }
        assert.throws(
            () =>
                stagePublicMarketplaceRepository({
                    outputRoot: join(temporaryRoot, "unreachable"),
                    version: "0.2.0",
                }),
            /currentDistributionRoot is required/,
        );
    });
});

test("marketplace release manifest matches its closed schema", () => {
    withTemporaryDirectory((temporaryRoot) => {
        const root = join(temporaryRoot, "marketplace");
        generatePublicMarketplaceDistribution({
            outputRoot: root,
            version: "0.2.0",
        });
        const schema = readJson(
            "distribution/public-marketplace-release.schema.json",
        );
        const manifest = readJson(join(root, "marketplace-release.json"));
        assert.deepEqual(validateAgainstSchema(manifest, schema, schema), []);
    });
});
