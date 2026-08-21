// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync, readdirSync } from "node:fs";
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

export function readNavigatorCases(root = defaultRepositoryRoot) {
    const path = join(root, evaluationRoot, "cases.jsonl");
    return readFileSync(path, "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line, index) => {
            try {
                return JSON.parse(line);
            } catch (error) {
                throw new Error(`Invalid navigator case JSON on line ${index + 1}`, {
                    cause: error,
                });
            }
        });
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
    for (const duplicate of duplicates(caseIds))
        errors.push(`Duplicate navigator case ${duplicate}`);
    const positives = cases.filter((testCase) => testCase.kind === "positive");
    const negatives = cases.filter((testCase) => testCase.kind === "negative");
    if (positives.length !== 12 || negatives.length !== 16)
        errors.push("Navigator suite must contain 12 positive and 16 negative cases");
    for (const testCase of cases) {
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
    }

    const pilotFiles = readdirSync(join(root, pilotRoot)).sort(compareOrdinal);
    const evaluationFiles = readdirSync(join(root, evaluationRoot)).sort(
        compareOrdinal,
    );
    if (
        !equalSets(pilotFiles, ["PILOT.md", "metadata.draft.json", "routes.draft.json"])
    )
        errors.push("Navigator pilot source inventory changed");
    if (!equalSets(evaluationFiles, ["assertions.json", "baseline.md", "cases.jsonl"]))
        errors.push("Navigator evaluation inventory changed");
    return errors;
}
