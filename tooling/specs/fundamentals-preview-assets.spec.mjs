// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
    packageFundamentalsPreviewAssets,
    readTarGzip,
} from "../package-fundamentals-preview-assets.mjs";

function withTemporaryDirectory(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-preview-assets-"));
    try {
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function commandAvailable(command) {
    try {
        execFileSync(command, ["--version"], { stdio: "pipe" });
        return true;
    } catch {
        return false;
    }
}

function assetPath(root, manifest, harness) {
    const asset = manifest.assets.find(candidate => candidate.harness === harness);
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

test("Fundamentals preview assets are deterministic and non-publishable", () => {
    withTemporaryDirectory(root => {
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
            "e9d161a70e25334bb468a33240bcf00f03f87522",
        );
        assert.equal(first.assets.length, 11);
        assert.match(first.generatorDigest, /^[0-9a-f]{64}$/);
        assert.deepEqual(first.generatorPaths, [
            "tooling/package-fundamentals-preview-assets.mjs",
            "tooling/passive-profile-adapters.mjs",
        ]);
        assert.equal(first.approvalEligible, false);
        assert.equal(first.installationSupported, false);
        assert.equal(first.publicationEligible, false);
        assert.equal(first.promotionEligible, false);
        for (const asset of first.assets) {
            assert.match(asset.sha256, /^[0-9a-f]{64}$/);
            assert.deepEqual(
                readFileSync(join(firstRoot, asset.filename)),
                readFileSync(join(secondRoot, asset.filename)),
            );
            assert(readTarGzip(readFileSync(join(firstRoot, asset.filename))).size > 0);
        }
        const sbom = JSON.parse(
            readFileSync(join(firstRoot, "preview-sbom.json"), "utf8"),
        );
        assert.equal(sbom.format, "cratis-passive-profile-sbom-v1");
        assert.deepEqual(sbom.dependencies, []);
        assert.deepEqual(sbom.executableComponents, []);
        assert.deepEqual(sbom.components.map(component => component.name), [
            "cratis-fundamentals-concept",
        ]);
        const checksums = readFileSync(join(firstRoot, "SHA256SUMS"), "utf8");
        assert(checksums.includes("preview-assets.json"));
        assert(checksums.includes("preview-sbom.json"));
        assert.equal(checksums.trim().split("\n").length, 13);
    });
});

test("preview asset generation fails closed on current authority drift", () => {
    withTemporaryDirectory(root => {
        assert.throws(
            () =>
                packageFundamentalsPreviewAssets({
                    outputRoot: join(root, "invalid"),
                    version: "latest",
                }),
            /exact SemVer/,
        );
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
    withTemporaryDirectory(root => {
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
        const install = tarball =>
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

test(
    "Pi loads and removes the extracted exact preview package in an isolated home",
    { skip: !commandAvailable("pi") },
    () => {
        withTemporaryDirectory(root => {
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
    },
);
