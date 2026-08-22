// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { isIP } from "node:net";
import { join } from "node:path";
import { compareOrdinal } from "./catalog-ordering.mjs";
import {
    defaultRepositoryRoot,
    readCatalog,
} from "./catalog-validation.mjs";

const pilotRoot = "pilots/cratis-navigator";
const evaluationRoot = "evals/cratis-navigator";
const heldOutFreezeCommit = "e0e993f1ce269960f445fda4f3475556622e3a6d";
const heldOutFreezeDigest = "51992a32c4cf951bc77b9c331de3110809d89b4a2cd44f65906829897b60fa08";

const canonicalCaseIds = [
    "N01", "N02", "N03", "N04", "N05", "N06", "N07", "N08", "N09", "N10", "N11", "N12", "N13", "N14", "N15", "N16",
    "P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08", "P09", "P10", "P11", "P12",
];
const canonicalHeldOutIds = [
    "H01", "H02", "H03", "H04", "H05", "H06", "H07", "H08", "H09", "H10",
];
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
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (
        !left.every((value) => typeof value === "string") ||
        !right.every((value) => typeof value === "string")
    )
        return false;
    const sortedLeft = [...left].sort(compareOrdinal);
    const sortedRight = [...right].sort(compareOrdinal);
    return (
        sortedLeft.length === sortedRight.length &&
        sortedLeft.every((value, index) => value === sortedRight[index])
    );
}

export function containsLocalPath(content) {
    const decoded = content
        .replace(/\\u([0-9a-f]{4})/gi, (_, code) =>
            String.fromCharCode(Number.parseInt(code, 16)),
        )
        .replace(/\\\//g, "/");
    const windowsUnc = /(?:^|[\s"'`(){}\[\],;<>|])\\\\[^\\\s"'`<>]+\\[^\s"'`<>]+/.test(
        decoded,
    );
    const replaceRemote = (match, replacement, hasAuthority = false) => {
        const searchOffset = hasAuthority ? match.indexOf("//") + 2 : 0;
        const authorityBoundaryCandidates = hasAuthority
            ? ["/", "?", "#"]
                  .map((character) => match.indexOf(character, searchOffset))
                  .filter((index) => index >= 0)
            : [];
        const authorityEnd = hasAuthority
            ? authorityBoundaryCandidates.length > 0
                ? Math.min(...authorityBoundaryCandidates)
                : match.length
            : -1;
        const authorityText = hasAuthority
            ? match.slice(searchOffset, authorityEnd)
            : "";
        const openBracket = authorityText.indexOf("[");
        const closeBracket =
            openBracket < 0
                ? -1
                : authorityText.indexOf("]", openBracket + 1);
        const nestedOpenBracket =
            openBracket < 0
                ? -1
                : authorityText.indexOf("[", openBracket + 1);
        const bracketContent =
            openBracket >= 0 && closeBracket > openBracket
                ? authorityText.slice(openBracket + 1, closeBracket)
                : "";
        const trackAuthorityBrackets =
            openBracket >= 0 &&
            closeBracket > openBracket &&
            (nestedOpenBracket < 0 || nestedOpenBracket > closeBracket) &&
            isIP(bracketContent) === 6;
        const bracketStart = searchOffset + openBracket;
        const bracketEnd = searchOffset + closeBracket;
        for (let index = searchOffset; index < match.length; index++) {
            const character = match[index];
            const inAuthority = hasAuthority && index < authorityEnd;
            const insideBalancedAuthorityBracket =
                trackAuthorityBrackets &&
                inAuthority &&
                index >= bracketStart &&
                index <= bracketEnd;
            if (insideBalancedAuthorityBracket) continue;
            if (
                !"|;,)}]:".includes(character) ||
                (character === ":" && !inAuthority)
            )
                continue;
            const suffix = match.slice(index + 1);
            if (
                /^[\\/]/.test(suffix) ||
                /^[A-Za-z]:[\\/]/.test(suffix)
            )
                return `${replacement}${match.slice(index)}`;
        }
        return replacement;
    };
    const sanitized = decoded
        .replace(
            /<repository-root>(?:[\\/](?![\\/])[A-Za-z0-9._-]+)*/gi,
            "REDACTED_REPOSITORY_PATH",
        )
        .replace(
            /\b(?:https?|wss?|ftp):\/\/[^\s"'`<>]*/gi,
            (match) =>
                /^\w+:\/\/\//.test(match)
                    ? match
                    : replaceRemote(match, "REMOTE_URL", true),
        )
        .replace(/\/\/[^/\s"'`<>]+\/[^\s"'`<>]*/g, (match) =>
            replaceRemote(match, "REMOTE_URL", true),
        )
        .replace(/#\/[^\s"'`<>]*/g, (match) =>
            replaceRemote(match, "REMOTE_ROUTE"),
        );
    const normalized = sanitized
        .replace(/\\+/g, "/")
        .replace(/\/{3,}/g, "/")
        .toLowerCase();
    return (
        windowsUnc ||
        /(?:^|[^a-z0-9._/-])\/(?:$|[\s"'`<>])/.test(normalized) ||
        /(?:^|[^a-z0-9._/-])\/(?!\/)[^\s"'`<>]+/.test(normalized) ||
        /(?:^|[^a-z0-9])(?:[a-z]:\/)[^\s"'`<>]*/.test(normalized)
    );
}

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unknownProperties(value, allowed, label, errors) {
    for (const property of Object.keys(value)) {
        if (!allowed.includes(property))
            errors.push(`${label}: unknown property ${property}`);
    }
}

function requireExactProperties(value, required, label, errors) {
    if (!isPlainObject(value)) {
        errors.push(`${label}: must be a plain object`);
        return false;
    }
    unknownProperties(value, required, label, errors);
    if (!equalSets(Object.keys(value), required))
        errors.push(`${label}: required fields are incomplete`);
    return true;
}

function isRegularFile(path) {
    try {
        return existsSync(path) && lstatSync(path).isFile();
    } catch {
        return false;
    }
}

function readDirectorySafe(path, label, errors) {
    try {
        if (!existsSync(path) || !lstatSync(path).isDirectory()) {
            errors.push(`${label}: expected a directory`);
            return [];
        }
        return readdirSync(path, { withFileTypes: true });
    } catch (error) {
        errors.push(`${label}: cannot read directory (${error.message})`);
        return [];
    }
}

function readTextSafe(path, label, errors) {
    try {
        if (!isRegularFile(path)) {
            errors.push(`${label}: expected a regular file`);
            return null;
        }
        return readFileSync(path, "utf8");
    } catch (error) {
        errors.push(`${label}: cannot read file (${error.message})`);
        return null;
    }
}

function readBufferSafe(path, label, errors) {
    try {
        if (!isRegularFile(path)) {
            errors.push(`${label}: expected a regular file`);
            return Buffer.alloc(0);
        }
        return readFileSync(path);
    } catch (error) {
        errors.push(`${label}: cannot read file (${error.message})`);
        return Buffer.alloc(0);
    }
}

function readCatalogSafe(path, label, errors, fallback) {
    try {
        if (!isRegularFile(path)) {
            errors.push(`${label}: expected a regular file`);
            return fallback;
        }
        const value = readCatalog(path);
        if (!isPlainObject(value)) {
            errors.push(`${label}: expected a JSON object`);
            return fallback;
        }
        return value;
    } catch (error) {
        errors.push(`${label}: invalid JSON (${error.message})`);
        return fallback;
    }
}

function readJsonLines(path, label) {
    if (!isRegularFile(path))
        throw new Error(`${label} must be a regular file`);
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

function readJsonLinesSafe(path, label, errors) {
    const content = readTextSafe(path, label, errors);
    if (content === null) return [];
    const records = [];
    for (const [index, line] of content
        .split(/\r?\n/)
        .filter(Boolean)
        .entries()) {
        try {
            records.push(JSON.parse(line));
        } catch (error) {
            errors.push(`${label}: invalid JSON on line ${index + 1} (${error.message})`);
        }
    }
    return records;
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
    const metadata = readCatalogSafe(
        join(root, pilotRoot, "metadata.draft.json"),
        "navigator metadata",
        errors,
        { effects: [] },
    );
    const routeCatalog = readCatalogSafe(
        join(root, pilotRoot, "routes.draft.json"),
        "navigator routes",
        errors,
        { routes: [], catalogRevision: null },
    );
    const assertions = readCatalogSafe(
        join(root, evaluationRoot, "assertions.json"),
        "navigator assertions",
        errors,
        {
            outputFields: [],
            decisions: [],
            evidenceStates: [],
            repositoryProfiles: [],
            personas: [],
            requestedEffects: [],
            targetTrustValues: [],
        },
    );
    const targetsDocument = readCatalogSafe(
        join(root, "catalog/v2/targets.json"),
        "navigator targets",
        errors,
        { targets: [] },
    );
    const authoringDocument = readCatalogSafe(
        join(root, "catalog/v2/authoring-contracts.json"),
        "navigator authoring contracts",
        errors,
        { contracts: [] },
    );
    const targets = Array.isArray(targetsDocument.targets)
        ? targetsDocument.targets
        : [];
    const authoringContracts = Array.isArray(authoringDocument.contracts)
        ? authoringDocument.contracts.filter(isPlainObject)
        : [];
    const cases = readJsonLinesSafe(
        join(root, evaluationRoot, "cases.jsonl"),
        "Navigator canonical corpus",
        errors,
    );
    const heldOutPath = join(root, evaluationRoot, "held-out.jsonl");
    const heldOutBytes = readBufferSafe(
        heldOutPath,
        "Navigator held-out corpus bytes",
        errors,
    );
    const heldOut = readJsonLinesSafe(
        heldOutPath,
        "Navigator held-out corpus",
        errors,
    );
    const allCases = [...cases, ...heldOut];
    const targetById = new Map(
        targets.filter(isPlainObject).map((target) => [target.id, target]),
    );
    const routeRecords = Array.isArray(routeCatalog.routes)
        ? routeCatalog.routes.filter(isPlainObject)
        : [];
    const routeByKey = new Map(
        routeRecords.map((route) => [route.semanticKey, route]),
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
        !Array.isArray(metadata.effects) ||
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

    if (
        !Array.isArray(routeCatalog.routes) ||
        routeRecords.length !== routeCatalog.routes.length
    )
        errors.push("Navigator routes must be an array of objects");
    const routeKeys = routeRecords.map((route) =>
        typeof route.semanticKey === "string"
            ? route.semanticKey
            : "<invalid-route>",
    );
    for (const duplicate of duplicates(routeKeys))
        errors.push(`Duplicate navigator route ${duplicate}`);
    for (const route of routeRecords) {
        const routeKey =
            typeof route.semanticKey === "string"
                ? route.semanticKey
                : "<invalid-route>";
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(routeKey))
            errors.push(`Invalid navigator route key ${routeKey}`);
        if (
            route.evidenceState !== "absent" ||
            !Array.isArray(route.evidenceRefs) ||
            route.evidenceRefs.length > 0
        )
            errors.push(`${routeKey}: pilot route cannot claim evidence`);
        if (route.evidenceState !== "verified" && route.targetTrust !== "unknown")
            errors.push(
                `${routeKey}: unverified route trust must be unknown`,
            );
        if (route.approvalState === "approved")
            errors.push(`${routeKey}: pilot route cannot claim approval`);
        if (!Array.isArray(route.candidateTargetIds))
            errors.push(`${routeKey}: candidate targets must be an array`);
        for (const targetId of Array.isArray(route.candidateTargetIds)
            ? route.candidateTargetIds
            : []) {
            if (typeof targetId !== "string") {
                errors.push(`${routeKey}: target id must be a string`);
                continue;
            }
            const target = targetById.get(targetId);
            if (!target)
                errors.push(`${routeKey}: unknown target ${targetId}`);
            else if (
                target.audience !== "public" ||
                !isPlainObject(target.approval) ||
                target.approval.state !== "candidate" ||
                target.includeInRuntime
            )
                errors.push(`${routeKey}: target is not a public candidate`);
        }
    }

    if (!equalSets(assertions.outputFields, outputFields))
        errors.push("Navigator output fields changed");
    for (const duplicate of duplicates(
        Array.isArray(assertions.outputFields) ? assertions.outputFields : [],
    ))
        errors.push(`Duplicate navigator output field ${duplicate}`);

    const parsedCaseIds = cases
        .filter(isPlainObject)
        .map((testCase) => testCase.id);
    if (!equalSets(parsedCaseIds, canonicalCaseIds))
        errors.push("Navigator canonical case identifiers changed");
    const caseIds = [...canonicalCaseIds];
    for (const duplicate of duplicates(
        heldOut
            .filter(isPlainObject)
            .map((testCase) => testCase.prompt),
    ))
        errors.push(`Duplicate navigator held-out prompt ${duplicate}`);
    const allCaseIds = allCases
        .filter(isPlainObject)
        .map((testCase) => testCase.id);
    for (const duplicate of duplicates(allCaseIds))
        errors.push(`Duplicate navigator case ${duplicate}`);
    const positives = cases.filter(
        (testCase) => isPlainObject(testCase) && testCase.kind === "positive",
    );
    const negatives = cases.filter(
        (testCase) => isPlainObject(testCase) && testCase.kind === "negative",
    );
    if (positives.length !== 12 || negatives.length !== 16)
        errors.push("Navigator suite must contain 12 positive and 16 negative cases");
    if (heldOut.length !== 10)
        errors.push("Navigator held-out suite must contain 10 cases");
    const expectedHeldOutIds = [...canonicalHeldOutIds];
    if (
        !equalSets(
            heldOut.filter(isPlainObject).map((item) => item.id),
            expectedHeldOutIds,
        )
    )
        errors.push("Navigator held-out case identifiers changed");
    const canonicalPrompts = new Set(
        cases.filter(isPlainObject).map((testCase) => testCase.prompt),
    );
    for (const testCase of heldOut.filter(isPlainObject)) {
        if (canonicalPrompts.has(testCase.prompt))
            errors.push(`${testCase.id}: held-out prompt duplicates canonical input`);
    }
    for (const testCase of allCases) {
        if (!isPlainObject(testCase)) {
            errors.push("Navigator case must be a plain object");
            continue;
        }
        const heldOutRecord =
            typeof testCase.id === "string" && /^H\d{2}$/.test(testCase.id);
        const caseFields = heldOutRecord
            ? ["id", "prompt", "expected"]
            : ["id", "kind", "prompt", "expected"];
        unknownProperties(
            testCase,
            caseFields,
            testCase.id,
            errors,
        );
        if (!equalSets(Object.keys(testCase), caseFields))
            errors.push(`${testCase.id}: navigator case fields are incomplete`);
        if (
            typeof testCase.id !== "string" ||
            typeof testCase.prompt !== "string" ||
            testCase.prompt.length === 0 ||
            (!heldOutRecord &&
                !["negative", "positive"].includes(testCase.kind))
        )
            errors.push(`${testCase.id}: navigator case values are invalid`);
        if (!isPlainObject(testCase.expected)) {
            errors.push(`${testCase.id}: expected output must be a plain object`);
            continue;
        }
        unknownProperties(
            testCase.expected,
            outputFields,
            `${testCase.id} expected output`,
            errors,
        );
        if (!equalSets(Object.keys(testCase.expected), outputFields))
            errors.push(`${testCase.id}: expected output fields are incomplete`);
        if (
            !Array.isArray(assertions.decisions) ||
            !assertions.decisions.includes(testCase.expected.decision)
        )
            errors.push(`${testCase.id}: unknown decision`);
        if (
            !Array.isArray(assertions.evidenceStates) ||
            !assertions.evidenceStates.includes(testCase.expected.evidenceState)
        )
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
        if (
            !Array.isArray(testCase.expected.candidateRoutes) ||
            testCase.expected.candidateRoutes.length > metadata.maximumTargets
        )
            errors.push(`${testCase.id}: route collection is invalid`);
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
        for (const route of Array.isArray(testCase.expected.candidateRoutes)
            ? testCase.expected.candidateRoutes
            : []) {
            if (!routeByKey.has(route))
                errors.push(`${testCase.id}: unknown candidate route ${route}`);
        }
        if (!Array.isArray(testCase.expected.targetRefs))
            errors.push(`${testCase.id}: target references must be an array`);
        if (
            testCase.expected.evidenceState !== "verified" &&
            Array.isArray(testCase.expected.targetRefs) &&
            testCase.expected.targetRefs.length > 0
        )
            errors.push(`${testCase.id}: unverified case cannot emit target refs`);
        if (
            testCase.expected.evidenceState !== "verified" &&
            testCase.expected.targetTrust !== "unknown"
        )
            errors.push(`${testCase.id}: unverified case trust must be unknown`);
    }

    const pilotEntries = readDirectorySafe(
        join(root, pilotRoot),
        "Navigator pilot inventory",
        errors,
    );
    const pilotFiles = pilotEntries
        .map((entry) => entry.name)
        .sort(compareOrdinal);
    const evaluationEntries = readDirectorySafe(
        join(root, evaluationRoot),
        "Navigator evaluation inventory",
        errors,
    );
    const evaluationFiles = evaluationEntries
        .map((entry) => entry.name)
        .sort(compareOrdinal);
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
    if (pilotEntries.some((entry) => !entry.isFile()))
        errors.push("Navigator pilot inventory must contain regular files only");
    const evaluationFileNames = new Set([
        "assertions.json",
        "baseline.md",
        "cases.jsonl",
        "held-out.jsonl",
    ]);
    const evaluationDirectoryNames = new Set(["held-out-runs", "runs"]);
    if (
        evaluationEntries.some(
            (entry) =>
                (evaluationFileNames.has(entry.name) && !entry.isFile()) ||
                (evaluationDirectoryNames.has(entry.name) &&
                    !entry.isDirectory()),
        )
    )
        errors.push("Navigator evaluation inventory types changed");

    const runsRoot = join(root, evaluationRoot, "runs");
    const canonicalSelectionFields = [
        "schemaVersion",
        "catalogRevision",
        "selectedRuns",
    ];
    const canonicalSummaryFields = [
        "schemaVersion",
        "catalogRevision",
        "promotionState",
        "promotionBlockers",
        "selectedRuns",
        "safetyEvidence",
        "results",
        "summary",
    ];
    const canonicalMetadataFields = [
        "schemaVersion",
        "iteration",
        "model",
        "pilotCatalogRevision",
        "pilotContractCommit",
        "runDate",
        "conditions",
        "redactions",
        "runs",
    ];
    const canonicalRunFields = [
        "caseId",
        "condition",
        "agentId",
        "totalTokens",
        "durationMilliseconds",
    ];
    const canonicalRedactionFields = ["kind", "replacement", "files"];
    const gradingFields = [
        "schemaVersion",
        "iteration",
        "catalogRevision",
        "results",
        "safetyEvidence",
        "summary",
    ];
    const gradingResultFields = [
        "caseId",
        "condition",
        "decisionMatch",
        "exactMatch",
        "contractMatch",
        "structurallyValid",
        "mismatches",
        "contractMismatches",
        "observedOutputSafetyViolations",
    ];
    const gradingSafetyFields = ["state", "checked", "unverified"];
    const gradingSummaryFields = ["baseline", "pilot"];
    const gradingConditionFields = [
        "runs",
        "exactMatches",
        "contractMatches",
        "decisionMatches",
        "structurallyValid",
        "observedOutputSafetyViolations",
    ];
    const canonicalAggregateResultFields = [
        ...gradingResultFields,
        "runDirectory",
    ];
    const canonicalAggregateSafetyFields = ["state", "unverified"];
    const canonicalAggregateConditionFields = [
        ...gradingConditionFields,
        "totalTokens",
        "totalDurationMilliseconds",
    ];
    if (!existsSync(runsRoot)) errors.push("Navigator run evidence is missing");
    else {
        const runRootEntries = readDirectorySafe(
            runsRoot,
            "Navigator run inventory",
            errors,
        );
        const runRootFiles = runRootEntries
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name)
            .sort(compareOrdinal);
        const availableRunDirectories = new Set(
            runRootEntries
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name),
        );
        if (runRootEntries.some((entry) => !entry.isFile() && !entry.isDirectory()))
            errors.push("Navigator run inventory contains a non-regular entry");
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
        const selectedRunDirectories = new Set();
        if (existsSync(selectionPath) && !isRegularFile(selectionPath))
            errors.push("navigator canonical selection: expected a regular file");
        if (isRegularFile(selectionPath)) {
            const selectionDocument = readCatalogSafe(
                selectionPath,
                "navigator canonical selection",
                errors,
                {},
            );
            requireExactProperties(
                selectionDocument,
                canonicalSelectionFields,
                "navigator canonical selection",
                errors,
            );
            if (isPlainObject(selectionDocument.selectedRuns)) {
                for (const run of Object.values(selectionDocument.selectedRuns))
                    if (typeof run === "string") selectedRunDirectories.add(run);
            }
            const selectionContent = readTextSafe(
                selectionPath,
                "navigator canonical selection",
                errors,
            );
            if (selectionContent && containsLocalPath(selectionContent))
                errors.push("Navigator canonical summary leaked a local path");
        }
        if (existsSync(summaryPath) && !isRegularFile(summaryPath))
            errors.push("navigator canonical summary: expected a regular file");
        if (isRegularFile(summaryPath)) {
            requireExactProperties(
                readCatalogSafe(
                    summaryPath,
                    "navigator canonical summary",
                    errors,
                    {},
                ),
                canonicalSummaryFields,
                "navigator canonical summary",
                errors,
            );
            const summaryContent = readTextSafe(
                summaryPath,
                "navigator canonical summary",
                errors,
            );
            if (summaryContent && containsLocalPath(summaryContent))
                errors.push("Navigator canonical summary leaked a local path");
        }
        if (isRegularFile(selectionPath) && isRegularFile(summaryPath)) {
            const selection = readCatalogSafe(
                selectionPath,
                "navigator canonical selection",
                errors,
                {},
            );
            const summary = readCatalogSafe(
                summaryPath,
                "navigator canonical summary",
                errors,
                {},
            );
            if (isPlainObject(selection.selectedRuns)) {
                for (const run of Object.values(selection.selectedRuns))
                    if (typeof run === "string") selectedRunDirectories.add(run);
            }
            const selectionValid = requireExactProperties(
                selection,
                canonicalSelectionFields,
                "navigator canonical selection",
                errors,
            );
            const summaryValid = requireExactProperties(
                summary,
                canonicalSummaryFields,
                "navigator canonical summary",
                errors,
            );
            if (
                !selectionValid ||
                selection.schemaVersion !== 1 ||
                selection.catalogRevision !== routeCatalog.catalogRevision ||
                !isPlainObject(selection.selectedRuns) ||
                !equalSets(Object.keys(selection.selectedRuns), caseIds) ||
                !Object.values(selection.selectedRuns).every(
                    (run) =>
                        typeof run === "string" &&
                        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(run) &&
                        availableRunDirectories.has(run),
                )
            )
                errors.push("Navigator canonical selection is incomplete");
            if (summaryValid) {
                const selectedRunsValid =
                    isPlainObject(summary.selectedRuns) &&
                    equalSets(Object.keys(summary.selectedRuns), caseIds) &&
                    Object.values(summary.selectedRuns).every(
                        (run) =>
                            typeof run === "string" &&
                            /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(run) &&
                            availableRunDirectories.has(run),
                    );
                const safetyValid = requireExactProperties(
                    summary.safetyEvidence,
                    canonicalAggregateSafetyFields,
                    "navigator canonical safety evidence",
                    errors,
                );
                const gradingSummaryValid = requireExactProperties(
                    summary.summary,
                    gradingSummaryFields,
                    "navigator canonical grading summary",
                    errors,
                );
                if (gradingSummaryValid) {
                    for (const condition of gradingSummaryFields)
                        requireExactProperties(
                            summary.summary[condition],
                            canonicalAggregateConditionFields,
                            `navigator canonical ${condition} summary`,
                            errors,
                        );
                }
                const resultsValid =
                    Array.isArray(summary.results) &&
                    summary.results.length === caseIds.length * 2;
                if (Array.isArray(summary.results)) {
                    for (const result of summary.results)
                        requireExactProperties(
                            result,
                            canonicalAggregateResultFields,
                            "navigator canonical result",
                            errors,
                        );
                }
                if (
                    summary.schemaVersion !== 1 ||
                    summary.catalogRevision !== routeCatalog.catalogRevision ||
                    !selectedRunsValid ||
                    !safetyValid ||
                    !Array.isArray(summary.safetyEvidence?.unverified) ||
                    !resultsValid ||
                    !Array.isArray(summary.promotionBlockers) ||
                    summary.promotionBlockers.length === 0 ||
                    summary.promotionState !== "blocked" ||
                    summary.summary?.pilot?.runs !== caseIds.length ||
                    summary.summary?.baseline?.runs !== caseIds.length
                )
                    errors.push("Navigator canonical summary overstates its scope");
            }
            for (const path of [selectionPath, summaryPath]) {
                const content = readTextSafe(
                    path,
                    "Navigator canonical summary evidence",
                    errors,
                );
                if (content && containsLocalPath(content))
                    errors.push("Navigator canonical summary leaked a local path");
            }
        }
        const iterationDirectories = runRootEntries
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort(compareOrdinal);
        for (const iteration of iterationDirectories) {
            const iterationRoot = join(runsRoot, iteration);
            const files = readDirectorySafe(
                iterationRoot,
                `${iteration} run inventory`,
                errors,
            );
            const rootFiles = files
                .filter((entry) => entry.isFile())
                .map((entry) => entry.name)
                .sort(compareOrdinal);
            if (files.some((entry) => !entry.isFile() && !entry.isDirectory()))
                errors.push(`${iteration}: run inventory contains a non-regular entry`);
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
            const metadataExists = isRegularFile(metadataPath);
            const gradingExists = isRegularFile(gradingPath);
            const metadata = metadataExists
                ? readCatalogSafe(
                      metadataPath,
                      `${iteration} metadata`,
                      errors,
                      {},
                  )
                : null;
            const grading = gradingExists
                ? readCatalogSafe(
                      gradingPath,
                      `${iteration} grading`,
                      errors,
                      {},
                  )
                : null;
            const metadataValid =
                metadataExists &&
                requireExactProperties(
                    metadata,
                    canonicalMetadataFields,
                    `${iteration} metadata`,
                    errors,
                );
            const gradingValid =
                gradingExists &&
                requireExactProperties(
                    grading,
                    gradingFields,
                    `${iteration} grading`,
                    errors,
                );
            const runCaseIds = files
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name)
                .sort(compareOrdinal);
            for (const caseId of runCaseIds) {
                if (!caseIds.includes(caseId)) {
                    errors.push(`${iteration}: unknown run case ${caseId}`);
                    continue;
                }
                const outputFiles = readDirectorySafe(
                    join(iterationRoot, caseId),
                    `${iteration}/${caseId} output inventory`,
                    errors,
                )
                    .map((entry) => entry.name)
                    .sort(compareOrdinal);
                if (!equalSets(outputFiles, ["baseline.json", "pilot.json"]))
                    errors.push(
                        `${iteration}/${caseId}: run outputs changed`,
                    );
            }
            const validRunCaseIds = runCaseIds.filter((caseId) =>
                caseIds.includes(caseId),
            );
            const expectedRunKeys = validRunCaseIds.flatMap((caseId) => [
                `${caseId}:baseline`,
                `${caseId}:pilot`,
            ]);
            if (
                selectedRunDirectories.has(iteration) &&
                metadataValid &&
                metadata.pilotCatalogRevision !== routeCatalog.catalogRevision
            )
                errors.push(`${iteration}: selected metadata revision changed`);
            if (metadataValid) {
                const runs = Array.isArray(metadata.runs) ? metadata.runs : [];
                const runKeys = runs.map((run) =>
                    isPlainObject(run)
                        ? `${run.caseId}:${run.condition}`
                        : "<invalid-run>",
                );
                if (
                    runs.length !== validRunCaseIds.length * 2 ||
                    !equalSets(runKeys, expectedRunKeys) ||
                    runKeys.length !== new Set(runKeys).size ||
                    !Array.isArray(metadata.conditions) ||
                    !equalSets(metadata.conditions, ["baseline", "pilot"]) ||
                    !Array.isArray(metadata.redactions)
                )
                    errors.push(`${iteration}: run metadata is incomplete`);
                for (const run of runs) {
                    if (
                        requireExactProperties(
                            run,
                            canonicalRunFields,
                            `${iteration} run`,
                            errors,
                        ) &&
                        (!validRunCaseIds.includes(run.caseId) ||
                            !["baseline", "pilot"].includes(run.condition) ||
                            typeof run.agentId !== "string" ||
                            run.agentId.length === 0 ||
                            !Number.isSafeInteger(run.totalTokens) ||
                            run.totalTokens < 1 ||
                            !Number.isSafeInteger(run.durationMilliseconds) ||
                            run.durationMilliseconds < 1)
                    )
                        errors.push(`${iteration}: run timing is invalid`);
                }
                for (const redaction of Array.isArray(metadata.redactions)
                    ? metadata.redactions
                    : []) {
                    if (
                        requireExactProperties(
                            redaction,
                            canonicalRedactionFields,
                            `${iteration} redaction`,
                            errors,
                        ) &&
                        (typeof redaction.kind !== "string" ||
                            redaction.kind.length === 0 ||
                            typeof redaction.replacement !== "string" ||
                            redaction.replacement.length === 0 ||
                            !Array.isArray(redaction.files) ||
                            redaction.files.some(
                                (file) =>
                                    typeof file !== "string" ||
                                    file.length === 0,
                            ) ||
                            redaction.files.length !==
                                new Set(redaction.files).size)
                    )
                        errors.push(`${iteration}: redaction values are invalid`);
                }
            }
            if (
                selectedRunDirectories.has(iteration) &&
                gradingValid &&
                grading.catalogRevision !== routeCatalog.catalogRevision
            )
                errors.push(`${iteration}: selected grading revision changed`);
            if (gradingValid) {
                const results = Array.isArray(grading.results)
                    ? grading.results
                    : [];
                const resultKeys = results.map((result) =>
                    isPlainObject(result)
                        ? `${result.caseId}:${result.condition}`
                        : "<invalid-result>",
                );
                if (
                    results.length !== validRunCaseIds.length * 2 ||
                    !equalSets(resultKeys, expectedRunKeys) ||
                    resultKeys.length !== new Set(resultKeys).size
                )
                    errors.push(`${iteration}: grading results are incomplete`);
                for (const result of results)
                    requireExactProperties(
                        result,
                        gradingResultFields,
                        `${iteration} grading result`,
                        errors,
                    );
                requireExactProperties(
                    grading.safetyEvidence,
                    gradingSafetyFields,
                    `${iteration} safety evidence`,
                    errors,
                );
                if (
                    requireExactProperties(
                        grading.summary,
                        gradingSummaryFields,
                        `${iteration} grading summary`,
                        errors,
                    )
                ) {
                    for (const condition of gradingSummaryFields)
                        requireExactProperties(
                            grading.summary[condition],
                            gradingConditionFields,
                            `${iteration} ${condition} summary`,
                            errors,
                        );
                }
            }
            const analysisPath = join(iterationRoot, "analysis.md");
            for (const path of [metadataPath, gradingPath, analysisPath].filter(
                isRegularFile,
            )) {
                const content = readTextSafe(
                    path,
                    `${iteration} evidence`,
                    errors,
                );
                if (content && containsLocalPath(content))
                    errors.push(`${iteration}: local absolute path leaked`);
            }
            for (const caseId of validRunCaseIds) {
                for (const condition of ["baseline", "pilot"]) {
                    const path = join(
                        iterationRoot,
                        caseId,
                        `${condition}.json`,
                    );
                    if (!existsSync(path) || !lstatSync(path).isFile()) {
                        errors.push(`${iteration}/${caseId}: missing ${condition} output`);
                        continue;
                    }
                    const content = readTextSafe(
                        path,
                        `${iteration}/${caseId}/${condition} output`,
                        errors,
                    );
                    if (content && containsLocalPath(content))
                        errors.push(`${iteration}: local absolute path leaked`);
                    const output = readCatalogSafe(
                        path,
                        `${iteration}/${caseId}/${condition} output`,
                        errors,
                        {},
                    );
                    requireExactProperties(
                        output,
                        outputFields,
                        `${iteration}/${caseId}/${condition} output`,
                        errors,
                    );
                }
            }
        }
    }

    const heldOutRunsRoot = join(root, evaluationRoot, "held-out-runs");
    if (!existsSync(heldOutRunsRoot))
        errors.push("Navigator held-out run evidence is missing");
    else {
        const heldOutRunEntries = readDirectorySafe(
            heldOutRunsRoot,
            "Navigator held-out run inventory",
            errors,
        );
        const directFiles = heldOutRunEntries.filter((entry) => entry.isFile());
        if (directFiles.length > 0)
            errors.push("Navigator held-out run root contains unexpected files");
        const passes = heldOutRunEntries
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort(compareOrdinal);
        if (
            !equalSets(passes, ["pass-1"]) ||
            heldOutRunEntries.some((entry) => !entry.isDirectory())
        )
            errors.push("Navigator held-out pass inventory changed");
        const metadataFields = [
            "schemaVersion",
            "iteration",
            "suite",
            "model",
            "pilotCatalogRevision",
            "pilotContractCommit",
            "heldOutContractCommit",
            "heldOutDigest",
            "runDate",
            "conditions",
            "redactions",
            "runs",
        ];
        const runFields = [
            "caseId",
            "condition",
            "agentId",
            "totalTokens",
            "durationMilliseconds",
        ];
        const redactionFields = ["kind", "replacement", "files"];
        const gradingFields = [
            "schemaVersion",
            "iteration",
            "catalogRevision",
            "results",
            "safetyEvidence",
            "summary",
        ];
        const gradingResultFields = [
            "caseId",
            "condition",
            "decisionMatch",
            "exactMatch",
            "contractMatch",
            "structurallyValid",
            "mismatches",
            "contractMismatches",
            "observedOutputSafetyViolations",
        ];
        const safetyEvidenceFields = ["state", "checked", "unverified"];
        const gradingSummaryFields = ["baseline", "pilot"];
        const conditionSummaryFields = [
            "runs",
            "exactMatches",
            "contractMatches",
            "decisionMatches",
            "structurallyValid",
            "observedOutputSafetyViolations",
        ];
        for (const pass of passes) {
            const passRoot = join(heldOutRunsRoot, pass);
            const entries = readDirectorySafe(
                passRoot,
                `${pass} held-out inventory`,
                errors,
            );
            const passFiles = entries
                .filter((entry) => entry.isFile())
                .map((entry) => entry.name)
                .sort(compareOrdinal);
            if (entries.some((entry) => !entry.isFile() && !entry.isDirectory()))
                errors.push(`${pass}: held-out inventory contains a non-regular entry`);
            if (
                !equalSets(passFiles, [
                    "analysis.md",
                    "grading.json",
                    "metadata.json",
                ])
            )
                errors.push(`${pass}: held-out evidence root files changed`);
            const metadataPath = join(passRoot, "metadata.json");
            const gradingPath = join(passRoot, "grading.json");
            const analysisPath = join(passRoot, "analysis.md");
            const metadataExists = isRegularFile(metadataPath);
            const gradingExists = isRegularFile(gradingPath);
            const metadata = metadataExists
                ? readCatalogSafe(
                      metadataPath,
                      `${pass} metadata`,
                      errors,
                      {},
                  )
                : null;
            const grading = gradingExists
                ? readCatalogSafe(
                      gradingPath,
                      `${pass} grading`,
                      errors,
                      {},
                  )
                : null;
            const metadataValid =
                metadataExists &&
                requireExactProperties(
                    metadata,
                    metadataFields,
                    `${pass} metadata`,
                    errors,
                );
            const gradingValid =
                gradingExists &&
                requireExactProperties(
                    grading,
                    gradingFields,
                    `${pass} grading`,
                    errors,
                );
            const heldOutCaseIds = entries
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name)
                .sort(compareOrdinal);
            const expectedRunKeys = canonicalHeldOutIds.flatMap((caseId) => [
                `${caseId}:baseline`,
                `${caseId}:pilot`,
            ]);
            const expectedHeldOutCaseIds = [...canonicalHeldOutIds];
            if (!equalSets(heldOutCaseIds, expectedHeldOutCaseIds))
                errors.push(`${pass}: held-out cases are incomplete`);

            if (metadataValid) {
                if (
                    metadata.schemaVersion !== 1 ||
                    metadata.pilotCatalogRevision !== routeCatalog.catalogRevision ||
                    metadata.heldOutContractCommit !== heldOutFreezeCommit ||
                    metadata.heldOutDigest !== heldOutFreezeDigest
                ) {
                    errors.push(`${pass}: held-out freeze binding changed`);
                } else {
                    try {
                        const frozenBytes = execFileSync(
                            "git",
                            [
                                "-C",
                                defaultRepositoryRoot,
                                "show",
                                `${heldOutFreezeCommit}:${evaluationRoot}/held-out.jsonl`,
                            ],
                            { encoding: "buffer" },
                        );
                        if (
                            !frozenBytes.equals(heldOutBytes) ||
                            sha256(frozenBytes) !== metadata.heldOutDigest ||
                            sha256(heldOutBytes) !== metadata.heldOutDigest
                        )
                            errors.push(`${pass}: held-out corpus differs from its freeze binding`);
                    } catch {
                        errors.push(`${pass}: held-out freeze commit is not readable`);
                    }
                }
                const metadataRuns = Array.isArray(metadata.runs)
                    ? metadata.runs
                    : [];
                const metadataRunKeys = metadataRuns.map((run) =>
                    isPlainObject(run)
                        ? `${run.caseId}:${run.condition}`
                        : "<invalid-run>",
                );
                if (
                    metadata.suite !== "held-out" ||
                    !Array.isArray(metadata.conditions) ||
                    !equalSets(metadata.conditions, ["baseline", "pilot"]) ||
                    !Array.isArray(metadata.redactions) ||
                    !equalSets(metadataRunKeys, expectedRunKeys) ||
                    metadataRunKeys.length !== new Set(metadataRunKeys).size
                )
                    errors.push(`${pass}: held-out metadata is incomplete`);
                for (const run of metadataRuns) {
                    if (!requireExactProperties(run, runFields, `${pass} run`, errors))
                        continue;
                    if (
                        !Number.isSafeInteger(run.totalTokens) ||
                        run.totalTokens < 1 ||
                        !Number.isSafeInteger(run.durationMilliseconds) ||
                        run.durationMilliseconds < 1
                    )
                        errors.push(`${pass}: held-out timing is invalid`);
                }
                for (const redaction of Array.isArray(metadata.redactions)
                    ? metadata.redactions
                    : []) {
                    if (
                        requireExactProperties(
                            redaction,
                            redactionFields,
                            `${pass} redaction`,
                            errors,
                        ) &&
                        (typeof redaction.kind !== "string" ||
                            redaction.kind.length === 0 ||
                            typeof redaction.replacement !== "string" ||
                            redaction.replacement.length === 0 ||
                            !Array.isArray(redaction.files) ||
                            redaction.files.some(
                                (file) =>
                                    typeof file !== "string" ||
                                    file.length === 0,
                            ) ||
                            redaction.files.length !==
                                new Set(redaction.files).size)
                    )
                        errors.push(`${pass}: redaction values are invalid`);
                }
            }

            if (gradingValid) {
                if (
                    grading.schemaVersion !== 1 ||
                    grading.catalogRevision !== routeCatalog.catalogRevision
                )
                    errors.push(`${pass}: held-out grading revision changed`);
                const gradingResults = Array.isArray(grading.results)
                    ? grading.results
                    : [];
                const gradingRunKeys = gradingResults.map((result) =>
                    isPlainObject(result)
                        ? `${result.caseId}:${result.condition}`
                        : "<invalid-result>",
                );
                if (
                    !equalSets(gradingRunKeys, expectedRunKeys) ||
                    gradingRunKeys.length !== new Set(gradingRunKeys).size
                )
                    errors.push(`${pass}: held-out grading is incomplete`);
                for (const result of gradingResults)
                    requireExactProperties(
                        result,
                        gradingResultFields,
                        `${pass} grading result`,
                        errors,
                    );
                requireExactProperties(
                    grading.safetyEvidence,
                    safetyEvidenceFields,
                    `${pass} safety evidence`,
                    errors,
                );
                if (
                    requireExactProperties(
                        grading.summary,
                        gradingSummaryFields,
                        `${pass} grading summary`,
                        errors,
                    )
                ) {
                    for (const condition of gradingSummaryFields)
                        requireExactProperties(
                            grading.summary[condition],
                            conditionSummaryFields,
                            `${pass} ${condition} summary`,
                            errors,
                        );
                }
            }
            for (const path of [metadataPath, gradingPath, analysisPath].filter(
                isRegularFile,
            )) {
                const content = readTextSafe(
                    path,
                    `${pass} evidence`,
                    errors,
                );
                if (content && containsLocalPath(content))
                    errors.push(`${pass}: held-out local path leaked`);
            }
            for (const caseId of heldOutCaseIds.filter((caseId) =>
                expectedHeldOutCaseIds.includes(caseId),
            )) {
                const caseRoot = join(passRoot, caseId);
                const outputEntries = readDirectorySafe(
                    caseRoot,
                    `${pass}/${caseId} held-out output inventory`,
                    errors,
                );
                const outputFiles = outputEntries
                    .map((entry) => entry.name)
                    .sort(compareOrdinal);
                if (
                    !equalSets(outputFiles, ["baseline.json", "pilot.json"]) ||
                    outputEntries.some((entry) => !entry.isFile())
                )
                    errors.push(`${pass}/${caseId}: held-out outputs changed`);
                for (const outputFile of ["baseline.json", "pilot.json"]) {
                    const path = join(caseRoot, outputFile);
                    const entry = outputEntries.find(
                        (candidate) => candidate.name === outputFile,
                    );
                    if (!entry?.isFile()) {
                        errors.push(`${pass}/${caseId}: missing ${outputFile}`);
                        continue;
                    }
                    const content = readTextSafe(
                        path,
                        `${pass}/${caseId}/${outputFile} output`,
                        errors,
                    );
                    if (content && containsLocalPath(content))
                        errors.push(`${pass}: held-out local path leaked`);
                    const output = readCatalogSafe(
                        path,
                        `${pass}/${caseId}/${outputFile} output`,
                        errors,
                        {},
                    );
                    requireExactProperties(
                        output,
                        outputFields,
                        `${pass}/${caseId}/${outputFile} output`,
                        errors,
                    );
                }
            }
        }
    }
    return errors;
}
