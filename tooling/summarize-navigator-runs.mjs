#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareOrdinal } from "./catalog-ordering.mjs";
import { gradeIteration } from "./grade-navigator-runs.mjs";
import { readNavigatorCases } from "./navigator-pilot-validation.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const runsRoot = join(repositoryRoot, "evals/cratis-navigator/runs");

function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(`Invalid navigator summary JSON: ${path}`, {
            cause: error,
        });
    }
}

function aggregate(results, condition) {
    const selected = results.filter((result) => result.condition === condition);
    return {
        runs: selected.length,
        exactMatches: selected.filter((result) => result.exactMatch).length,
        decisionMatches: selected.filter((result) => result.decisionMatch).length,
        structurallyValid: selected.filter((result) => result.structurallyValid)
            .length,
        safetyViolations: selected.reduce(
            (total, result) => total + result.safetyViolations.length,
            0,
        ),
    };
}

function timingSummary(selection, condition) {
    let totalTokens = 0;
    let totalDurationMilliseconds = 0;
    for (const [caseId, runDirectory] of Object.entries(selection.selectedRuns)) {
        const metadata = readJson(join(runsRoot, runDirectory, "metadata.json"));
        const run = metadata.runs.find(
            (candidate) =>
                candidate.caseId === caseId &&
                candidate.condition === condition,
        );
        if (!run)
            throw new Error(
                `Missing ${condition} timing for ${caseId} in ${runDirectory}`,
            );
        totalTokens += run.totalTokens;
        totalDurationMilliseconds += run.durationMilliseconds;
    }
    return { totalTokens, totalDurationMilliseconds };
}

export function summarizeCanonicalRuns() {
    const selection = readJson(join(runsRoot, "canonical-selection.json"));
    const canonicalCaseIds = readNavigatorCases(repositoryRoot)
        .map((testCase) => testCase.id)
        .sort(compareOrdinal);
    const selectedCaseIds = Object.keys(selection.selectedRuns).sort(compareOrdinal);
    if (JSON.stringify(canonicalCaseIds) !== JSON.stringify(selectedCaseIds))
        throw new Error("Canonical navigator selection must cover every case exactly once");
    const gradingByDirectory = new Map();
    const results = [];
    for (const caseId of canonicalCaseIds) {
        const runDirectory = selection.selectedRuns[caseId];
        let grading = gradingByDirectory.get(runDirectory);
        if (!grading) {
            grading = gradeIteration(join(runsRoot, runDirectory));
            gradingByDirectory.set(runDirectory, grading);
        }
        for (const condition of ["baseline", "pilot"]) {
            const result = grading.results.find(
                (candidate) =>
                    candidate.caseId === caseId &&
                    candidate.condition === condition,
            );
            if (!result)
                throw new Error(
                    `Missing selected ${condition} result for ${caseId}`,
                );
            results.push({ ...result, runDirectory });
        }
    }
    return {
        schemaVersion: 1,
        catalogRevision: selection.catalogRevision,
        promotionState: "blocked",
        promotionBlockers: [
            "three-repeat full canonical run is incomplete",
            "held-out paraphrase threshold is unverified",
            "portability evaluation is incomplete",
            "independent originality and security promotion reviews are incomplete",
            "product targets and source contracts remain unverified",
        ],
        selectedRuns: selection.selectedRuns,
        results,
        summary: {
            baseline: {
                ...aggregate(results, "baseline"),
                ...timingSummary(selection, "baseline"),
            },
            pilot: {
                ...aggregate(results, "pilot"),
                ...timingSummary(selection, "pilot"),
            },
        },
    };
}

function markdown(summary) {
    const pilot = summary.summary.pilot;
    const baseline = summary.summary.baseline;
    const lines = [
        "# Navigator canonical evaluation summary",
        "",
        `**Catalog revision:** \`${summary.catalogRevision}\``,
        "",
        "**Promotion:** blocked",
        "",
        "| Condition | Exact | Decision | Structurally valid | Safety violations | Tokens | Duration (ms) |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        `| Pilot | ${pilot.exactMatches}/${pilot.runs} | ${pilot.decisionMatches}/${pilot.runs} | ${pilot.structurallyValid}/${pilot.runs} | ${pilot.safetyViolations} | ${pilot.totalTokens} | ${pilot.totalDurationMilliseconds} |`,
        `| Baseline | ${baseline.exactMatches}/${baseline.runs} | ${baseline.decisionMatches}/${baseline.runs} | ${baseline.structurallyValid}/${baseline.runs} | ${baseline.safetyViolations} | ${baseline.totalTokens} | ${baseline.totalDurationMilliseconds} |`,
        "",
        "## Promotion blockers",
        "",
        ...summary.promotionBlockers.map((blocker) => `- ${blocker}`),
        "",
        "## Scope",
        "",
        "The selected run for each canonical case is declared in",
        "`canonical-selection.json`. This summary compares one corrected pilot run",
        "per case with its paired baseline. It does not claim the repetition or",
        "held-out evidence required for promotion, and it grants no runtime approval.",
        "",
    ];
    return lines.join("\n");
}

function main() {
    const summary = summarizeCanonicalRuns();
    writeFileSync(
        join(runsRoot, "canonical-summary.json"),
        `${JSON.stringify(summary, null, 2)}\n`,
    );
    writeFileSync(join(runsRoot, "canonical-summary.md"), markdown(summary));
    process.stdout.write(
        `Navigator canonical summary: pilot ${summary.summary.pilot.exactMatches}/${summary.summary.pilot.runs} exact; baseline ${summary.summary.baseline.exactMatches}/${summary.summary.baseline.runs} exact; promotion ${summary.promotionState}.\n`,
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
