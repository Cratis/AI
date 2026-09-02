// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { validateAgainstSchema } from "../catalog-validation.mjs";
import { generateDistributionFixture } from "../generate-distribution-fixture.mjs";
import {
    generatePublicMarketplaceDistribution,
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
            "https://github.com/Cratis/AI.Distribution",
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
            "/plugin marketplace add Cratis/AI.Distribution",
            "codex plugin marketplace add Cratis/AI.Distribution --ref v0.2.0",
            "copilot plugin marketplace add Cratis/AI.Distribution",
            "gemini extensions install https://github.com/Cratis/AI.Distribution --ref v0.2.0",
            "pi install git:github.com/Cratis/AI.Distribution@v0.2.0",
        ])
            assert(readme.includes(command), command);
    });
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
        assert.equal(
            cursor.repository,
            "https://github.com/Cratis/AI.Distribution",
        );
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
