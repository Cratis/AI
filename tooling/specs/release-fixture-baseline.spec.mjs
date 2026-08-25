// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";
import { generateDistributionFixture } from "../generate-distribution-fixture.mjs";
import { generateEngineeringDistributionFixture } from "../generate-engineering-distribution-fixture.mjs";

const baselineRevision = "1ab6a9fbd41c48d6f8b6c459e5b22db9a8fe752b";
const legacyBaselineRevision = "d22749e862726a8a1e7c74a1e52cfb622d86be37";
const legacyBaseline = Object.freeze({
    public: Object.freeze({
        count: 43,
        digest: "25729748611c561408474c555f636049d50030472cae7f6b9f516a6bc8d8220d",
    }),
    engineering: Object.freeze({
        count: 55,
        digest: "afbd86ba1d0da34f8eb4d35a873cf489d1024ac1d50e54a5203238c5f6413fd3",
    }),
});
const baseline = Object.freeze({
    public: Object.freeze({
        count: 91,
        digest: "0217655c0e77f180a4fd74cc19cef3e33ebc3863050362bc406bd70d7f86190a",
    }),
    engineering: Object.freeze({
        count: 124,
        digest: "b9d2b795c9bdaf393b6c562c8b1b7c91665eebe9e1a6cd7d4055c2f60f21a6c3",
    }),
});
const legacyRoots = new Set([
    "agent-plugin",
    "canonical",
    "claude",
    "codex",
    "copilot",
    "cursor",
    "deepcode",
    "deepseek",
    "gemini",
    "grok",
    "junie",
    "kiro",
    "pi",
]);

function walk(root, current = root) {
    return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
        const path = join(current, entry.name);
        return entry.isDirectory()
            ? walk(root, path)
            : [relative(root, path).replaceAll("\\", "/")];
    });
}

function payloadInventory(root, pathFilter = () => true) {
    const paths = walk(root)
        .filter((path) => path !== "SHA256SUMS")
        .filter((path) => !path.endsWith("manifest.json"))
        .filter((path) => path !== "provenance.json")
        .filter((path) => !path.endsWith("receipt.json"))
        .filter((path) => !path.endsWith("receipts.json"))
        .filter(pathFilter)
        .sort();
    const content = paths
        .map(
            (path) =>
                `${createHash("sha256")
                    .update(readFileSync(join(root, path)))
                    .digest("hex")}  ./${path}\n`,
        )
        .join("");
    return {
        count: paths.length,
        digest: createHash("sha256").update(content).digest("hex"),
    };
}

test(`public and engineering fixture payloads preserve ${baselineRevision} path and byte inventories`, () => {
    const temporary = mkdtempSync(join(tmpdir(), "cratis-fixture-baseline-"));
    try {
        const publicRoot = join(temporary, "public");
        const engineeringRoot = join(temporary, "engineering");
        generateDistributionFixture({ outputRoot: publicRoot });
        generateEngineeringDistributionFixture({ outputRoot: engineeringRoot });
        assert.deepEqual(
            payloadInventory(
                publicRoot,
                (path) =>
                    !path.includes("/") || legacyRoots.has(path.split("/")[0]),
            ),
            legacyBaseline.public,
            `legacy public roots from ${legacyBaselineRevision} changed`,
        );
        assert.deepEqual(
            payloadInventory(engineeringRoot, (path) =>
                legacyRoots.has(path.split("/")[0]),
            ),
            legacyBaseline.engineering,
            `legacy engineering roots from ${legacyBaselineRevision} changed`,
        );
        assert.deepEqual(payloadInventory(publicRoot), baseline.public);
        assert.deepEqual(
            payloadInventory(engineeringRoot),
            baseline.engineering,
        );
        assert.deepEqual(
            walk(publicRoot)
                .filter((path) => !path.includes("/"))
                .sort(),
            [
                "SHA256SUMS",
                "artifact-assurance-receipt.json",
                "deterministic-release-manifest.json",
                "distribution-manifest.json",
                "passive-compliance-receipts.json",
                "provenance.json",
                "provider-compatibility.json",
            ],
        );
        assert.deepEqual(
            walk(engineeringRoot)
                .filter((path) => !path.includes("/"))
                .sort(),
            [
                "SHA256SUMS",
                "artifact-assurance-receipt.json",
                "deterministic-release-manifest.json",
                "engineering-distribution-manifest.json",
                "passive-compliance-receipts.json",
                "provenance.json",
            ],
        );
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
});
