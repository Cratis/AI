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
const runsRoot = join(evaluationRoot, "runs");
const gradingPath = join(evaluationRoot, "grading.json");
const expectedKeys = [
    "authorityUsed",
    "caseId",
    "decision",
    "documentType",
    "outline",
    "reason",
].sort();

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(`Unable to parse evaluation JSON: ${path}`, {
            cause: error,
        });
    }
}

function parseOutput(content) {
    const trimmed = content.trim();
    const unfenced = trimmed
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");
    try {
        return { value: JSON.parse(unfenced), error: null };
    } catch {
        return { value: null, error: "INVALID_JSON" };
    }
}

if (!existsSync(runsRoot)) throw new Error("Evaluation runs are missing");
if (existsSync(gradingPath))
    throw new Error("Evaluation grading already exists");
const cases = readFileSync(join(evaluationRoot, "cases.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse);
const expected = new Map(
    cases.map((testCase) => [testCase.id, testCase.expected]),
);
const manifest = readJson(join(runsRoot, "manifest.json"));
const runDirectories = readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
if (runDirectories.length !== manifest.runs.length)
    throw new Error("Evaluation run inventory does not match its manifest");

const results = [];
for (const runId of runDirectories) {
    const runRoot = join(runsRoot, runId);
    const metadata = readJson(join(runRoot, "metadata.json"));
    const output = readFileSync(join(runRoot, "output.txt"), "utf8");
    const parsed = parseOutput(output);
    const errors = [];
    let routingMatches = 0;
    let documentTypeMatches = 0;
    let validOutlines = 0;
    let authorityMatches = 0;
    if (Array.isArray(parsed.value)) {
        if (parsed.value.length !== cases.length) errors.push("CASE_COUNT");
        for (let index = 0; index < parsed.value.length; index++) {
            const item = parsed.value[index];
            const testCase = cases[index];
            if (
                !item ||
                typeof item !== "object" ||
                Array.isArray(item) ||
                JSON.stringify(Object.keys(item).sort()) !==
                    JSON.stringify(expectedKeys)
            ) {
                errors.push(`${testCase?.id ?? index}:FIELDS`);
                continue;
            }
            if (item.caseId !== testCase.id)
                errors.push(`${testCase.id}:ORDER`);
            const oracle = expected.get(testCase.id);
            if (
                item.decision === oracle.decision &&
                item.reason === oracle.reason
            )
                routingMatches++;
            else errors.push(`${testCase.id}:DECISION`);
            if (item.documentType === oracle.documentType)
                documentTypeMatches++;
            else errors.push(`${testCase.id}:DOCUMENT_TYPE`);
            const authoring = oracle.decision === "AUTHOR_CONTENT";
            const outlineValid =
                Array.isArray(item.outline) &&
                (authoring
                    ? item.outline.length >= 3 &&
                      item.outline.length <= 5 &&
                      item.outline.every((heading) => {
                          if (typeof heading !== "string") return false;
                          const normalized = heading.replace(/^##\s+/, "");
                          return (
                              normalized.length > 0 &&
                              !normalized.includes("\n") &&
                              !normalized.includes("#")
                          );
                      })
                    : item.outline.length === 0);
            if (outlineValid) validOutlines++;
            else errors.push(`${testCase.id}:OUTLINE`);
            const authorityExpected = authoring
                ? "VERIFIED_FIRST_PARTY_SOURCE"
                : "NONE";
            if (item.authorityUsed === authorityExpected) authorityMatches++;
            else errors.push(`${testCase.id}:AUTHORITY`);
        }
    } else errors.push(parsed.error ?? "OUTPUT_NOT_ARRAY");
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
            Array.isArray(parsed.value) &&
            parsed.value.length === cases.length &&
            !errors.some(
                (error) =>
                    error.endsWith(":FIELDS") || error === "INVALID_JSON",
            ),
        routingMatches,
        documentTypeMatches,
        validOutlines,
        authorityMatches,
        caseCount: cases.length,
        errors: [...new Set(errors)].sort(),
        outputSha256: metadata.outputSha256,
    });
}

const byCondition = Object.fromEntries(
    ["BASELINE_OUTPUT_CONTRACT_ONLY", "SKILL_WITH_OUTPUT_CONTRACT"].map(
        (condition) => {
            const selected = results.filter(
                (result) => result.condition === condition,
            );
            return [
                condition,
                {
                    runs: selected.length,
                    structurallyValid: selected.filter(
                        (result) => result.structurallyValid,
                    ).length,
                    routingMatches: selected.reduce(
                        (total, result) => total + result.routingMatches,
                        0,
                    ),
                    documentTypeMatches: selected.reduce(
                        (total, result) => total + result.documentTypeMatches,
                        0,
                    ),
                    validOutlines: selected.reduce(
                        (total, result) => total + result.validOutlines,
                        0,
                    ),
                    authorityMatches: selected.reduce(
                        (total, result) => total + result.authorityMatches,
                        0,
                    ),
                    errorCount: selected.reduce(
                        (total, result) => total + result.errors.length,
                        0,
                    ),
                },
            ];
        },
    ),
);
const skillRuns = results.filter(
    (result) => result.condition === "SKILL_WITH_OUTPUT_CONTRACT",
);
const skillBehaviorPass =
    skillRuns.length === 4 &&
    skillRuns.every(
        (result) =>
            result.structurallyValid &&
            result.routingMatches === result.caseCount &&
            result.validOutlines === result.caseCount &&
            result.authorityMatches === result.caseCount &&
            result.errors.every((error) => error.endsWith(":DOCUMENT_TYPE")),
    );
const strictContractPass =
    skillBehaviorPass &&
    skillRuns.every((result) => result.errors.length === 0);
const grading = {
    schemaVersion: "1.0.0",
    state: strictContractPass
        ? "SKILL_STRICT_PASS_BASELINE_SATURATED"
        : skillBehaviorPass
          ? "SKILL_BEHAVIOR_PASS_CONTRACT_GAPS"
          : "SKILL_BEHAVIOR_FAIL",
    sourceRevision: manifest.sourceRevision,
    promptSha256: manifest.promptSha256,
    runs: results,
    byCondition,
    skillBehaviorPass,
    strictContractPass,
    baselineDiagnostic:
        "The frozen output contract exposed the routing vocabulary, so baseline routing is not evidence of skill value.",
    targetApproval: false,
    installationEligible: false,
    promotionEligible: false,
    remainingGates: [
        "held-out routing evaluation without reason-code leakage",
        "strict document-type normalization",
        "independent output review",
        "owner approval",
        "install update rollback canary",
    ],
};
writeFileSync(gradingPath, `${JSON.stringify(grading, null, 2)}\n`);
process.stdout.write(`Graded ${results.length} runs: ${grading.state}.\n`);
if (!skillBehaviorPass) process.exitCode = 1;
