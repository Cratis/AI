#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const evaluationRoot = join(
    repositoryRoot,
    "evals/cratis-engineering-docs-authoring",
);
const runsRoot = join(evaluationRoot, "held-out-runs");
const gradingPath = join(evaluationRoot, "held-out-grading.json");
const expectedKeys = ["caseId", "decision", "rationale"].sort();

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(`Unable to parse held-out JSON: ${path}`, {
            cause: error,
        });
    }
}

function parseOutput(content) {
    const unfenced = content
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");
    try {
        return JSON.parse(unfenced);
    } catch {
        return null;
    }
}

if (!existsSync(runsRoot)) throw new Error("Held-out runs are missing");
if (existsSync(gradingPath)) throw new Error("Held-out grading already exists");
const cases = readFileSync(join(evaluationRoot, "held-out-cases.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse);
const manifest = readJson(join(runsRoot, "manifest.json"));
if (manifest.evaluationPass !== "held-out")
    throw new Error("Held-out manifest pass changed");
const runDirectories = readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
if (runDirectories.length !== manifest.runs.length)
    throw new Error("Held-out run inventory does not match manifest");

const results = [];
for (const runId of runDirectories) {
    const runRoot = join(runsRoot, runId);
    const metadata = readJson(join(runRoot, "metadata.json"));
    const output = readFileSync(join(runRoot, "output.txt"), "utf8");
    const values = parseOutput(output);
    const errors = [];
    let decisionMatches = 0;
    let rationalesValid = 0;
    if (Array.isArray(values)) {
        if (values.length !== cases.length) errors.push("CASE_COUNT");
        for (let index = 0; index < values.length; index++) {
            const value = values[index];
            const testCase = cases[index];
            if (
                !value ||
                typeof value !== "object" ||
                Array.isArray(value) ||
                JSON.stringify(Object.keys(value).sort()) !==
                    JSON.stringify(expectedKeys)
            ) {
                errors.push(`${testCase?.id ?? index}:FIELDS`);
                continue;
            }
            if (value.caseId !== testCase.id)
                errors.push(`${testCase.id}:ORDER`);
            if (value.decision === testCase.expectedDecision) decisionMatches++;
            else errors.push(`${testCase.id}:DECISION`);
            if (
                typeof value.rationale === "string" &&
                value.rationale.trim().length >= 12 &&
                value.rationale.length <= 512
            )
                rationalesValid++;
            else errors.push(`${testCase.id}:RATIONALE`);
        }
    } else errors.push("INVALID_JSON_ARRAY");
    for (const forbidden of [
        "/Users/",
        "/home/",
        "file://",
        "APPROVED_FOR_INSTALLATION",
        "PUBLICATION_ELIGIBLE",
    ])
        if (output.includes(forbidden))
            errors.push(`FORBIDDEN_OUTPUT:${forbidden}`);
    if (sha256(output) !== metadata.outputSha256) errors.push("OUTPUT_DIGEST");
    results.push({
        runId,
        condition: metadata.condition,
        provider: metadata.provider,
        model: metadata.model,
        repetition: metadata.repetition,
        structurallyValid:
            Array.isArray(values) &&
            values.length === cases.length &&
            !errors.some(
                (error) =>
                    ["INVALID_JSON_ARRAY", "CASE_COUNT"].includes(error) ||
                    error.endsWith(":FIELDS"),
            ),
        decisionMatches,
        rationalesValid,
        caseCount: cases.length,
        errors: [...new Set(errors)].sort(),
        outputSha256: metadata.outputSha256,
    });
}

const summarize = (condition) => {
    const selected = results.filter((result) => result.condition === condition);
    return {
        runs: selected.length,
        structurallyValid: selected.filter((result) => result.structurallyValid)
            .length,
        decisionMatches: selected.reduce(
            (total, result) => total + result.decisionMatches,
            0,
        ),
        rationalesValid: selected.reduce(
            (total, result) => total + result.rationalesValid,
            0,
        ),
        errorCount: selected.reduce(
            (total, result) => total + result.errors.length,
            0,
        ),
    };
};
const baseline = summarize("BASELINE_OUTPUT_CONTRACT_ONLY");
const skill = summarize("SKILL_WITH_OUTPUT_CONTRACT");
const skillRuns = results.filter(
    (result) => result.condition === "SKILL_WITH_OUTPUT_CONTRACT",
);
const skillPass =
    skillRuns.length === 4 &&
    skillRuns.every(
        (result) =>
            result.structurallyValid &&
            result.decisionMatches === result.caseCount &&
            result.rationalesValid === result.caseCount &&
            result.errors.length === 0,
    );
const grading = {
    schemaVersion: "1.0.0",
    state: skillPass ? "HELD_OUT_SKILL_PASS" : "HELD_OUT_SKILL_FAIL",
    sourceRevision: manifest.sourceRevision,
    promptSha256: manifest.promptSha256,
    runs: results,
    byCondition: {
        BASELINE_OUTPUT_CONTRACT_ONLY: baseline,
        SKILL_WITH_OUTPUT_CONTRACT: skill,
    },
    decisionImprovement: skill.decisionMatches - baseline.decisionMatches,
    skillPass,
    targetApproval: false,
    installationEligible: false,
    promotionEligible: false,
    remainingGates: [
        "independent output review",
        "owner approval",
        "install update rollback canary",
    ],
};
writeFileSync(gradingPath, `${JSON.stringify(grading, null, 2)}\n`);
process.stdout.write(
    `Graded ${results.length} held-out runs: ${grading.state}.\n`,
);
if (!skillPass) process.exitCode = 1;
