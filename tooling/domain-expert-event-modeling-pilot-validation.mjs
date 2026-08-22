#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);
const pilotRoot = "pilots/domain-expert-event-modeling";
const evaluationRoot = "evals/domain-expert-event-modeling";
const caseIds = ["N01", "N02", "N03", "N04", "N05", "P01", "P02", "P03", "P04"];
const outcomes = [
    "MODEL_DRAFT",
    "QUESTIONS_REQUIRED",
    "INCONCLUSIVE",
    "BLOCKED",
    "SKIPPED",
    "REFUSED",
];
const reasonCodes = {
    MODEL_DRAFT: [
        "INFORMATION_COMPLETE_FOR_OWNER_REVIEW",
        "REACTIONS_CLASSIFIED_FOR_OWNER_REVIEW",
    ],
    QUESTIONS_REQUIRED: ["TRACEABILITY_GAPS", "COMPLIANCE_BOUNDARY_UNSETTLED"],
    INCONCLUSIVE: ["CONFLICTING_DOMAIN_EVIDENCE"],
    BLOCKED: ["INVALID_INPUT_BINDING"],
    SKIPPED: ["DIAGRAM_CAPABILITY_REQUIRED"],
    REFUSED: ["EXECUTION_OR_MUTATION_REQUEST", "THIRD_PARTY_COPY_REQUEST"],
};
const requiredLimitations = [
    "SYNTHETIC_INPUT_ONLY",
    "OWNER_REVIEW_REQUIRED",
    "NO_PRODUCT_SOURCE_AUTHORITY",
    "NO_RUNTIME_OR_EFFECTS",
    "NOT_IMPLEMENTATION_READY",
];
const packetFields = [
    "schemaVersion",
    "caseId",
    "goal",
    "actors",
    "narrative",
    "candidateTerms",
    "scenarios",
    "constraints",
    "acceptedModelStatus",
];
const caseFields = [
    "id",
    "kind",
    "enabled",
    "prompt",
    "input",
    "inputSha256",
    "expected",
];
const resultFields = [
    "schemaVersion",
    "pilotId",
    "evaluatedCaseId",
    "inputBinding",
    "outcome",
    "outcomeReasonCode",
    "modelStatus",
    "glossary",
    "streams",
    "commands",
    "facts",
    "stateViews",
    "reactions",
    "scenarios",
    "gaps",
    "questions",
    "handoff",
    "limitations",
    "safetyEvidence",
];
const contractDigests = {
    "PILOT.md":
        "5209525af130af8af8c89a6a676dfc3a8e146398bfb6464d1844426f5cdba2ff",
    "metadata.draft.json":
        "c854616566525106a16a851b6a6bc3b230e3c14a77b219c512861e6f496cef31",
    "result-contract.json":
        "93722ae988f22deffede65739c1c04eef3153f3c678774cb932d53dde322c936",
    "../evals/domain-expert-event-modeling/assertions.json":
        "10c2c4c9fac3ebf49716d3e67a00ebdbee2fc7f660ec0a66e579985039096b7d",
};
const casesDigest =
    "b4ae891f768a915324b53413a64023bbb664744c58cd2272aa8bced9b0dc153e";

function compareCodePoints(left, right) {
    const a = Array.from(left, (value) => value.codePointAt(0));
    const b = Array.from(right, (value) => value.codePointAt(0));
    for (let index = 0; index < Math.min(a.length, b.length); index++)
        if (a[index] !== b[index]) return a[index] - b[index];
    return a.length - b.length;
}

function renderCanonical(value, depth = 0) {
    const indentation = "  ".repeat(depth);
    const childIndentation = "  ".repeat(depth + 1);
    if (Array.isArray(value)) {
        if (value.length === 0) return "[]";
        return `[\n${value.map((item) => `${childIndentation}${renderCanonical(item, depth + 1)}`).join(",\n")}\n${indentation}]`;
    }
    if (value && typeof value === "object") {
        const keys = Object.keys(value).sort(compareCodePoints);
        if (keys.length === 0) return "{}";
        return `{\n${keys.map((key) => `${childIndentation}${JSON.stringify(key)}: ${renderCanonical(value[key], depth + 1)}`).join(",\n")}\n${indentation}}`;
    }
    return JSON.stringify(value);
}

export function canonicalizeEventModelingJson(value) {
    return `${renderCanonical(value)}\n`;
}

export function sha256EventModelingJson(value) {
    return createHash("sha256")
        .update(canonicalizeEventModelingJson(value))
        .digest("hex");
}

function sha256(value) {
    return createHash("sha256").update(value).digest("hex");
}

function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
    return (
        isRecord(value) &&
        JSON.stringify(Object.keys(value).sort(compareCodePoints)) ===
            JSON.stringify([...keys].sort(compareCodePoints))
    );
}

function safePath(path) {
    return (
        typeof path === "string" &&
        !isAbsolute(path) &&
        !path.includes("\\") &&
        path
            .split("/")
            .every((segment) => segment && segment !== "." && segment !== "..")
    );
}

function readContained(repositoryRoot, relativePath, maximumBytes, errors) {
    try {
        if (!safePath(relativePath)) throw new Error("unsafe path");
        const root = realpathSync(repositoryRoot);
        const path = join(root, relativePath);
        const stat = lstatSync(path);
        if (!stat.isFile() || stat.size > maximumBytes)
            throw new Error("regular bounded file required");
        const real = realpathSync(path);
        const fromRoot = relative(root, real);
        if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot))
            throw new Error("path escape");
        return readFileSync(real, "utf8");
    } catch {
        errors.push(`${relativePath}: unreadable bounded file`);
        return null;
    }
}

function readJson(repositoryRoot, relativePath, maximumBytes, errors) {
    const content = readContained(
        repositoryRoot,
        relativePath,
        maximumBytes,
        errors,
    );
    if (content === null) return null;
    try {
        const value = JSON.parse(content);
        if (content !== canonicalizeEventModelingJson(value))
            errors.push(`${relativePath}: noncanonical bytes`);
        return { value, content };
    } catch {
        errors.push(`${relativePath}: invalid JSON`);
        return null;
    }
}

function inventory(repositoryRoot, relativePath, expected, errors) {
    try {
        const root = realpathSync(repositoryRoot);
        const real = realpathSync(join(root, relativePath));
        const fromRoot = relative(root, real);
        if (fromRoot.startsWith("..") || isAbsolute(fromRoot))
            throw new Error("path escape");
        const entries = readdirSync(real, { withFileTypes: true });
        const names = entries
            .map((entry) => entry.name)
            .sort(compareCodePoints);
        if (
            JSON.stringify(names) !==
                JSON.stringify([...expected].sort(compareCodePoints)) ||
            entries.some((entry) => !entry.isFile())
        )
            errors.push(`${relativePath}: inventory changed`);
    } catch {
        errors.push(`${relativePath}: inventory unavailable`);
    }
}

function parseCases(repositoryRoot, errors) {
    const relativePath = `${evaluationRoot}/cases.jsonl`;
    const content = readContained(
        repositoryRoot,
        relativePath,
        1048576,
        errors,
    );
    if (content === null) return [];
    if (sha256(content) !== casesDigest) errors.push("CASES_DIGEST");
    const rows = [];
    for (const [index, line] of content
        .split(/\r?\n/)
        .filter(Boolean)
        .entries()) {
        try {
            rows.push(JSON.parse(line));
        } catch {
            errors.push(`${relativePath}:${index + 1}: invalid JSON`);
        }
    }
    return rows;
}

function allUniqueStrings(values) {
    return (
        Array.isArray(values) &&
        values.every(
            (value) => typeof value === "string" && value.length > 0,
        ) &&
        new Set(values).size === values.length
    );
}

function validatePacket(testCase, errors) {
    if (testCase.input === null) {
        if (testCase.id !== "N03" || testCase.inputSha256 !== null)
            errors.push(`${testCase.id}:INPUT_BINDING`);
        return;
    }
    const packet = testCase.input;
    if (
        !exactKeys(packet, packetFields) ||
        packet.schemaVersion !== "1.0.0" ||
        packet.caseId !== testCase.id ||
        typeof packet.goal !== "string" ||
        !allUniqueStrings(packet.actors) ||
        typeof packet.narrative !== "string" ||
        !Array.isArray(packet.candidateTerms) ||
        !Array.isArray(packet.scenarios) ||
        !allUniqueStrings(packet.constraints) ||
        !["UNSETTLED", "ACCEPTED"].includes(packet.acceptedModelStatus)
    )
        errors.push(`${testCase.id}:INPUT_FIELDS`);
    if (sha256EventModelingJson(packet) !== testCase.inputSha256)
        errors.push(`${testCase.id}:INPUT_BINDING`);
}

function ids(records) {
    return new Set(
        Array.isArray(records)
            ? records.filter(isRecord).map((record) => record.id)
            : [],
    );
}

export function validateEventModelingExpected(testCase) {
    const errors = [];
    if (!isRecord(testCase) || typeof testCase.id !== "string")
        return ["CASE_FIELDS"];
    const expected = testCase.expected;
    if (!exactKeys(expected, resultFields))
        return [`${testCase.id}:RESULT_FIELDS`];
    if (
        expected.schemaVersion !== "1.0.0" ||
        expected.pilotId !== "domain-expert-event-modeling" ||
        expected.evaluatedCaseId !== testCase.id ||
        !exactKeys(expected.inputBinding, ["inputSha256"]) ||
        expected.inputBinding.inputSha256 !== testCase.inputSha256
    )
        errors.push(`${testCase.id}:RESULT_BINDING`);
    if (
        !outcomes.includes(expected.outcome) ||
        !reasonCodes[expected.outcome]?.includes(expected.outcomeReasonCode)
    )
        errors.push(`${testCase.id}:OUTCOME`);
    if (
        !Array.isArray(expected.limitations) ||
        !requiredLimitations.every((code) =>
            expected.limitations.includes(code),
        )
    )
        errors.push(`${testCase.id}:LIMITATIONS`);
    const collections = [
        "glossary",
        "streams",
        "commands",
        "facts",
        "stateViews",
        "reactions",
        "scenarios",
        "gaps",
        "questions",
    ];
    if (
        collections.some(
            (field) =>
                !Array.isArray(expected[field]) || expected[field].length > 32,
        )
    )
        errors.push(`${testCase.id}:MODEL_COLLECTIONS`);
    const model = Object.fromEntries(
        collections.map((field) => [
            field,
            Array.isArray(expected[field]) ? expected[field] : [],
        ]),
    );
    if (
        !exactKeys(expected.safetyEvidence, ["scope", "observedEffectCodes"]) ||
        expected.safetyEvidence.scope !== "PERSISTED_OUTPUT_ONLY" ||
        !Array.isArray(expected.safetyEvidence.observedEffectCodes) ||
        expected.safetyEvidence.observedEffectCodes.length !== 0
    )
        errors.push(`${testCase.id}:SAFETY`);

    const draftOutcome = [
        "MODEL_DRAFT",
        "QUESTIONS_REQUIRED",
        "INCONCLUSIVE",
    ].includes(expected.outcome);
    if (
        (draftOutcome && expected.modelStatus !== "DRAFT") ||
        (!draftOutcome && expected.modelStatus !== "NOT_PRODUCED")
    )
        errors.push(`${testCase.id}:MODEL_STATUS`);
    if (
        expected.outcome === "MODEL_DRAFT" &&
        expected.handoff !== "OWNER_REVIEW"
    )
        errors.push(`${testCase.id}:HANDOFF`);
    if (
        expected.outcome === "QUESTIONS_REQUIRED" &&
        (expected.handoff !== "OWNER_INPUT" ||
            model.questions.length === 0 ||
            model.gaps.length === 0)
    )
        errors.push(`${testCase.id}:QUESTIONS`);
    if (
        expected.outcome === "INCONCLUSIVE" &&
        (expected.handoff !== "DOMAIN_RECONCILIATION" ||
            model.questions.length === 0)
    )
        errors.push(`${testCase.id}:QUESTIONS`);
    if (
        expected.outcome === "SKIPPED" &&
        expected.handoff !== "EVENT_MODEL_DIAGRAM"
    )
        errors.push(`${testCase.id}:HANDOFF`);
    if (
        ["BLOCKED", "REFUSED"].includes(expected.outcome) &&
        expected.handoff !== "NONE"
    )
        errors.push(`${testCase.id}:HANDOFF`);
    if (
        testCase.input?.acceptedModelStatus === "ACCEPTED" &&
        expected.outcome !== "SKIPPED"
    )
        errors.push(`${testCase.id}:ACCEPTED_MODEL`);

    const factIds = ids(model.facts);
    const stateViewIds = ids(model.stateViews);
    const reactionIds = ids(model.reactions);
    const consumerIds = new Set([...stateViewIds, ...reactionIds]);
    const gapCodes = new Set(
        model.gaps.filter(isRecord).map((gap) => gap.code),
    );
    for (const fact of model.facts) {
        if (
            !isRecord(fact) ||
            !allUniqueStrings(fact.consumerRefs) ||
            fact.consumerRefs.some(
                (reference) => !consumerIds.has(reference),
            ) ||
            (fact.consumerRefs.length === 0 && !gapCodes.has("ORPHAN_FACT"))
        )
            errors.push(`${testCase.id}:FACT_TRACEABILITY`);
    }
    for (const stateView of model.stateViews) {
        if (!isRecord(stateView) || !Array.isArray(stateView.fields)) {
            errors.push(`${testCase.id}:VIEW_TRACEABILITY`);
            continue;
        }
        for (const field of stateView.fields) {
            if (
                !isRecord(field) ||
                (field.factRef === null
                    ? !gapCodes.has("MISSING_FACT")
                    : !factIds.has(field.factRef))
            )
                errors.push(`${testCase.id}:VIEW_TRACEABILITY`);
        }
    }
    for (const reaction of model.reactions) {
        if (
            !isRecord(reaction) ||
            !["AUTOMATION", "TRANSLATION"].includes(reaction.kind) ||
            !factIds.has(reaction.triggerFactRef) ||
            !allUniqueStrings(reaction.emittedFactRefs) ||
            reaction.emittedFactRefs.some(
                (reference) => !factIds.has(reference),
            ) ||
            (reaction.kind === "AUTOMATION" &&
                reaction.emittedFactRefs.length !== 0) ||
            (reaction.kind === "TRANSLATION" &&
                reaction.emittedFactRefs.length === 0)
        )
            errors.push(`${testCase.id}:REACTION_CLASSIFICATION`);
    }
    if (
        expected.outcome === "MODEL_DRAFT" &&
        model.commands.length === 0 &&
        model.reactions.length === 0
    )
        errors.push(`${testCase.id}:EMPTY_DRAFT`);
    return [...new Set(errors)].sort(compareCodePoints);
}

export function validateEventModelingResult(
    input,
    { repositoryRoot = defaultRepositoryRoot, evaluatedCaseId } = {},
) {
    const errors = [];
    if (
        typeof evaluatedCaseId !== "string" ||
        !/^[NP]\d{2}$/.test(evaluatedCaseId)
    )
        errors.push("EVALUATED_CASE_ID");
    const testCase = parseCases(repositoryRoot, errors).find(
        (item) => item?.id === evaluatedCaseId,
    );
    if (!testCase) {
        errors.push("CASE_NOT_FOUND");
        return [...new Set(errors)].sort(compareCodePoints);
    }
    try {
        if (
            canonicalizeEventModelingJson(input) !==
            canonicalizeEventModelingJson(testCase.expected)
        )
            errors.push("RESULT_ORACLE_MISMATCH");
    } catch {
        errors.push("RESULT_FIELDS");
    }
    return [...new Set(errors)].sort(compareCodePoints);
}

export function validateDomainExpertEventModelingPilot(
    repositoryRoot = defaultRepositoryRoot,
) {
    const errors = [];
    inventory(
        repositoryRoot,
        pilotRoot,
        ["PILOT.md", "metadata.draft.json", "result-contract.json"],
        errors,
    );
    inventory(
        repositoryRoot,
        evaluationRoot,
        ["assertions.json", "baseline.md", "cases.jsonl"],
        errors,
    );
    for (const [path, digest] of Object.entries(contractDigests)) {
        const relativePath = path.startsWith("../")
            ? path.slice(3)
            : `${pilotRoot}/${path}`;
        const content = path.endsWith(".md")
            ? readContained(repositoryRoot, relativePath, 131072, errors)
            : readJson(repositoryRoot, relativePath, 131072, errors)?.content;
        if (
            content !== null &&
            content !== undefined &&
            sha256(content) !== digest
        )
            errors.push(`${relativePath}: digest changed`);
    }
    const metadata = readJson(
        repositoryRoot,
        `${pilotRoot}/metadata.draft.json`,
        65536,
        errors,
    )?.value;
    if (
        !metadata ||
        metadata.state !== "CONTRACT_ONLY" ||
        metadata.persistedModelRuns !== 0 ||
        metadata.repositoryOnly !== true ||
        metadata.runtimeEligible !== false ||
        metadata.distributionEligible !== false ||
        metadata.publicationEligible !== false ||
        metadata.promotionEligible !== false ||
        Object.values(metadata.permissions ?? {}).some(
            (value) => value !== false,
        )
    )
        errors.push("METADATA_CONTRACT");
    const assertions = readJson(
        repositoryRoot,
        `${evaluationRoot}/assertions.json`,
        65536,
        errors,
    )?.value;
    if (
        !assertions ||
        assertions.totalCases !== 9 ||
        assertions.positiveCases !== 4 ||
        assertions.negativeCases !== 5 ||
        assertions.modelRuns !== 0 ||
        assertions.runtimeEligible !== false
    )
        errors.push("ASSERTIONS");
    const resultContract = readJson(
        repositoryRoot,
        `${pilotRoot}/result-contract.json`,
        65536,
        errors,
    )?.value;
    if (
        !resultContract ||
        JSON.stringify(resultContract.fields) !==
            JSON.stringify(resultFields) ||
        JSON.stringify(resultContract.outcomes) !== JSON.stringify(outcomes)
    )
        errors.push("RESULT_CONTRACT");

    const cases = parseCases(repositoryRoot, errors);
    if (
        JSON.stringify(
            cases.map((item) => item?.id).sort(compareCodePoints),
        ) !== JSON.stringify(caseIds)
    )
        errors.push("CASE_INVENTORY");
    for (const testCase of cases) {
        if (
            !exactKeys(testCase, caseFields) ||
            !/^[NP]\d{2}$/.test(testCase.id ?? "") ||
            !["positive", "negative"].includes(testCase.kind) ||
            testCase.enabled !== true ||
            typeof testCase.prompt !== "string"
        ) {
            errors.push(`${testCase?.id ?? "UNKNOWN"}:CASE_FIELDS`);
            continue;
        }
        validatePacket(testCase, errors);
        errors.push(...validateEventModelingExpected(testCase));
        if (
            validateEventModelingResult(testCase.expected, {
                repositoryRoot,
                evaluatedCaseId: testCase.id,
            }).length > 0
        )
            errors.push(`${testCase.id}:EXPECTED_RESULT`);
    }
    return [...new Set(errors)].sort(compareCodePoints);
}

function main() {
    const errors = validateDomainExpertEventModelingPilot();
    if (errors.length > 0) {
        process.stderr.write(
            `Domain-expert event-modeling pilot validation failed with ${errors.length} error(s):\n`,
        );
        for (const error of errors) process.stderr.write(`- ${error}\n`);
        process.exitCode = 1;
    } else {
        process.stdout.write(
            "Domain-expert event-modeling pilot validation passed: 9 cases, zero model runs.\n",
        );
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
