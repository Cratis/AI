// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { compareOrdinal } from "./catalog-ordering.mjs";
import {
    defaultRepositoryRoot,
    readCatalog,
} from "./catalog-validation.mjs";

const pilotRoot = "pilots/cratis-navigator";
const evaluationRoot = "evals/cratis-navigator";

const outputFields = [
    "decision",
    "candidateRoutes",
    "targetRefs",
    "repositoryProfile",
    "persona",
    "language",
    "surface",
    "requestedEffect",
    "targetTrust",
    "evidenceState",
    "evidenceRefs",
    "catalogRevision",
    "sourceRevision",
    "projectContextRefs",
    "invocationPerformed",
    "reasonCode",
    "clarification",
];

function duplicates(values) {
    const seen = new Set();
    return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

function equalSets(left, right) {
    return (
        JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
    );
}

function unknownProperties(value, allowed, label, errors) {
    for (const property of Object.keys(value)) {
        if (!allowed.includes(property))
            errors.push(`${label}: unknown property ${property}`);
    }
}

function readJsonLines(path, label) {
    return readFileSync(path, "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line, index) => {
            try {
                return JSON.parse(line);
            } catch (error) {
                throw new Error(`Invalid ${label} JSON on line ${index + 1}`, {
                    cause: error,
                });
            }
        });
}

export function readNavigatorCases(root = defaultRepositoryRoot) {
    return readJsonLines(
        join(root, evaluationRoot, "cases.jsonl"),
        "navigator case",
    );
}

export function readNavigatorHeldOut(root = defaultRepositoryRoot) {
    return readJsonLines(
        join(root, evaluationRoot, "held-out.jsonl"),
        "navigator held-out case",
    );
}

export function validateNavigatorPilot(root = defaultRepositoryRoot) {
    const errors = [];
    const metadata = readCatalog(join(root, pilotRoot, "metadata.draft.json"));
    const routeCatalog = readCatalog(join(root, pilotRoot, "routes.draft.json"));
    const assertions = readCatalog(
        join(root, evaluationRoot, "assertions.json"),
    );
    const targets = readCatalog(join(root, "catalog/v2/targets.json")).targets;
    const authoringContracts = readCatalog(
        join(root, "catalog/v2/authoring-contracts.json"),
    ).contracts;
    const cases = readNavigatorCases(root);
    const heldOut = readNavigatorHeldOut(root);
    const allCases = [...cases, ...heldOut];
    const targetById = new Map(targets.map((target) => [target.id, target]));
    const routeByKey = new Map(
        routeCatalog.routes.map((route) => [route.semanticKey, route]),
    );

    if (
        metadata.runtimeApproved ||
        metadata.runtimeEligible ||
        metadata.runtimeDiscoverable ||
        metadata.evaluationPayloadIncludedAtRuntime
    ) {
        errors.push("Navigator pilot must remain absent from runtime");
    }
    if (
        metadata.routerTrust !== "passive" ||
        metadata.effects.length > 0 ||
        metadata.childInvocationAllowed ||
        metadata.repositoryWritesAllowed ||
        metadata.remoteWritesAllowed ||
        metadata.networkAllowed
    ) {
        errors.push("Navigator pilot must remain passive and effect-free");
    }
    if (
        metadata.routeDepth !== 1 ||
        metadata.maximumTargets !== 5 ||
        metadata.maximumClarifyingQuestions !== 1
    ) {
        errors.push("Navigator pilot bounds changed");
    }
    if (
        metadata.explicitInvocationBypassesEvidence ||
        metadata.adjacentFallbackAllowed ||
        metadata.personaGrantsAuthority
    ) {
        errors.push("Navigator pilot cannot bypass evidence or authority");
    }
    const authoringContract = authoringContracts.find(
        (contract) => contract.id === metadata.authoringContractId,
    );
    if (!authoringContract || authoringContract.state !== "active")
        errors.push("Navigator pilot needs the active clean-room contract");

    const routeKeys = routeCatalog.routes.map((route) => route.semanticKey);
    for (const duplicate of duplicates(routeKeys))
        errors.push(`Duplicate navigator route ${duplicate}`);
    for (const route of routeCatalog.routes) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route.semanticKey))
            errors.push(`Invalid navigator route key ${route.semanticKey}`);
        if (route.evidenceState !== "absent" || route.evidenceRefs.length > 0)
            errors.push(`${route.semanticKey}: pilot route cannot claim evidence`);
        if (route.evidenceState !== "verified" && route.targetTrust !== "unknown")
            errors.push(
                `${route.semanticKey}: unverified route trust must be unknown`,
            );
        if (route.approvalState === "approved")
            errors.push(`${route.semanticKey}: pilot route cannot claim approval`);
        for (const targetId of route.candidateTargetIds) {
            const target = targetById.get(targetId);
            if (!target)
                errors.push(`${route.semanticKey}: unknown target ${targetId}`);
            else if (
                target.audience !== "public" ||
                target.approval.state !== "candidate" ||
                target.includeInRuntime
            )
                errors.push(`${route.semanticKey}: target is not a public candidate`);
        }
    }

    if (!equalSets(assertions.outputFields, outputFields))
        errors.push("Navigator output fields changed");
    for (const duplicate of duplicates(assertions.outputFields))
        errors.push(`Duplicate navigator output field ${duplicate}`);

    const caseIds = cases.map((testCase) => testCase.id);
    const allCaseIds = allCases.map((testCase) => testCase.id);
    for (const duplicate of duplicates(allCaseIds))
        errors.push(`Duplicate navigator case ${duplicate}`);
    const positives = cases.filter((testCase) => testCase.kind === "positive");
    const negatives = cases.filter((testCase) => testCase.kind === "negative");
    if (positives.length !== 12 || negatives.length !== 16)
        errors.push("Navigator suite must contain 12 positive and 16 negative cases");
    if (heldOut.length !== 10)
        errors.push("Navigator held-out suite must contain 10 cases");
    const canonicalPrompts = new Set(cases.map((testCase) => testCase.prompt));
    for (const testCase of heldOut) {
        if (canonicalPrompts.has(testCase.prompt))
            errors.push(`${testCase.id}: held-out prompt duplicates canonical input`);
    }
    for (const testCase of allCases) {
        unknownProperties(
            testCase,
            ["id", "kind", "prompt", "expected"],
            testCase.id,
            errors,
        );
        unknownProperties(
            testCase.expected,
            outputFields,
            `${testCase.id} expected output`,
            errors,
        );
        if (!equalSets(Object.keys(testCase.expected), outputFields))
            errors.push(`${testCase.id}: expected output fields are incomplete`);
        if (!assertions.decisions.includes(testCase.expected.decision))
            errors.push(`${testCase.id}: unknown decision`);
        if (!assertions.evidenceStates.includes(testCase.expected.evidenceState))
            errors.push(`${testCase.id}: unknown evidence state`);
        if (testCase.expected.invocationPerformed)
            errors.push(`${testCase.id}: pilot cannot perform invocation`);
        if (testCase.expected.catalogRevision !== routeCatalog.catalogRevision)
            errors.push(`${testCase.id}: catalog revision is not frozen`);
        if (
            testCase.expected.evidenceState !== "verified" &&
            testCase.expected.sourceRevision !== null
        )
            errors.push(`${testCase.id}: unverified source revision must be null`);
        if (testCase.expected.candidateRoutes.length > metadata.maximumTargets)
            errors.push(`${testCase.id}: route count exceeds pilot bound`);
        if (
            testCase.expected.decision !== "CLARIFY" &&
            testCase.expected.clarification !== null
        )
            errors.push(`${testCase.id}: only clarification decisions ask a question`);
        if (
            testCase.expected.decision === "CLARIFY" &&
            (typeof testCase.expected.clarification !== "string" ||
                testCase.expected.clarification.length === 0)
        )
            errors.push(`${testCase.id}: clarification question is missing`);
        for (const route of testCase.expected.candidateRoutes) {
            if (!routeByKey.has(route))
                errors.push(`${testCase.id}: unknown candidate route ${route}`);
        }
        if (
            testCase.expected.evidenceState !== "verified" &&
            testCase.expected.targetRefs.length > 0
        )
            errors.push(`${testCase.id}: unverified case cannot emit target refs`);
        if (
            testCase.expected.evidenceState !== "verified" &&
            testCase.expected.targetTrust !== "unknown"
        )
            errors.push(`${testCase.id}: unverified case trust must be unknown`);
    }

    const pilotFiles = readdirSync(join(root, pilotRoot)).sort(compareOrdinal);
    const evaluationFiles = readdirSync(join(root, evaluationRoot)).sort(
        compareOrdinal,
    );
    if (
        !equalSets(pilotFiles, ["PILOT.md", "metadata.draft.json", "routes.draft.json"])
    )
        errors.push("Navigator pilot source inventory changed");
    if (
        !equalSets(evaluationFiles, [
            "assertions.json",
            "baseline.md",
            "cases.jsonl",
            "held-out-runs",
            "held-out.jsonl",
            "runs",
        ])
    )
        errors.push("Navigator evaluation inventory changed");

    const runsRoot = join(root, evaluationRoot, "runs");
    if (!existsSync(runsRoot)) errors.push("Navigator run evidence is missing");
    else {
        const runRootEntries = readdirSync(runsRoot, { withFileTypes: true });
        const runRootFiles = runRootEntries
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name)
            .sort(compareOrdinal);
        if (
            !equalSets(runRootFiles, [
                "canonical-selection.json",
                "canonical-summary.json",
                "canonical-summary.md",
            ])
        )
            errors.push("Navigator canonical summary inventory changed");
        const selectionPath = join(runsRoot, "canonical-selection.json");
        const summaryPath = join(runsRoot, "canonical-summary.json");
        if (existsSync(selectionPath) && existsSync(summaryPath)) {
            const selection = readCatalog(selectionPath);
            const summary = readCatalog(summaryPath);
            if (!equalSets(Object.keys(selection.selectedRuns), caseIds))
                errors.push("Navigator canonical selection is incomplete");
            if (
                summary.promotionState !== "blocked" ||
                summary.summary.pilot.runs !== caseIds.length ||
                summary.summary.baseline.runs !== caseIds.length
            )
                errors.push("Navigator canonical summary overstates its scope");
            for (const path of [selectionPath, summaryPath]) {
                const content = readFileSync(path, "utf8");
                if (
                    content.includes("/Volumes/") ||
                    content.includes("/Users/")
                )
                    errors.push("Navigator canonical summary leaked a local path");
            }
        }
        const iterationDirectories = runRootEntries
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort(compareOrdinal);
        for (const iteration of iterationDirectories) {
            const iterationRoot = join(runsRoot, iteration);
            const files = readdirSync(iterationRoot, {
                withFileTypes: true,
            });
            const rootFiles = files
                .filter((entry) => entry.isFile())
                .map((entry) => entry.name)
                .sort(compareOrdinal);
            if (
                !equalSets(rootFiles, [
                    "analysis.md",
                    "grading.json",
                    "metadata.json",
                ])
            )
                errors.push(`${iteration}: run evidence root files changed`);
            const metadataPath = join(iterationRoot, "metadata.json");
            const gradingPath = join(iterationRoot, "grading.json");
            if (!existsSync(metadataPath) || !existsSync(gradingPath)) continue;
            const metadata = readCatalog(metadataPath);
            const grading = readCatalog(gradingPath);
            const runCaseIds = files
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name)
                .sort(compareOrdinal);
            for (const caseId of runCaseIds) {
                if (!caseIds.includes(caseId))
                    errors.push(`${iteration}: unknown run case ${caseId}`);
                const outputFiles = readdirSync(
                    join(iterationRoot, caseId),
                ).sort(compareOrdinal);
                if (!equalSets(outputFiles, ["baseline.json", "pilot.json"]))
                    errors.push(
                        `${iteration}/${caseId}: run outputs changed`,
                    );
            }
            if (metadata.runs.length !== runCaseIds.length * 2)
                errors.push(`${iteration}: run metadata is incomplete`);
            if (grading.results.length !== runCaseIds.length * 2)
                errors.push(`${iteration}: grading results are incomplete`);
            for (const path of [metadataPath, gradingPath]) {
                const content = readFileSync(path, "utf8");
                if (
                    content.includes("/Volumes/") ||
                    content.includes("/Users/")
                )
                    errors.push(`${iteration}: local absolute path leaked`);
            }
            for (const caseId of runCaseIds) {
                for (const condition of ["baseline", "pilot"]) {
                    const path = join(
                        iterationRoot,
                        caseId,
                        `${condition}.json`,
                    );
                    const content = readFileSync(path, "utf8");
                    if (
                        content.includes("/Volumes/") ||
                        content.includes("/Users/")
                    )
                        errors.push(`${iteration}: local absolute path leaked`);
                }
            }
        }
    }

    const heldOutRunsRoot = join(root, evaluationRoot, "held-out-runs");
    if (!existsSync(heldOutRunsRoot))
        errors.push("Navigator held-out run evidence is missing");
    else {
        const passes = readdirSync(heldOutRunsRoot, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort(compareOrdinal);
        for (const pass of passes) {
            const passRoot = join(heldOutRunsRoot, pass);
            const entries = readdirSync(passRoot, { withFileTypes: true });
            const passFiles = entries
                .filter((entry) => entry.isFile())
                .map((entry) => entry.name)
                .sort(compareOrdinal);
            if (
                !equalSets(passFiles, [
                    "analysis.md",
                    "grading.json",
                    "metadata.json",
                ])
            )
                errors.push(`${pass}: held-out evidence root files changed`);
            const metadata = readCatalog(join(passRoot, "metadata.json"));
            const grading = readCatalog(join(passRoot, "grading.json"));
            const heldOutCaseIds = entries
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name)
                .sort(compareOrdinal);
            if (!equalSets(heldOutCaseIds, heldOut.map((item) => item.id)))
                errors.push(`${pass}: held-out cases are incomplete`);
            if (
                metadata.suite !== "held-out" ||
                metadata.runs.length !== heldOutCaseIds.length * 2
            )
                errors.push(`${pass}: held-out metadata is incomplete`);
            if (grading.results.length !== heldOutCaseIds.length * 2)
                errors.push(`${pass}: held-out grading is incomplete`);
            for (const path of [
                join(passRoot, "metadata.json"),
                join(passRoot, "grading.json"),
            ]) {
                const content = readFileSync(path, "utf8");
                if (
                    content.includes("/Volumes/") ||
                    content.includes("/Users/")
                )
                    errors.push(`${pass}: held-out local path leaked`);
            }
            for (const caseId of heldOutCaseIds) {
                const outputFiles = readdirSync(join(passRoot, caseId)).sort(
                    compareOrdinal,
                );
                if (!equalSets(outputFiles, ["baseline.json", "pilot.json"]))
                    errors.push(`${pass}/${caseId}: held-out outputs changed`);
                for (const outputFile of outputFiles) {
                    const content = readFileSync(
                        join(passRoot, caseId, outputFile),
                        "utf8",
                    );
                    if (
                        content.includes("/Volumes/") ||
                        content.includes("/Users/")
                    )
                        errors.push(`${pass}: held-out local path leaked`);
                }
            }
        }
    }
    return errors;
}
