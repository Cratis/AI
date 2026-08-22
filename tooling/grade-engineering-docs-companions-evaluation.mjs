#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const evaluationRoot = join(
    repositoryRoot,
    "evals/cratis-engineering-docs-companions",
);
const evaluationPass = process.argv[2] ?? "calibration";
if (!["calibration", "held-out"].includes(evaluationPass))
    throw new Error(`Unknown evaluation pass: ${evaluationPass}`);
const heldOut = evaluationPass === "held-out";
const casesPath = join(
    evaluationRoot,
    heldOut ? "held-out-cases.jsonl" : "cases.jsonl",
);
const planPath = join(
    evaluationRoot,
    heldOut ? "held-out-evaluation-plan.json" : "evaluation-plan.json",
);
const runsRoot = join(evaluationRoot, heldOut ? "held-out-runs" : "runs");
const outputPath = join(
    evaluationRoot,
    heldOut ? "held-out-grading.json" : "grading.json",
);

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function parseJson(content, description) {
    try {
        return JSON.parse(content);
    } catch (error) {
        throw new Error(`Unable to parse ${description}`, { cause: error });
    }
}

function readJson(path) {
    return parseJson(readFileSync(path, "utf8"), path);
}

function parseOutput(path) {
    const text = readFileSync(path, "utf8").trim();
    const unwrapped = text
        .replace(/^```(?:json)?\s*/u, "")
        .replace(/\s*```$/u, "");
    const value = parseJson(unwrapped, `companion evaluation output: ${path}`);
    if (!Array.isArray(value))
        throw new Error(`Output is not an array: ${path}`);
    return value;
}

function validateRunSet() {
    const plan = readJson(planPath);
    const manifest = readJson(join(runsRoot, "manifest.json"));
    if (manifest.evaluationPass !== evaluationPass)
        throw new Error(
            "Run manifest pass does not match requested grading pass",
        );
    if (
        manifest.sourceRevision !== plan.sourceRevision ||
        manifest.promptSha256 !== plan.promptSha256
    )
        throw new Error("Run manifest does not match the frozen plan identity");
    const expectedRuns = plan.models
        .flatMap((modelName) => {
            const [provider, ...modelParts] = modelName.split("/");
            const model = modelParts.join("/");
            return plan.conditions.flatMap((condition) =>
                Array.from(
                    { length: plan.repetitionsPerModelCondition },
                    (_, index) =>
                        JSON.stringify({
                            condition,
                            provider,
                            model,
                            repetition: index + 1,
                        }),
                ),
            );
        })
        .sort();
    const actualRuns = manifest.runs
        .map((run) =>
            JSON.stringify({
                condition: run.condition,
                provider: run.provider,
                model: run.model,
                repetition: run.repetition,
            }),
        )
        .sort();
    if (
        manifest.runs.length !== plan.plannedModelRuns ||
        JSON.stringify(actualRuns) !== JSON.stringify(expectedRuns)
    )
        throw new Error(
            "Run manifest does not exactly match the frozen run matrix",
        );
    const runDirectories = readdirSync(runsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    const manifestIds = manifest.runs.map((run) => run.runId).sort();
    if (JSON.stringify(runDirectories) !== JSON.stringify(manifestIds))
        throw new Error("Run manifest does not exactly cover run directories");
    const expectedMetadataKeys = [
        "schemaVersion",
        "runId",
        "condition",
        "provider",
        "model",
        "repetition",
        "startedAt",
        "durationMilliseconds",
        "exitCode",
        "signal",
        "toolsEnabled",
        "contextFilesEnabled",
        "outputSha256",
    ].sort();
    for (const manifestRun of manifest.runs) {
        const runRoot = join(runsRoot, manifestRun.runId);
        const metadata = readJson(join(runRoot, "metadata.json"));
        if (
            JSON.stringify(Object.keys(metadata).sort()) !==
            JSON.stringify(expectedMetadataKeys)
        )
            throw new Error(`Unexpected metadata shape: ${manifestRun.runId}`);
        if (JSON.stringify(metadata) !== JSON.stringify(manifestRun))
            throw new Error(
                `Metadata differs from manifest: ${manifestRun.runId}`,
            );
        const output = readFileSync(join(runRoot, "output.txt"));
        if (sha256(output) !== metadata.outputSha256)
            throw new Error(`Output hash mismatch: ${manifestRun.runId}`);
        if (metadata.exitCode !== 0 || metadata.signal !== null)
            throw new Error(`Run did not finish cleanly: ${manifestRun.runId}`);
        if (metadata.toolsEnabled || metadata.contextFilesEnabled)
            throw new Error(
                `Run used forbidden capabilities: ${manifestRun.runId}`,
            );
    }
    return manifest;
}

const cases = readFileSync(casesPath, "utf8")
    .trim()
    .split("\n")
    .map((line, index) =>
        parseJson(line, `companion case ${index + 1}: ${casesPath}`),
    );
const expectedById = new Map(cases.map((item) => [item.id, item]));
const manifest = validateRunSet();
const grades = [];
for (const run of manifest.runs) {
    const items = parseOutput(join(runsRoot, run.runId, "output.txt"));
    const seen = new Set();
    let decisionMatches = 0;
    let reasonMatches = 0;
    const caseGrades = [];
    for (const item of items) {
        const caseId = item.caseId;
        const expected = expectedById.get(caseId);
        if (!expected || seen.has(caseId))
            throw new Error(
                `Unknown or duplicate case in ${run.runId}: ${caseId}`,
            );
        seen.add(caseId);
        const expectedDecision = heldOut
            ? expected.expectedDecision
            : expected.expected.decision;
        const decisionMatch = item.decision === expectedDecision;
        decisionMatches += decisionMatch ? 1 : 0;
        const grade = { caseId, decisionMatch };
        if (heldOut) {
            grade.rationalePresent =
                typeof item.rationale === "string" &&
                item.rationale.trim().length > 0;
            reasonMatches += grade.rationalePresent ? 1 : 0;
        } else {
            grade.reasonMatch = item.reason === expected.expected.reason;
            reasonMatches += grade.reasonMatch ? 1 : 0;
        }
        caseGrades.push(grade);
    }
    if (seen.size !== cases.length)
        throw new Error(
            `Run ${run.runId} did not cover every case exactly once`,
        );
    grades.push({
        runId: run.runId,
        condition: run.condition,
        model: `${run.provider}/${run.model}`,
        repetition: run.repetition,
        caseCount: cases.length,
        decisionMatches,
        ...(heldOut ? { rationalesPresent: reasonMatches } : { reasonMatches }),
        caseGrades,
    });
}
const summarize = (condition) => {
    const matching = grades.filter((grade) => grade.condition === condition);
    const summary = {
        runCount: matching.length,
        decisionMatches: matching.reduce(
            (sum, grade) => sum + grade.decisionMatches,
            0,
        ),
        decisionOpportunities: matching.length * cases.length,
    };
    if (heldOut) {
        summary.rationalesPresent = matching.reduce(
            (sum, grade) => sum + grade.rationalesPresent,
            0,
        );
        summary.rationaleOpportunities = matching.length * cases.length;
    } else {
        summary.reasonMatches = matching.reduce(
            (sum, grade) => sum + grade.reasonMatches,
            0,
        );
        summary.reasonOpportunities = matching.length * cases.length;
    }
    return summary;
};
const grading = {
    schemaVersion: "1.0.0",
    evaluationPass,
    sourceRevision: manifest.sourceRevision,
    runCount: grades.length,
    caseCount: cases.length,
    summaries: Object.fromEntries(
        [
            "BASELINE_OUTPUT_CONTRACT_ONLY",
            "COMPANION_SKILLS_WITH_OUTPUT_CONTRACT",
        ].map((condition) => [condition, summarize(condition)]),
    ),
    runs: grades,
    targetApproval: false,
    installationEligible: false,
    promotionEligible: false,
};
writeFileSync(outputPath, `${JSON.stringify(grading, null, 2)}\n`);
process.stdout.write(
    `Graded ${grades.length} ${evaluationPass} companion evaluation runs.\n`,
);
