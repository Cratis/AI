// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
    cpSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { validateEngineeringDocsAuthoring } from "../engineering-docs-authoring-validation.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);

function readCases(root = repositoryRoot) {
    return readFileSync(
        join(root, "evals/cratis-engineering-docs-authoring/cases.jsonl"),
        "utf8",
    )
        .trim()
        .split("\n")
        .map(JSON.parse);
}

function withFixture(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-engineering-docs-"));
    try {
        cpSync(join(repositoryRoot, "engineering"), join(root, "engineering"), {
            recursive: true,
        });
        cpSync(
            join(repositoryRoot, "evals/cratis-engineering-docs-authoring"),
            join(root, "evals/cratis-engineering-docs-authoring"),
            { recursive: true },
        );
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("engineering docs authoring source and nine cases pass", () => {
    assert.deepEqual(validateEngineeringDocsAuthoring(), []);
    const cases = readCases();
    assert.equal(cases.length, 9);
    assert.equal(cases.filter((item) => item.kind === "positive").length, 4);
    assert.equal(cases.filter((item) => item.kind === "negative").length, 5);
});

test("engineering docs authoring payload stays passive and self-contained", () => {
    const root = join(
        repositoryRoot,
        "engineering/skills/cratis-engineering-docs-authoring",
    );
    const skill = readFileSync(join(root, "SKILL.md"), "utf8");
    assert.match(skill, /^---\nname: cratis-engineering-docs-authoring\n/);
    assert(skill.includes("[site-format.md](references/site-format.md)"));
    assert.equal(skill.includes(".ai/rules/"), false);
    assert.equal(skill.includes("../../"), false);
    assert.equal(skill.includes("scripts/"), false);
    assert.equal(skill.includes("evals/"), false);
});

test("engineering docs cases keep document types and near misses distinct", () => {
    const cases = new Map(readCases().map((item) => [item.id, item.expected]));
    assert.deepEqual(
        ["P01", "P02", "P03", "P04"].map((id) => cases.get(id).documentType),
        ["TUTORIAL", "HOW_TO", "EXPLANATION", "REFERENCE"],
    );
    assert.equal(cases.get("N01").decision, "DEFER_TO_ADD_PAGE");
    assert.equal(cases.get("N02").decision, "DEFER_TO_EDIT_PAGE");
    assert.equal(cases.get("N03").decision, "DEFER_TO_VISUAL_QA");
    assert.equal(cases.get("N04").decision, "BLOCK");
    assert.equal(cases.get("N05").decision, "SKIP");
});

test("engineering docs authoring rejects payload inventory and reference drift", () => {
    withFixture((root) => {
        const skillRoot = join(
            root,
            "engineering/skills/cratis-engineering-docs-authoring",
        );
        writeFileSync(join(skillRoot, "scripts.sh"), "echo forbidden\n");
        const skillPath = join(skillRoot, "SKILL.md");
        writeFileSync(
            skillPath,
            readFileSync(skillPath, "utf8").replace(
                "references/site-format.md",
                "references/missing.md",
            ),
        );
        const errors = validateEngineeringDocsAuthoring(root);
        assert(errors.some((error) => error.includes("inventory changed")));
        assert(errors.includes("SKILL_REFERENCE"));
        assert(errors.some((error) => error.includes("digest changed")));
    });
});

test("engineering docs authoring rejects project context and legacy rule coupling", () => {
    withFixture((root) => {
        const skillPath = join(
            root,
            "engineering/skills/cratis-engineering-docs-authoring/SKILL.md",
        );
        writeFileSync(
            skillPath,
            `${readFileSync(skillPath, "utf8")}\nRead .agents/PROJECT.md and ../../.ai/rules/documentation.md.\n`,
        );
        const errors = validateEngineeringDocsAuthoring(root);
        assert(errors.includes("SKILL_FORBIDDEN:../../"));
        assert(errors.includes("SKILL_FORBIDDEN:.agents/PROJECT.md"));
        assert(errors.some((error) => error.includes("digest changed")));
    });
});

test("engineering docs evaluation evidence remains bound and non-promoting", () => {
    const calibration = JSON.parse(
        readFileSync(
            join(
                repositoryRoot,
                "evals/cratis-engineering-docs-authoring/grading.json",
            ),
            "utf8",
        ),
    );
    const heldOut = JSON.parse(
        readFileSync(
            join(
                repositoryRoot,
                "evals/cratis-engineering-docs-authoring/held-out-grading.json",
            ),
            "utf8",
        ),
    );
    const summary = JSON.parse(
        readFileSync(
            join(
                repositoryRoot,
                "evals/cratis-engineering-docs-authoring/evaluation-summary.json",
            ),
            "utf8",
        ),
    );
    assert.equal(calibration.skillBehaviorPass, true);
    assert.equal(calibration.strictContractPass, false);
    assert.equal(heldOut.skillPass, true);
    assert.equal(heldOut.decisionImprovement, 4);
    assert.equal(heldOut.targetApproval, false);
    assert.equal(heldOut.installationEligible, false);
    assert.equal(heldOut.promotionEligible, false);
    assert.equal(summary.state, "EVIDENCE_PASS_OWNER_REVIEW_PENDING");
    assert.equal(summary.modelRuns, 16);
    assert.equal(
        summary.independentReview.id,
        "validate-f2fa66ec52217d7edf216972982de179",
    );
    assert.equal(summary.targetApproval, false);
    assert.equal(summary.installationEligible, false);
});

test("engineering docs evaluation rejects run and grading tampering", () => {
    withFixture((root) => {
        const outputPath = join(
            root,
            "evals/cratis-engineering-docs-authoring/held-out-runs/skill-openai-codex-gpt-5-4-mini-r1/output.txt",
        );
        const output = `${readFileSync(outputPath, "utf8")}\n`;
        writeFileSync(outputPath, output);
        const metadataPath = join(
            root,
            "evals/cratis-engineering-docs-authoring/held-out-runs/skill-openai-codex-gpt-5-4-mini-r1/metadata.json",
        );
        const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
        metadata.outputSha256 = createHash("sha256")
            .update(output)
            .digest("hex");
        metadata.model = "gpt-5.6-luna";
        writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
        const gradingPath = join(
            root,
            "evals/cratis-engineering-docs-authoring/held-out-grading.json",
        );
        const grading = JSON.parse(readFileSync(gradingPath, "utf8"));
        grading.decisionImprovement = 99;
        writeFileSync(gradingPath, `${JSON.stringify(grading, null, 2)}\n`);
        const summaryPath = join(
            root,
            "evals/cratis-engineering-docs-authoring/evaluation-summary.json",
        );
        const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
        summary.state = "APPROVED";
        writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
        const errors = validateEngineeringDocsAuthoring(root);
        assert(
            errors.includes("skill-openai-codex-gpt-5-4-mini-r1:RUN_BINDING"),
        );
        assert(errors.includes("HELD_OUT_GRADING"));
        assert(errors.includes("EVALUATION_SUMMARY"));
        assert(errors.some((error) => error.includes("digest changed")));
    });
});

test("engineering docs authoring rejects decision oracle drift", () => {
    withFixture((root) => {
        const path = join(
            root,
            "evals/cratis-engineering-docs-authoring/cases.jsonl",
        );
        const cases = readCases(root);
        cases.find((item) => item.id === "N04").expected.decision =
            "AUTHOR_CONTENT";
        writeFileSync(
            path,
            `${cases.map((item) => JSON.stringify(item)).join("\n")}\n`,
        );
        const errors = validateEngineeringDocsAuthoring(root);
        assert(errors.includes("N04:DECISION_ORACLE"));
        assert(errors.includes("CASES_DIGEST"));
    });
});
