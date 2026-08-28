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
import { execFileSync } from "node:child_process";
import { validateAgainstSchema } from "../catalog-validation.mjs";
import { generateDistributionFixture } from "../generate-distribution-fixture.mjs";
import { generatePublicMarketplaceDistribution } from "../generate-public-marketplace-distribution.mjs";
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
        assert.equal(first.release.targetCount, 34);
        assert.equal(first.release.skillCount, 34);
        assert.equal(first.release.installationAvailable, true);
        assert.equal(first.release.installationSupported, false);
        assert.equal(first.release.supportGranted, false);
        assert.equal(first.release.promotionEligible, false);
        assert.equal(skillNames(firstRoot).length, 34);
    });
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
        const packageJson = readJson(join(root, "package.json"));
        assert.equal(packageJson.name, "@cratis/ai");
        assert.equal(packageJson.private, false);
        assert.equal(packageJson.repository.url, "https://github.com/Cratis/AI.Distribution");
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
        assert.equal(provenance.targetIds.length, 34);
        assert.deepEqual(
            provenance.targetExclusions.map((entry) => entry.targetId).sort(),
            [
                "cratis-arc-observable-query-http",
                "cratis-chronicle-mcp-inspection",
                "cratis-studio-mcp-safety-guidance",
            ],
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
            "OWNER_IDENTITY_AND_LISTING_ASSETS_REQUIRED",
        );
        assert(openAi.requiredOwnerInputs.includes("privacy policy URL"));
        assert.equal(openAi.supportGranted, false);
        assert.equal(cursor.repository, "https://github.com/Cratis/AI.Distribution");
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
        assert.equal(paths.some((path) => path.includes(".mcp.json")), false);
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
