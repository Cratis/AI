#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import {
    existsSync,
    lstatSync,
    readFileSync,
    readdirSync,
    writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { compareOrdinal } from "./catalog-ordering.mjs";
import { gradeIteration } from "./grade-navigator-runs.mjs";
import { readNavigatorCases } from "./navigator-pilot-validation.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const runsRoot = join(repositoryRoot, "evals/cratis-navigator/runs");

function readJson(path) {
    try {
        if (!existsSync(path) || !lstatSync(path).isFile())
            throw new Error("Expected a regular JSON file");
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
        contractMatches: selected.filter((result) => result.contractMatch).length,
        decisionMatches: selected.filter((result) => result.decisionMatch).length,
        structurallyValid: selected.filter((result) => result.structurallyValid)
            .length,
        observedOutputSafetyViolations: selected.reduce(
            (total, result) =>
                total + result.observedOutputSafetyViolations.length,
            0,
        ),
    };
}

function timingSummary(selection, condition, selectedRunsRoot) {
    let totalTokens = 0;
    let totalDurationMilliseconds = 0;
    for (const [caseId, runDirectory] of Object.entries(selection.selectedRuns)) {
        const metadata = readJson(
            join(selectedRunsRoot, runDirectory, "metadata.json"),
        );
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

export function summarizeCanonicalRuns(root = repositoryRoot) {
    const selectedRunsRoot = join(root, "evals/cratis-navigator/runs");
    const selection = readJson(
        join(selectedRunsRoot, "canonical-selection.json"),
    );
    const canonicalCaseIds = readNavigatorCases(root)
        .map((testCase) => testCase.id)
        .sort(compareOrdinal);
    const selectedCaseIds = Object.keys(selection.selectedRuns).sort(compareOrdinal);
    const selectedRunEntries = readdirSync(selectedRunsRoot, {
        withFileTypes: true,
    });
    if (
        selectedRunEntries.some(
            (entry) => !entry.isFile() && !entry.isDirectory(),
        )
    )
        throw new Error("Navigator run inventory contains a non-regular entry");
    const availableRunDirectories = new Set(
        selectedRunEntries
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name),
    );
    if (
        !Object.values(selection.selectedRuns).every(
            (run) =>
                typeof run === "string" &&
                /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(run) &&
                availableRunDirectories.has(run),
        )
    )
        throw new Error("Canonical navigator selected run values must be non-empty strings");
    if (JSON.stringify(canonicalCaseIds) !== JSON.stringify(selectedCaseIds))
        throw new Error("Canonical navigator selection must cover every case exactly once");
    const gradingByDirectory = new Map();
    const results = [];
    for (const caseId of canonicalCaseIds) {
        const runDirectory = selection.selectedRuns[caseId];
        let grading = gradingByDirectory.get(runDirectory);
        if (!grading) {
            grading = gradeIteration(
                join(selectedRunsRoot, runDirectory),
                root,
            );
            if (grading.catalogRevision !== selection.catalogRevision)
                throw new Error(
                    `Selected run ${runDirectory} uses a different catalog revision`,
                );
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
            "canonical strict exactness threshold is not met",
            "held-out strict exactness threshold is not met",
            "effect telemetry is absent",
            "portability evaluation is incomplete",
            "independent originality and security promotion reviews are incomplete",
            "product targets and source contracts remain unverified",
        ],
        selectedRuns: selection.selectedRuns,
        safetyEvidence: {
            state: "output-only",
            unverified: [
                "out-of-band repository writes",
                "out-of-band network access",
                "approval mutations",
                "project-context precedence loss outside output",
                "tool-side effects outside output",
            ],
        },
        results,
        summary: {
            baseline: {
                ...aggregate(results, "baseline"),
                ...timingSummary(selection, "baseline", selectedRunsRoot),
            },
            pilot: {
                ...aggregate(results, "pilot"),
                ...timingSummary(selection, "pilot", selectedRunsRoot),
            },
        },
    };
}

export function renderCanonicalSummaryMarkdown(summary) {
    const pilot = summary.summary.pilot;
    const baseline = summary.summary.baseline;
    const lines = [
        "# Navigator canonical evaluation summary",
        "",
        `**Catalog revision:** \`${summary.catalogRevision}\``,
        "",
        "**Promotion:** blocked",
        "",
        "| Condition | Strict exact | Contract | Decision | Structurally valid | Observed output violations | Tokens | Duration (ms) |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
        `| Pilot | ${pilot.exactMatches}/${pilot.runs} | ${pilot.contractMatches}/${pilot.runs} | ${pilot.decisionMatches}/${pilot.runs} | ${pilot.structurallyValid}/${pilot.runs} | ${pilot.observedOutputSafetyViolations} | ${pilot.totalTokens} | ${pilot.totalDurationMilliseconds} |`,
        `| Baseline | ${baseline.exactMatches}/${baseline.runs} | ${baseline.contractMatches}/${baseline.runs} | ${baseline.decisionMatches}/${baseline.runs} | ${baseline.structurallyValid}/${baseline.runs} | ${baseline.observedOutputSafetyViolations} | ${baseline.totalTokens} | ${baseline.totalDurationMilliseconds} |`,
        "",
        "Contract matching requires exact non-clarification fields and checks only",
        "clarification presence or absence; it does not claim semantic equivalence.",
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
        "Observed output violations do not prove absence of out-of-band tool, network,",
        "repository, approval, or project-context effects; those require telemetry.",
        "",
    ];
    return lines.join("\n");
}

export function validatePersistedCanonicalEvidence(root = repositoryRoot) {
    const errors = [];
    const selectedRunsRoot = join(root, "evals/cratis-navigator/runs");
    let recomputedSummary;
    try {
        recomputedSummary = summarizeCanonicalRuns(root);
    } catch (error) {
        errors.push(`Navigator canonical recomputation failed: ${error.message}`);
    }
    const summaryJsonPath = join(selectedRunsRoot, "canonical-summary.json");
    const summaryMarkdownPath = join(selectedRunsRoot, "canonical-summary.md");
    let persistedSummary;
    try {
        if (existsSync(summaryJsonPath)) persistedSummary = readJson(summaryJsonPath);
    } catch (error) {
        errors.push(`Persisted navigator canonical summary JSON is invalid: ${error.message}`);
    }
    if (
        !recomputedSummary ||
        !persistedSummary ||
        !isDeepStrictEqual(persistedSummary, recomputedSummary)
    )
        errors.push("Persisted navigator canonical summary JSON is stale");
    let persistedMarkdown;
    try {
        if (
            existsSync(summaryMarkdownPath) &&
            lstatSync(summaryMarkdownPath).isFile()
        )
            persistedMarkdown = readFileSync(summaryMarkdownPath, "utf8");
    } catch (error) {
        errors.push(
            `Persisted navigator canonical summary Markdown is unreadable: ${error.message}`,
        );
    }
    if (
        !recomputedSummary ||
        persistedMarkdown !== renderCanonicalSummaryMarkdown(recomputedSummary)
    )
        errors.push("Persisted navigator canonical summary Markdown is stale");
    let runEntries = [];
    try {
        if (!existsSync(selectedRunsRoot) || !lstatSync(selectedRunsRoot).isDirectory())
            throw new Error("Expected the navigator runs directory");
        runEntries = readdirSync(selectedRunsRoot, { withFileTypes: true });
    } catch (error) {
        errors.push(`Navigator run inventory is unreadable: ${error.message}`);
    }
    for (const entry of runEntries) {
        if (!entry.isFile() && !entry.isDirectory()) {
            errors.push(
                `${entry.name}: navigator run inventory entry is not regular`,
            );
            continue;
        }
        if (!entry.isDirectory()) continue;
        const iterationRoot = join(selectedRunsRoot, entry.name);
        const gradingPath = join(iterationRoot, "grading.json");
        try {
            if (
                !existsSync(gradingPath) ||
                !isDeepStrictEqual(
                    readJson(gradingPath),
                    gradeIteration(iterationRoot, root),
                )
            )
                errors.push(`${entry.name}: persisted navigator grading is stale`);
        } catch (error) {
            errors.push(
                `${entry.name}: persisted navigator grading cannot be recomputed: ${error.message}`,
            );
        }
    }
    return errors;
}

function main() {
    const summary = summarizeCanonicalRuns();
    writeFileSync(
        join(runsRoot, "canonical-summary.json"),
        `${JSON.stringify(summary, null, 2)}\n`,
    );
    writeFileSync(
        join(runsRoot, "canonical-summary.md"),
        renderCanonicalSummaryMarkdown(summary),
    );
    process.stdout.write(
        `Navigator canonical summary: pilot ${summary.summary.pilot.exactMatches}/${summary.summary.pilot.runs} exact; baseline ${summary.summary.baseline.exactMatches}/${summary.summary.baseline.runs} exact; promotion ${summary.promotionState}.\n`,
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
