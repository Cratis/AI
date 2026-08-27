// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    unlinkSync,
    writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { defaultRepositoryRoot } from "../catalog-validation.mjs";
import {
    assertNoDirectoryPathCollisions,
    validateProjectedRoot,
} from "../deterministic-release-tree.mjs";
import {
    buildNativeNonSkillProjectionPlan,
    generateNativeNonSkillProjectionFixture,
    validateNativeNonSkillProjectionContract,
} from "../native-non-skill-projections.mjs";

function temporaryDirectory() {
    return mkdtempSync(join(tmpdir(), "cratis-s8-native-"));
}

test("S8 native non-skill contract is exact, passive, and non-promoting", () => {
    assert.deepEqual(validateNativeNonSkillProjectionContract(), []);
    const { receipt } = buildNativeNonSkillProjectionPlan();
    assert.equal(receipt.rootCount, 4);
    assert.equal(receipt.fileCount, 70);
    assert.equal(receipt.uniqueComponentCount, 35);
    assert.equal(receipt.projections.length, 70);
    for (const field of [
        "executionPerformed",
        "hostTestingPerformed",
        "installationPerformed",
        "lifecycleTestingPerformed",
        "networkAccessPerformed",
        "supportGranted",
        "publicationGranted",
        "runtimeGranted",
        "promotionGranted",
    ])
        assert.equal(receipt[field], false);
    assert.deepEqual(
        receipt.roots.map((root) => [root.id, root.files.length]),
        [
            ["devin-hosted-instructions", 1],
            ["jetbrains-ai-assistant-rules", 34],
            ["tabnine-guidelines", 34],
            ["visual-studio-copilot-instructions", 1],
        ],
    );
});

test("S8 evidence report binds the committed non-promoting generation", () => {
    const report = JSON.parse(
        readFileSync(
            join(
                defaultRepositoryRoot,
                "distribution/evidence/s8-native-non-skill-static-generation-2026-08-25.json",
            ),
            "utf8",
        ),
    );
    assert.equal(
        report.sourceRevision,
        "3fe2b12aa7fd068565cbf082ea966cd783cc6aad",
    );
    assert.equal(report.verification.exitCode, 0);
    assert.equal(report.verification.passed, 467);
    assert.equal(report.rootCount, 4);
    assert.equal(report.fileCount, 70);
    assert.equal(report.uniqueComponentCount, 35);
    assert.equal(
        report.receiptSha256,
        "ac95afb703d06c8f37777be684237dd2fbea1f3fbb9a85ac59fd6d5b0261323b",
    );
    assert.deepEqual(
        report.roots.map((root) => [root.id, root.fileCount]),
        [
            ["devin-hosted-instructions", 1],
            ["jetbrains-ai-assistant-rules", 34],
            ["tabnine-guidelines", 34],
            ["visual-studio-copilot-instructions", 1],
        ],
    );
    for (const field of [
        "executionPerformed",
        "networkAccessPerformed",
        "hostTestingPerformed",
        "installationPerformed",
        "lifecycleTestingPerformed",
        "supportGranted",
        "publicationGranted",
        "runtimeGranted",
        "promotionGranted",
    ])
        assert.equal(report[field], false);
});

test("S8 payload contains only exact native rule and instruction bytes", () => {
    const parent = temporaryDirectory();
    try {
        const destination = join(parent, "candidate");
        const generated = generateNativeNonSkillProjectionFixture(destination);
        assert.equal(generated.validation.fileCount, 70);
        assert.equal(generated.receipt.fileCount, 70);
        const general = readFileSync(
            join(defaultRepositoryRoot, ".ai/rules/general.md"),
        );
        assert.deepEqual(
            readFileSync(
                join(
                    destination,
                    "visual-studio-copilot-instructions/.github/copilot-instructions.md",
                ),
            ),
            general,
        );
        assert.deepEqual(
            readFileSync(
                join(destination, "devin-hosted-instructions/AGENTS.md"),
            ),
            general,
        );
        const paths = generated.validation.files.map((file) => file.path);
        assert(
            !paths.includes(
                "jetbrains-ai-assistant-rules/.aiassistant/rules/general.md",
            ),
        );
        assert(
            !paths.includes(
                "tabnine-guidelines/.tabnine/guidelines/general.md",
            ),
        );
        for (const path of paths) {
            assert.doesNotMatch(
                path,
                /(?:SKILL\.md|plugin\.json|package\.json|(?:^|\/)(?:scripts?|hooks?|mcp|lsp)(?:\/|$)|(?:^|\/)(?:package-lock\.json|yarn\.lock|settings\.json)$)/iu,
            );
            assert.doesNotMatch(path, /(?:^|\/)manifest(?:\.|\/)/iu);
        }
        assert.equal(
            generated.receipt.projections.every(
                (projection) => projection.outputDigest.length === 64,
            ),
            true,
        );
        assert.equal(
            generated.receipt.projections.every(
                (projection) => projection.sourceDigest.length === 64,
            ),
            true,
        );
    } finally {
        rmSync(parent, { recursive: true, force: true });
    }
});

test("serial repeated S8 generation is byte-deterministic", () => {
    const firstParent = temporaryDirectory();
    const secondParent = temporaryDirectory();
    try {
        const first = generateNativeNonSkillProjectionFixture(
            join(firstParent, "candidate"),
        );
        const second = generateNativeNonSkillProjectionFixture(
            join(secondParent, "candidate"),
        );
        assert.deepEqual(first.receipt, second.receipt);
        assert.deepEqual(first.validation.files, second.validation.files);
        assert.equal(first.receipt.projections.length, 70);
    } finally {
        rmSync(firstParent, { recursive: true, force: true });
        rmSync(secondParent, { recursive: true, force: true });
    }
});

test("S8 complete inventory rejects extras, symlinks, and byte drift", () => {
    const scenarios = [
        (destination) => mkdirSync(join(destination, "unexpected-empty")),
        (destination) =>
            writeFileSync(join(destination, "unexpected.json"), "{}\n"),
        (destination) => {
            const path = join(
                destination,
                "devin-hosted-instructions/AGENTS.md",
            );
            unlinkSync(path);
            symlinkSync(
                join(defaultRepositoryRoot, ".ai/rules/general.md"),
                path,
            );
        },
        (destination) =>
            writeFileSync(
                join(destination, "devin-hosted-instructions/AGENTS.md"),
                "drift\n",
            ),
    ];
    for (const mutate of scenarios) {
        const parent = temporaryDirectory();
        try {
            const destination = join(parent, "candidate");
            const plan = buildNativeNonSkillProjectionPlan();
            generateNativeNonSkillProjectionFixture(destination);
            mutate(destination);
            assert.throws(
                () => validateProjectedRoot(destination, plan.projectedTree),
                /inventory differs|symlink|digest mismatch/iu,
            );
        } finally {
            rmSync(parent, { recursive: true, force: true });
        }
    }
});

test("S8 actual directory inventory rejects case and NFC collisions", () => {
    assert.throws(
        () =>
            assertNoDirectoryPathCollisions([
                "devin-hosted-instructions",
                "DEVIN-HOSTED-INSTRUCTIONS",
            ]),
        /case or Unicode collision/iu,
    );
    assert.throws(
        () => assertNoDirectoryPathCollisions(["café", "cafe\u0301"]),
        /case or Unicode collision/iu,
    );
});

test("S8 refuses existing and repository-owned destinations", () => {
    const parent = temporaryDirectory();
    try {
        assert.throws(
            () => generateNativeNonSkillProjectionFixture(parent),
            /must not exist/iu,
        );
        assert.throws(
            () =>
                generateNativeNonSkillProjectionFixture(
                    join(defaultRepositoryRoot, ".s8-forbidden"),
                ),
            /outside the repository/iu,
        );
    } finally {
        rmSync(parent, { recursive: true, force: true });
    }
});

test("S8 source files are read once and every final byte is revalidated", () => {
    const parent = temporaryDirectory();
    try {
        const result = generateNativeNonSkillProjectionFixture(
            join(parent, "candidate"),
        );
        const plan = buildNativeNonSkillProjectionPlan();
        assert.equal(plan.metrics.sourceReads, 35);
        assert.equal(result.validation.fileCount, 70);
    } finally {
        rmSync(parent, { recursive: true, force: true });
    }
});
