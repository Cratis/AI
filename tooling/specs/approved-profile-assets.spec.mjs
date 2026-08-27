// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createTarGzip } from "../package-fundamentals-preview-assets.mjs";
import { finalizeApprovedProfileAssets } from "../verify-approved-profile-assets.mjs";

const metadata = [
    "artifact-assurance-receipt.json",
    "compliance-receipts.json",
    "deterministic-release-manifest.json",
    "provenance.json",
    "release-instructions.md",
    "release-manifest.json",
    "support-matrix.json",
];

function withFixture(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-approved-assets-"));
    try {
        const candidate = join(root, "candidate");
        const assets = join(root, "assets");
        const pi = join(candidate, "harnesses/pi");
        const testHarness = join(candidate, "harnesses/test-host");
        mkdirSync(join(pi, "skills/example"), { recursive: true });
        mkdirSync(join(testHarness, "skills/example"), { recursive: true });
        writeFileSync(
            join(pi, "package.json"),
            `${JSON.stringify(
                {
                    name: "@cratis/ai-test",
                    version: "1.2.3",
                    private: true,
                    files: ["skills"],
                },
                null,
                2,
            )}\n`,
        );
        writeFileSync(join(pi, "skills/example/SKILL.md"), "skill\n");
        writeFileSync(
            join(testHarness, "skills/example/SKILL.md"),
            "skill\n",
        );
        for (const path of metadata) {
            const destination = join(candidate, path);
            mkdirSync(join(destination, ".."), { recursive: true });
            writeFileSync(destination, `${path}\n`);
        }
        mkdirSync(assets);
        execFileSync(
            "npm",
            ["pack", pi, "--json", "--pack-destination", assets],
            { stdio: "pipe" },
        );
        writeFileSync(
            join(
                assets,
                "cratis-ai-public-test-1.2.3-test-host.tar.gz",
            ),
            createTarGzip(testHarness, ["skills/example/SKILL.md"]),
        );
        for (const path of metadata)
            cpSync(join(candidate, path), join(assets, path));
        return callback({ root, candidate, assets });
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("approved profile assets bind exact expanded roots and release metadata", () => {
    withFixture(({ candidate, assets }) => {
        const result = finalizeApprovedProfileAssets({
            candidateRoot: candidate,
            assetsRoot: assets,
            profileId: "public-test",
            version: "1.2.3",
        });
        assert.deepEqual(result.harnesses, ["pi", "test-host"]);
        assert.equal(result.supportGranted, false);
        assert.equal(result.publicationGranted, false);
        assert.match(result.verifier.sha256, /^[a-f0-9]{64}$/u);
        const checksums = readFileSync(join(assets, "SHA256SUMS"), "utf8");
        assert.match(checksums, /release-assets-manifest\.json/u);
        assert.match(checksums, /provenance\.json/u);
    });
});

test("approved profile assets reject archive and metadata drift", () => {
    withFixture(({ candidate, assets }) => {
        const archive = join(
            assets,
            "cratis-ai-public-test-1.2.3-test-host.tar.gz",
        );
        writeFileSync(archive, "tampered\n");
        assert.throws(
            () =>
                finalizeApprovedProfileAssets({
                    candidateRoot: candidate,
                    assetsRoot: assets,
                    profileId: "public-test",
                    version: "1.2.3",
                }),
            /archive|gzip|tar|header/iu,
        );
    });
});
