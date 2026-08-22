// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(`Unable to parse companion evaluation JSON: ${path}`, {
            cause: error,
        });
    }
}

function digest(path) {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const evaluationRoot = "evals/cratis-engineering-docs-companions";
const sourcePaths = {
    addSource: "engineering/skills/cratis-engineering-docs-add-page/SKILL.md",
    addReference:
        "engineering/skills/cratis-engineering-docs-add-page/references/ownership-and-navigation.md",
    editSource: "engineering/skills/cratis-engineering-docs-edit-page/SKILL.md",
    editReference:
        "engineering/skills/cratis-engineering-docs-edit-page/references/source-discovery.md",
};

for (const evaluationPass of ["calibration", "held-out"]) {
    test(`${evaluationPass} companion evaluation is frozen and capability-bounded`, () => {
        const heldOut = evaluationPass === "held-out";
        const plan = readJson(
            `${evaluationRoot}/${heldOut ? "held-out-evaluation-plan" : "evaluation-plan"}.json`,
        );
        assert.equal(plan.state, "FROZEN_COMPLETED");
        assert.equal(
            plan.sourceRevision,
            "684d03755bacd40af95463b81b4a0c8b9f088ec1",
        );
        assert.equal(digest(sourcePaths.addSource), plan.addSourceSha256);
        assert.equal(digest(sourcePaths.addReference), plan.addReferenceSha256);
        assert.equal(digest(sourcePaths.editSource), plan.editSourceSha256);
        assert.equal(
            digest(sourcePaths.editReference),
            plan.editReferenceSha256,
        );
        assert.equal(
            digest(
                `${evaluationRoot}/${heldOut ? "held-out-cases" : "cases"}.jsonl`,
            ),
            plan.casesSha256,
        );
        assert.equal(
            digest(
                `${evaluationRoot}/${heldOut ? "held-out-prompt" : "frozen-prompt"}.md`,
            ),
            plan.promptSha256,
        );
        assert.deepEqual(plan.conditions, [
            "BASELINE_OUTPUT_CONTRACT_ONLY",
            "COMPANION_SKILLS_WITH_OUTPUT_CONTRACT",
        ]);
        assert.deepEqual(plan.models, [
            "openai-codex/gpt-5.4-mini",
            "openai-codex/gpt-5.6-luna",
        ]);
        assert.equal(plan.repetitionsPerModelCondition, 2);
        assert.equal(plan.plannedModelRuns, 8);
        assert.equal(plan.toolsEnabled, false);
        assert.equal(plan.contextFilesEnabled, false);
        assert.equal(plan.networkToolsEnabled, false);
        assert.equal(plan.targetApproval, false);
        assert.equal(plan.installationEligible, false);
        assert.equal(plan.promotionEligible, false);
    });
}

test("companion evidence improves routing without concealing mismatches", () => {
    const calibration = readJson(`${evaluationRoot}/grading.json`);
    const heldOut = readJson(`${evaluationRoot}/held-out-grading.json`);
    const summary = readJson(`${evaluationRoot}/evaluation-summary.json`);
    const review = readJson(`${evaluationRoot}/evaluation-review.json`);
    assert.equal(calibration.runCount, 8);
    assert.equal(heldOut.runCount, 8);
    assert.deepEqual(calibration.summaries, {
        BASELINE_OUTPUT_CONTRACT_ONLY: {
            runCount: 4,
            decisionMatches: 39,
            decisionOpportunities: 48,
            reasonMatches: 45,
            reasonOpportunities: 48,
        },
        COMPANION_SKILLS_WITH_OUTPUT_CONTRACT: {
            runCount: 4,
            decisionMatches: 45,
            decisionOpportunities: 48,
            reasonMatches: 47,
            reasonOpportunities: 48,
        },
    });
    assert.deepEqual(heldOut.summaries, {
        BASELINE_OUTPUT_CONTRACT_ONLY: {
            runCount: 4,
            decisionMatches: 36,
            decisionOpportunities: 48,
            rationalesPresent: 48,
            rationaleOpportunities: 48,
        },
        COMPANION_SKILLS_WITH_OUTPUT_CONTRACT: {
            runCount: 4,
            decisionMatches: 45,
            decisionOpportunities: 48,
            rationalesPresent: 48,
            rationaleOpportunities: 48,
        },
    });
    assert.equal(summary.calibration.decisionImprovement, 6);
    assert.equal(summary.calibration.companionMismatches.length, 3);
    assert.equal(summary.heldOut.decisionImprovement, 9);
    assert.equal(summary.heldOut.companionMismatches.length, 2);
    assert.equal(summary.state, "EVALUATED_CORRECTIVE_RERUN_REQUIRED");
    assert.equal(summary.assessment.exactRouting, "NOT_PERFECT");
    assert.equal(
        summary.assessment.oracleQuality,
        "ONE_HELD_OUT_CASE_AMBIGUOUS",
    );
    assert.equal(summary.targetApproval, false);
    assert.equal(summary.installationEligible, false);
    assert.equal(summary.packagingEligible, false);
    assert.equal(summary.publicationEligible, false);
    assert.equal(summary.promotionEligible, false);
    assert.equal(review.verdict, "EVALUATED_CORRECTIVE_RERUN_REQUIRED");
    assert.equal(review.triggerEvidence, "INCOMPLETE");
    assert.equal(
        review.collisionEvidence,
        "FAILED_UNAMBIGUOUS_CASES_WITH_ONE_AMBIGUOUS_ORACLE",
    );
    assert.equal(review.reviewSha256.length, 64);
    assert.equal(review.targetApproval, false);
    assert.equal(review.installationEligible, false);
    assert.equal(review.packagingEligible, false);
    assert.equal(review.publicationEligible, false);
    assert.equal(review.promotionEligible, false);
});

test("companion evaluation runner disables ambient capabilities", () => {
    const runner = readFileSync(
        "tooling/run-engineering-docs-companions-evaluation.mjs",
        "utf8",
    );
    for (const argument of [
        "--no-tools",
        "--no-extensions",
        "--no-skills",
        "--no-context-files",
        "--no-prompt-templates",
        "--no-themes",
        "--no-session",
    ])
        assert(runner.includes(`"${argument}"`));
    assert(runner.includes("cwd: temporaryCwd"));
    assert(runner.includes("sha256(output)"));
});

test("companion grader requires exact run metadata and immutable output hashes", () => {
    const grader = readFileSync(
        "tooling/grade-engineering-docs-companions-evaluation.mjs",
        "utf8",
    );
    assert(
        grader.includes(
            "Run manifest does not exactly match the frozen run matrix",
        ),
    );
    assert(
        grader.includes("Run manifest does not exactly cover run directories"),
    );
    assert(grader.includes("Metadata differs from manifest"));
    assert(grader.includes("Output hash mismatch"));
    assert(grader.includes("Run did not finish cleanly"));
    assert(grader.includes("Run used forbidden capabilities"));
    assert(grader.includes("did not cover every case exactly once"));
});
