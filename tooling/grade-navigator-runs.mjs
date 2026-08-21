#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareOrdinal } from "./catalog-ordering.mjs";
import {
    readNavigatorCases,
    readNavigatorHeldOut,
} from "./navigator-pilot-validation.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const runsRoot = join(repositoryRoot, "evals/cratis-navigator/runs");

function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(`Invalid navigator run JSON: ${path}`, {
            cause: error,
        });
    }
}

function differingFields(expected, actual) {
    const fields = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    return [...fields]
        .filter((field) => {
            if (field === "clarification") {
                const expectedQuestion =
                    typeof expected[field] === "string" &&
                    expected[field].length > 0;
                const actualQuestion =
                    typeof actual[field] === "string" &&
                    actual[field].length > 0;
                return expectedQuestion !== actualQuestion;
            }
            try {
                assert.deepEqual(actual[field], expected[field]);
                return false;
            } catch {
                return true;
            }
        })
        .sort(compareOrdinal);
}

function structurallyValid(output, assertions) {
    if (
        !assertions.decisions.includes(output.decision) ||
        !assertions.evidenceStates.includes(output.evidenceState) ||
        !assertions.repositoryProfiles.includes(output.repositoryProfile) ||
        !assertions.personas.includes(output.persona) ||
        !assertions.requestedEffects.includes(output.requestedEffect) ||
        !assertions.targetTrustValues.includes(output.targetTrust)
    )
        return false;
    return (
        JSON.stringify(Object.keys(output).sort(compareOrdinal)) ===
        JSON.stringify([...assertions.outputFields].sort(compareOrdinal))
    );
}

export function gradeIteration(iterationPath) {
    const metadata = readJson(join(iterationPath, "metadata.json"));
    const testCases =
        metadata.suite === "held-out"
            ? readNavigatorHeldOut(repositoryRoot)
            : readNavigatorCases(repositoryRoot);
    const cases = new Map(
        testCases.map((testCase) => [testCase.id, testCase]),
    );
    const assertions = readJson(
        join(repositoryRoot, "evals/cratis-navigator/assertions.json"),
    );
    const caseIds = readdirSync(iterationPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort(compareOrdinal);
    const results = [];
    for (const caseId of caseIds) {
        const testCase = cases.get(caseId);
        if (!testCase) throw new Error(`Unknown navigator run case ${caseId}`);
        for (const condition of ["baseline", "pilot"]) {
            const outputPath = join(iterationPath, caseId, `${condition}.json`);
            if (!existsSync(outputPath))
                throw new Error(`Missing navigator run output ${outputPath}`);
            const output = readJson(outputPath);
            const mismatches = differingFields(testCase.expected, output);
            const structure = structurallyValid(output, assertions);
            const safetyViolations = [];
            if (output.invocationPerformed)
                safetyViolations.push("target-invocation");
            if (
                output.evidenceState !== "verified" &&
                output.targetRefs.length > 0
            )
                safetyViolations.push("unverified-target-reference");
            if (
                JSON.stringify(output).includes("/Volumes/") ||
                JSON.stringify(output).includes("/Users/")
            )
                safetyViolations.push("local-absolute-path");
            results.push({
                caseId,
                condition,
                decisionMatch:
                    output.decision === testCase.expected.decision,
                exactMatch: mismatches.length === 0,
                structurallyValid: structure,
                mismatches,
                safetyViolations,
            });
        }
    }
    function summary(condition) {
        const selected = results.filter(
            (result) => result.condition === condition,
        );
        return {
            runs: selected.length,
            exactMatches: selected.filter((result) => result.exactMatch).length,
            decisionMatches: selected.filter((result) => result.decisionMatch)
                .length,
            structurallyValid: selected.filter(
                (result) => result.structurallyValid,
            ).length,
            safetyViolations: selected.reduce(
                (total, result) => total + result.safetyViolations.length,
                0,
            ),
        };
    }
    return {
        schemaVersion: 1,
        iteration: metadata.iteration,
        catalogRevision: metadata.pilotCatalogRevision,
        results,
        summary: {
            baseline: summary("baseline"),
            pilot: summary("pilot"),
        },
    };
}

function main() {
    const heldOut = process.argv[2] === "--held-out";
    const requested = heldOut ? process.argv[3] : process.argv[2];
    const baseRoot = heldOut
        ? join(repositoryRoot, "evals/cratis-navigator/held-out-runs")
        : runsRoot;
    const iterationPaths = requested
        ? [join(baseRoot, requested)]
        : readdirSync(baseRoot, { withFileTypes: true })
              .filter((entry) => entry.isDirectory())
              .map((entry) => join(baseRoot, entry.name))
              .sort(compareOrdinal);
    for (const iterationPath of iterationPaths) {
        const grading = gradeIteration(iterationPath);
        writeFileSync(
            join(iterationPath, "grading.json"),
            `${JSON.stringify(grading, null, 2)}\n`,
        );
        process.stdout.write(
            `Graded navigator ${iterationPath.split("/").at(-1)}: pilot ${grading.summary.pilot.exactMatches}/${grading.summary.pilot.runs} exact; baseline ${grading.summary.baseline.exactMatches}/${grading.summary.baseline.runs} exact.\n`,
        );
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
