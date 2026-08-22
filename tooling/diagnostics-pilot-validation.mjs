// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { types as utilTypes } from "node:util";
import { compareOrdinal } from "./catalog-ordering.mjs";
import { assertSafeContent } from "./public-artifact-materializer.mjs";
import {
    defaultRepositoryRoot,
    readCatalog,
} from "./catalog-validation.mjs";

const pilotRoot = "pilots/application-slice-diagnostics";
const canonicalRoutesDigest = "95df7029d50d1e4459a3795c0b1bc08f728e56bbd9b8f1515c5b6859fbbe942f";
const canonicalAssertionsDigest = "7507a4d525be03cdd098fa66e0307f3575dd50e985c412b7d130c5d874ddd79c";
const canonicalCasesDigest = "2e2e05ecc8a38909b3466d7b3df82376be6036fab2664a0cfaaafc2f6229c41b";
const evaluationRoot = "evals/application-slice-diagnostics";
const canonicalMetadataFields = [
    "schemaVersion",
    "capabilityId",
    "displayName",
    "kind",
    "lifecycle",
    "authorship",
    "sourceScope",
    "runtimeApproved",
    "runtimeEligible",
    "runtimeDiscoverable",
    "trust",
    "effects",
    "executionAllowed",
    "networkAllowed",
    "runtimeAccessAllowed",
    "repositoryWritesAllowed",
    "sourceDiagnosisEnabled",
    "instrumentationRequestsEnabled",
    "verifiedProfilesEnabled",
    "enabledEvaluationCaseIds",
    "maximumEvidenceFiles",
    "maximumEvidenceFileBytes",
    "maximumEvidenceBytes",
    "maximumReproductionSteps",
    "maximumHypotheses",
    "maximumInstrumentationRequests",
    "maximumOutputBytes",
    "authoringContractId",
    "requiredRepositoryProfile",
    "unverifiedAuthorityPolicy",
    "liveStatePolicy",
    "observableHttpPolicy",
    "embeddedInstructionPolicy",
    "generatedFilePolicy",
    "evaluationPayloadIncludedAtRuntime",
];
const canonicalResultSchemaVersion = "cratis-slice-diagnostics-v1";
const canonicalDispositions = [
    "BLOCKED",
    "HANDOFF",
    "INCONCLUSIVE",
    "REFUSED",
    "SKIPPED",
    "SOURCE_DIAGNOSIS",
];
const canonicalEnabledCaseIds = [
    "N04", "N05", "N06", "N07", "N08", "N11", "N12", "N14", "P09", "P10",
];
const canonicalRedactionCodes = [
    "LOCAL_PATH_REDACTED",
    "SENSITIVE_VALUE_REDACTED",
];
const canonicalLimitationCodes = [
    "AUTHORITY_MISSING",
    "EVIDENCE_MALFORMED",
    "NO_HTTP_EVIDENCE",
    "NO_LIVE_EVIDENCE",
    "PROFILE_OUT_OF_SCOPE",
    "REFUSAL_ONLY",
];
const canonicalOutputFields = [
    "schemaVersion", "evaluationOnly", "runtimeApproved", "caseId", "sourceBinding", "profile", "lane", "disposition", "reasonCode", "symptom", "facts", "hypotheses", "instrumentationRequests", "proof", "handoffs", "blocked", "skipped", "inconclusive", "redactions", "cleanup", "execution", "conclusion", "limitations",
];
const canonicalObjectFields = {
    sourceBinding: ["repositoryRevision", "authorityContractRevision", "evidenceBundleDigest"],
    profile: ["value", "status", "evidenceRefs"],
    symptom: ["verbatimRedacted", "expected", "observed", "preconditions", "frequency", "environmentBoundary", "reproductionSteps", "reproductionState", "evidenceRefs"],
    proof: ["userVisibleRegressionProven", "causalDiagnosisSupported", "fixProven", "failingArtifactRefs", "passingArtifactRefs", "correctionRefs", "regressionAssertionRefs", "cleanupProofRefs"],
    cleanup: ["required", "status", "instrumentationIds", "removalProofRefs"],
    execution: ["performed", "commands", "networkAccess", "runtimeAccess", "repositoryWrites", "remoteWrites", "mutations", "approvalsChanged", "publicationPerformed", "instrumentationApplied", "targetRefs"],
};
const canonicalFactFields = ["statement", "evidenceRefs", "productClaimRefs"];
const canonicalHypothesisFields = ["id", "statement", "evidenceRefs", "productClaimRefs", "predictedObservation", "discriminatingEvidence", "supportsWhen", "rejectsWhen", "status"];
const canonicalInstrumentationFields = ["id", "hypothesisId", "relativePath", "symbol", "signal", "allowedFields", "forbiddenFields", "maximumRecords", "redactionRule", "removalTrigger", "cleanupSteps", "cleanupVerification", "applyAllowed", "status"];
const canonicalDisabledFixtureStatus = {
    N01: "missing-profile-bundle",
    N02: "missing-profile-bundle",
    N03: "missing-profile-bundle",
    N09: "missing-authority-bundle",
    N10: "missing-authority-bundle",
    N13: "missing-profile-bundle",
    P01: "missing-authority-bundle",
    P02: "missing-authority-bundle",
    P03: "missing-authority-bundle",
    P04: "missing-authority-bundle",
    P05: "missing-authority-bundle",
    P06: "missing-authority-bundle",
    P07: "missing-authority-bundle",
    P08: "missing-authority-bundle",
};
const canonicalCaseBindings = {
    N01: ["framework-source", "SKIPPED", "PROFILE_FRAMEWORK"],
    N02: ["client-source", "SKIPPED", "PROFILE_CLIENT"],
    N03: ["non-cratis", "SKIPPED", "PROFILE_NON_CRATIS"],
    N04: ["non-cratis", "SKIPPED", "PROFILE_NON_CRATIS"],
    N05: ["non-cratis", "SKIPPED", "PROFILE_NON_CRATIS"],
    N06: ["non-cratis", "SKIPPED", "PROFILE_NON_CRATIS"],
    N07: ["chronicle-live-state", "REFUSED", "UNSAFE_EXECUTION_REQUESTED"],
    N08: ["observable-query-http", "REFUSED", "SENSITIVE_DATA_REQUESTED"],
    N09: ["application-source", "SOURCE_DIAGNOSIS", "SOURCE_CAUSE_SUPPORTED"],
    N10: ["application-source", "SOURCE_DIAGNOSIS", "SOURCE_CAUSE_SUPPORTED"],
    N11: ["unresolved", "REFUSED", "EXTERNAL_WORKFLOW_COPY_REQUESTED"],
    N12: ["unresolved", "BLOCKED", "AUTHORITY_UNVERIFIED"],
    N13: ["application-source", "INCONCLUSIVE", "REPRODUCTION_MISSING"],
    N14: ["unresolved", "BLOCKED", "EVIDENCE_MALFORMED"],
    P01: ["application-source", "SOURCE_DIAGNOSIS", "SOURCE_CAUSE_SUPPORTED"],
    P02: ["application-source", "SOURCE_DIAGNOSIS", "SOURCE_CAUSE_SUPPORTED"],
    P03: ["application-source", "SOURCE_DIAGNOSIS", "SOURCE_CAUSE_SUPPORTED"],
    P04: ["application-source", "SOURCE_DIAGNOSIS", "SOURCE_CAUSE_SUPPORTED"],
    P05: ["application-source", "SOURCE_DIAGNOSIS", "SOURCE_CAUSE_SUPPORTED"],
    P06: ["application-source", "SOURCE_DIAGNOSIS", "SOURCE_CAUSE_SUPPORTED"],
    P07: ["application-source", "SOURCE_DIAGNOSIS", "SOURCE_CAUSE_SUPPORTED"],
    P08: ["application-source", "INCONCLUSIVE", "TEMPORARY_INSTRUMENTATION_PENDING"],
    P09: ["chronicle-live-state", "HANDOFF", "LIVE_STATE_REQUIRED"],
    P10: ["observable-query-http", "HANDOFF", "OBSERVABLE_HTTP_EVIDENCE_REQUIRED"],
};
const canonicalReasonBindings = {
    AUTHORITY_UNVERIFIED: ["unresolved", "BLOCKED"],
    EVIDENCE_MALFORMED: ["unresolved", "BLOCKED"],
    EXTERNAL_WORKFLOW_COPY_REQUESTED: ["unresolved", "REFUSED"],
    LIVE_STATE_REQUIRED: ["chronicle-live-state", "HANDOFF"],
    MIXED_SCOPE_UNRESOLVED: ["mixed", "INCONCLUSIVE"],
    OBSERVABLE_HTTP_EVIDENCE_REQUIRED: ["observable-query-http", "HANDOFF"],
    PROFILE_CLIENT: ["client-source", "SKIPPED"],
    PROFILE_FRAMEWORK: ["framework-source", "SKIPPED"],
    PROFILE_NON_CRATIS: ["non-cratis", "SKIPPED"],
    PROFILE_UNVERIFIED: ["unresolved", "BLOCKED"],
    REPRODUCTION_MISSING: ["application-source", "INCONCLUSIVE"],
    SENSITIVE_DATA_REQUESTED: ["observable-query-http", "REFUSED"],
    SOURCE_CAUSE_SUPPORTED: ["application-source", "SOURCE_DIAGNOSIS"],
    SOURCE_EVIDENCE_INSUFFICIENT: ["application-source", "INCONCLUSIVE"],
    TEMPORARY_INSTRUMENTATION_PENDING: ["application-source", "INCONCLUSIVE"],
    UNSAFE_EXECUTION_REQUESTED: ["chronicle-live-state", "REFUSED"],
    USER_VISIBLE_PROOF_MISSING: ["application-source", "INCONCLUSIVE"],
};
const canonicalConclusions = {
    AUTHORITY_UNVERIFIED: "Authority evidence is required.",
    EVIDENCE_MALFORMED: "The supplied evidence is malformed.",
    EXTERNAL_WORKFLOW_COPY_REQUESTED: "External workflow copying is refused.",
    LIVE_STATE_REQUIRED: "Current runtime evidence is required for passive handoff.",
    OBSERVABLE_HTTP_EVIDENCE_REQUIRED: "Observable HTTP evidence is required for passive handoff.",
    PROFILE_NON_CRATIS: "The request is outside the Cratis repository profile.",
    SENSITIVE_DATA_REQUESTED: "Sensitive data collection is refused.",
    UNSAFE_EXECUTION_REQUESTED: "Executable live-system operations are refused.",
};
const canonicalMetadataConstants = {
    schemaVersion: 1,
    capabilityId: "application-slice-diagnostics-clean-room-pilot",
    displayName: "Evidence-first application slice diagnostics",
    kind: "gate",
    lifecycle: "evaluation",
    authorship: "cratis-original",
    sourceScope: "repository-only",
    requiredRepositoryProfile: "application",
    unverifiedAuthorityPolicy: "block",
    liveStatePolicy: "passive-handoff-only",
    observableHttpPolicy: "passive-handoff-only",
    embeddedInstructionPolicy: "treat-as-data",
    generatedFilePolicy: "never-patch-directly",
};
const canonicalResultContractFields = [
    "schemaVersion", "resultSchemaVersion", "outputFields", "objectFields", "hypothesisFields", "factFields", "collectionBounds", "stringCollections", "maximumCollectionStringLength", "instrumentationFields", "instrumentationStatuses", "instrumentationSignals", "instrumentationAllowedFields", "instrumentationRequiredForbiddenFields", "instrumentationRedactionRules", "dispositions", "lanes", "laneDispositions", "reasonBindings", "executionConstants", "proofFields", "maximumHypotheses", "maximumInstrumentationRequests", "maximumInstrumentationRecords", "maximumReferenceItems", "maximumTextLength", "maximumIdentifierLength", "maximumSymbolLength", "instrumentationApplyAllowed",
];
const canonicalExecutionConstants = {
    performed: false,
    commands: [],
    networkAccess: false,
    runtimeAccess: false,
    repositoryWrites: false,
    remoteWrites: false,
    mutations: false,
    approvalsChanged: false,
    publicationPerformed: false,
    instrumentationApplied: false,
    targetRefs: [],
};
const canonicalCaseFields = [
    "id",
    "kind",
    "enabled",
    "fixtureStatus",
    "prompt",
    "expected",
];
const canonicalCaseExpectedFields = ["disposition", "lane", "reasonCode"];
const canonicalCaseIds = [
    "N01", "N02", "N03", "N04", "N05", "N06", "N07", "N08", "N09", "N10", "N11", "N12", "N13", "N14",
    "P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08", "P09", "P10",
];
const canonicalLanes = [
    "application-source",
    "chronicle-live-state",
    "client-source",
    "framework-source",
    "mixed",
    "non-cratis",
    "observable-query-http",
    "unresolved",
];
const canonicalLaneDispositions = {
    "application-source": ["BLOCKED", "INCONCLUSIVE", "REFUSED", "SOURCE_DIAGNOSIS"],
    "chronicle-live-state": ["HANDOFF", "REFUSED"],
    "client-source": ["REFUSED", "SKIPPED"],
    "framework-source": ["REFUSED", "SKIPPED"],
    mixed: ["INCONCLUSIVE", "REFUSED"],
    "non-cratis": ["REFUSED", "SKIPPED"],
    "observable-query-http": ["HANDOFF", "REFUSED"],
    unresolved: ["BLOCKED", "REFUSED"],
};
const forbiddenInstrumentationPathSegments = new Set([
    ".agents",
    ".ai",
    ".git",
    ".github",
    ".pi",
    "build",
    "dependency",
    "dependencies",
    "dist",
    "distribution",
    "generated",
    "node_modules",
    "obj",
    "bin",
    "package",
    "packages",
    "plugin",
    "plugins",
    "runtime",
]);
const forbiddenInstrumentationFiles = new Set([
    "package.json",
    "package-lock.json",
    "plugin.json",
]);
const maximumInstrumentationRecords = 100;
const maximumReferenceItems = 32;
const maximumTextLength = 2048;
const maximumIdentifierLength = 64;
const maximumSymbolLength = 256;
const allowedInstrumentationExtensions = new Set([
    ".cs",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
]);
const operationClaimPattern = /\b(?:execut(?:e|ed|es|ing)|ran|run|runs|running|appl(?:y|ied|ies|ying)|patch(?:ed|es|ing)?|replay(?:ed|s|ing)?|write|writes|writing|wrote|written|delet(?:e|ed|es|ing)|connect(?:ed|s|ing)?|invok(?:e|ed|es|ing)|call(?:ed|s|ing)?|mutat(?:e|ed|es|ing))\b/i;
const canonicalCollectionBounds = {
    facts: 32,
    handoffs: 5,
    blocked: 10,
    skipped: 10,
    inconclusive: 10,
    redactions: 32,
    limitations: 10,
};
const canonicalInstrumentationStatuses = ["PROPOSED", "PENDING_APPROVAL"];
const canonicalInstrumentationSignals = [
    "counter",
    "duration",
    "exception-type",
    "identifier-only",
    "state-transition",
];
const canonicalInstrumentationAllowedFields = [
    "elapsedMilliseconds",
    "eventType",
    "exceptionType",
    "observerId",
    "outcome",
    "partitionId",
    "projectionId",
    "readModelId",
];
const canonicalInstrumentationForbiddenFields = [
    "authorization",
    "body",
    "connectionString",
    "cookie",
    "headers",
    "payload",
    "personalData",
    "secret",
    "token",
];
const canonicalInstrumentationRedactionRules = [
    "drop-unlisted-fields",
    "hash-identifiers",
    "replace-sensitive-values",
];

function canonicalDigest(value) {
    try {
        const serialized = JSON.stringify(value);
        if (typeof serialized !== "string") return null;
        return createHash("sha256").update(serialized).digest("hex");
    } catch {
        return null;
    }
}

function equalSets(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    const isPrimitive = (value) =>
        value === null ||
        ["boolean", "number", "string"].includes(typeof value);
    if (!left.every(isPrimitive) || !right.every(isPrimitive)) return false;
    const encode = (value) => `${typeof value}:${String(value)}`;
    const encodedLeft = left.map(encode).sort(compareOrdinal);
    const encodedRight = right.map(encode).sort(compareOrdinal);
    return (
        encodedLeft.length === encodedRight.length &&
        encodedLeft.every((value, index) => value === encodedRight[index])
    );
}

function matchesClosedConstants(value, constants) {
    if (!isPlainObject(value) || !equalSets(Object.keys(value), Object.keys(constants)))
        return false;
    return Object.entries(constants).every(([field, expected]) => {
        const actual = value[field];
        return Array.isArray(expected)
            ? Array.isArray(actual) &&
                  actual.length === expected.length &&
                  actual.every((item, index) => item === expected[index])
            : actual === expected;
    });
}

function unknownProperties(value, allowed, label, errors) {
    for (const property of Object.keys(value)) {
        if (!allowed.includes(property))
            errors.push(`${label}: unknown property ${property}`);
    }
}

function safeRelativePath(path) {
    if (!isBoundedString(path, 512)) return false;
    if (
        isAbsolute(path) ||
        path.includes(":") ||
        path.includes("\\")
    )
        return false;
    const segments = path.split("/");
    const fileName = segments.at(-1).toLowerCase();
    const extension = [...allowedInstrumentationExtensions].find((candidate) =>
        fileName.endsWith(candidate),
    );
    if (
        !extension ||
        /(?:^assemblyinfo|^assemblyattributes|\.g(?:\.i)?|\.generated|\.designer|\.assemblyinfo|\.assemblyattributes)\.(?:cs|js|jsx|ts|tsx)$/i.test(fileName) ||
        /(?:\.g(?:\.i)?\.|\.generated\.|\.designer\.|\.d\.(?:ts|tsx)$)/i.test(fileName)
    )
        return false;
    return !segments.some((segment) => {
        const normalized = segment.toLowerCase();
        return (
            segment === "" ||
            segment === "." ||
            segment === ".." ||
            segment.startsWith(".") ||
            normalized.startsWith("generated") ||
            forbiddenInstrumentationPathSegments.has(normalized) ||
            forbiddenInstrumentationFiles.has(normalized) ||
            (/^(?:package|plugin).+\.json$/i.test(normalized))
        );
    });
}

function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    try {
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    } catch {
        return false;
    }
}

function clonePlainJsonData(root) {
    if (
        Object.getPrototypeOf(Array.prototype) !== Object.prototype ||
        Object.getPrototypeOf(Object.prototype) !== null ||
        Object.hasOwn(Array.prototype, "toJSON") ||
        Object.hasOwn(Object.prototype, "toJSON")
    )
        return { error: "Inherited prototype hooks are not allowed" };
    const stack = [
        { source: root, parent: null, key: null, depth: 0, ancestors: [] },
    ];
    let clonedRoot;
    let visited = 0;
    let encodedBytes = 0;
    const assign = (parent, key, value) => {
        if (parent === null) clonedRoot = value;
        else {
            const descriptor = Object.create(null);
            descriptor.value = value;
            descriptor.writable = true;
            descriptor.enumerable = true;
            descriptor.configurable = true;
            Object.defineProperty(parent, key, descriptor);
        }
    };
    while (stack.length > 0) {
        const current = stack.pop();
        visited++;
        if (visited > 10000 || current.depth > 32)
            return { error: "JSON data exceeds structural bounds" };
        const source = current.source;
        if (
            source === null ||
            typeof source === "string" ||
            typeof source === "boolean"
        ) {
            if (typeof source === "string" && source.length > 65536)
                return { error: "output exceeds byte limit" };
            encodedBytes +=
                typeof source === "string"
                    ? Buffer.byteLength(source, "utf8")
                    : 5;
            if (encodedBytes > 65536)
                return { error: "output exceeds byte limit" };
            assign(current.parent, current.key, source);
            continue;
        }
        if (typeof source === "number") {
            if (!Number.isFinite(source))
                return { error: "JSON numbers must be finite" };
            encodedBytes += 24;
            if (encodedBytes > 65536)
                return { error: "output exceeds byte limit" };
            assign(current.parent, current.key, source);
            continue;
        }
        if (!source || typeof source !== "object")
            return { error: "Value is not JSON-compatible" };
        if (utilTypes.isProxy(source))
            return { error: "Proxy objects are not allowed" };
        if (current.ancestors.includes(source))
            return { error: "JSON data contains a cycle" };
        try {
            const isArray = Array.isArray(source);
            const prototype = Object.getPrototypeOf(source);
            if (
                isArray
                    ? prototype !== Array.prototype
                    : prototype !== Object.prototype && prototype !== null
            )
                return { error: "JSON objects use an unsupported prototype" };
            if (isArray) {
                const lengthDescriptor = Object.getOwnPropertyDescriptor(
                    source,
                    "length",
                );
                const lengthValue =
                    lengthDescriptor && Object.hasOwn(lengthDescriptor, "value")
                        ? lengthDescriptor.value
                        : undefined;
                if (
                    !Number.isSafeInteger(lengthValue) ||
                    lengthValue < 0 ||
                    lengthValue > 10000
                )
                    return { error: "JSON arrays must be dense and bounded" };
            }
            if (
                prototype === Object.prototype &&
                Object.hasOwn(Object.prototype, "toJSON")
            )
                return { error: "Object.prototype.toJSON is not allowed" };
            if (Object.getOwnPropertySymbols(source).length > 0)
                return { error: "JSON data contains symbol properties" };
            const descriptors = Object.getOwnPropertyDescriptors(source);
            const entries = Object.entries(descriptors).filter(
                ([key]) => !(isArray && key === "length"),
            );
            if (entries.length + stack.length + visited > 10000)
                return { error: "JSON data exceeds structural bounds" };
            for (const [key] of entries) {
                if (key.length > 65536)
                    return { error: "output exceeds byte limit" };
                encodedBytes += Buffer.byteLength(key, "utf8") + 4;
                if (encodedBytes > 65536)
                    return { error: "output exceeds byte limit" };
            }
            let target;
            if (isArray) {
                const lengthDescriptor = Object.hasOwn(descriptors, "length")
                    ? descriptors.length
                    : undefined;
                const length =
                    lengthDescriptor && Object.hasOwn(lengthDescriptor, "value")
                        ? lengthDescriptor.value
                        : undefined;
                if (
                    !Number.isSafeInteger(length) ||
                    length < 0 ||
                    length > 10000 ||
                    entries.length !== length
                )
                    return { error: "JSON arrays must be dense and bounded" };
                const indexes = new Set();
                for (const [key, descriptor] of entries) {
                    if (
                        !/^(?:0|[1-9]\d*)$/.test(key) ||
                        Number(key) >= length ||
                        Number(key) > 4294967294 ||
                        Object.hasOwn(descriptor, "get") ||
                        Object.hasOwn(descriptor, "set") ||
                        !Object.hasOwn(descriptor, "enumerable") ||
                        descriptor.enumerable !== true ||
                        !Object.hasOwn(descriptor, "value")
                    )
                        return { error: "JSON arrays contain invalid index properties" };
                    indexes.add(Number(key));
                }
                if (indexes.size !== length)
                    return { error: "JSON arrays must be dense and bounded" };
                target = new Array(length);
            } else {
                target = Object.create(null);
                for (const [key, descriptor] of entries) {
                    if (
                        Object.hasOwn(descriptor, "get") ||
                        Object.hasOwn(descriptor, "set") ||
                        !Object.hasOwn(descriptor, "enumerable") ||
                        descriptor.enumerable !== true ||
                        !Object.hasOwn(descriptor, "value") ||
                        key === "toJSON"
                    )
                        return {
                            error: "JSON data contains accessors or hidden serialization hooks",
                        };
                }
            }
            assign(current.parent, current.key, target);
            const childAncestors = [...current.ancestors, source];
            for (let index = entries.length - 1; index >= 0; index--) {
                const [key, descriptor] = entries[index];
                stack.push({
                    source: Object.hasOwn(descriptor, "value")
                        ? descriptor.value
                        : undefined,
                    parent: target,
                    key,
                    depth: current.depth + 1,
                    ancestors: childAncestors,
                });
            }
        } catch {
            return { error: "JSON object inspection failed" };
        }
    }
    return { value: clonedRoot };
}

function errorMessage(error) {
    try {
        return error && typeof error.message === "string"
            ? error.message
            : "unknown error";
    } catch {
        return "unknown error";
    }
}

function isBoundedString(value, maximum = maximumTextLength) {
    return (
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= maximum &&
        !/[\u0000-\u001f\u007f-\u009f]/.test(value)
    );
}

function isReference(value) {
    return (
        typeof value === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/.test(value) &&
        !/^[A-Za-z]:/.test(value) &&
        !value.includes("..")
    );
}

function isReferenceArray(value, maximumItems = maximumReferenceItems) {
    return (
        Array.isArray(value) &&
        value.length <= maximumItems &&
        value.every(isReference) &&
        value.length === new Set(value).size
    );
}

function isIdentifier(value) {
    return (
        typeof value === "string" &&
        /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)
    );
}

function isBoundedStringArray(value, maximumItems = maximumReferenceItems) {
    return (
        Array.isArray(value) &&
        value.length <= maximumItems &&
        value.every((item) => isBoundedString(item, 512)) &&
        value.length === new Set(value).size
    );
}

function hasOperationClaim(value) {
    const stack = [{ value, depth: 0 }];
    const seen = new WeakSet();
    let visited = 0;
    while (stack.length > 0) {
        const current = stack.pop();
        visited++;
        if (visited > 10000 || current.depth > 32) return true;
        if (typeof current.value === "string") {
            if (operationClaimPattern.test(current.value)) return true;
            continue;
        }
        if (
            !current.value ||
            typeof current.value !== "object" ||
            seen.has(current.value)
        )
            continue;
        seen.add(current.value);
        const values = Array.isArray(current.value)
            ? current.value
            : Object.values(current.value);
        for (const nested of values)
            stack.push({ value: nested, depth: current.depth + 1 });
    }
    return false;
}

function caseLabel(testCase) {
    return isPlainObject(testCase) && typeof testCase.id === "string"
        ? testCase.id
        : "<invalid-case>";
}

function duplicates(values) {
    const seen = new Set();
    return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

function readDirectoryNamesSafe(path, label, errors) {
    try {
        return readdirSync(path).sort(compareOrdinal);
    } catch (error) {
        errors.push(`${label}: cannot read directory (${errorMessage(error)})`);
        return [];
    }
}

function readCatalogSafe(path, label, errors, fallback = {}) {
    try {
        return readCatalog(path);
    } catch (error) {
        errors.push(`${label}: invalid JSON (${errorMessage(error)})`);
        return fallback;
    }
}

export function readDiagnosticsCases(root = defaultRepositoryRoot) {
    return readFileSync(join(root, evaluationRoot, "cases.jsonl"), "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line, index) => {
            try {
                return JSON.parse(line);
            } catch (error) {
                throw new Error(
                    `Invalid diagnostics case JSON on line ${index + 1}`,
                    { cause: error },
                );
            }
        });
}

export function validateDiagnosticsResult(
    output,
    resultContract,
    metadata,
) {
    const errors = [];
    if (!output || typeof output !== "object")
        return ["Diagnostics output must be an object"];
    const clonedOutput = clonePlainJsonData(output);
    const clonedOutputError = Object.hasOwn(clonedOutput, "error")
        ? clonedOutput.error
        : null;
    if (clonedOutputError)
        return [`Diagnostics output contains unsafe content: ${clonedOutputError}`];
    output = Object.hasOwn(clonedOutput, "value")
        ? clonedOutput.value
        : undefined;
    if (!isPlainObject(output))
        return ["Diagnostics output must be an object"];
    const clonedResultContract = clonePlainJsonData(resultContract);
    const clonedResultContractError = Object.hasOwn(
        clonedResultContract,
        "error",
    )
        ? clonedResultContract.error
        : null;
    const clonedResultContractValue = Object.hasOwn(
        clonedResultContract,
        "value",
    )
        ? clonedResultContract.value
        : undefined;
    if (clonedResultContractError || !isPlainObject(clonedResultContractValue))
        errors.push("Diagnostics result contract must be an object containing plain JSON data");
    else resultContract = clonedResultContractValue;
    const clonedMetadata = clonePlainJsonData(metadata);
    const clonedMetadataError = Object.hasOwn(clonedMetadata, "error")
        ? clonedMetadata.error
        : null;
    const clonedMetadataValue = Object.hasOwn(clonedMetadata, "value")
        ? clonedMetadata.value
        : undefined;
    if (clonedMetadataError || !isPlainObject(clonedMetadataValue))
        errors.push("Diagnostics validation metadata must be an object containing plain JSON data");
    else metadata = clonedMetadataValue;
    unknownProperties(
        output,
        canonicalOutputFields,
        "diagnostics output",
        errors,
    );
    if (!equalSets(Object.keys(output), canonicalOutputFields))
        errors.push("Diagnostics output fields are incomplete");
    if (
        output.schemaVersion !== canonicalResultSchemaVersion ||
        output.evaluationOnly !== true ||
        output.runtimeApproved !== false
    )
        errors.push("Diagnostics output constants changed");
    if (
        typeof output.caseId !== "string" ||
        typeof output.lane !== "string" ||
        typeof output.disposition !== "string" ||
        typeof output.reasonCode !== "string"
    )
        errors.push("Diagnostics output identifiers must be strings");
    const outputLane =
        typeof output.lane === "string" ? output.lane : "<invalid-lane>";
    const outputDisposition =
        typeof output.disposition === "string"
            ? output.disposition
            : "<invalid-disposition>";
    if (!canonicalLanes.includes(outputLane))
        errors.push("Diagnostics output lane is unknown");
    if (!canonicalDispositions.includes(outputDisposition))
        errors.push("Diagnostics output disposition is unknown");
    const outputLaneDispositions = Object.hasOwn(
        canonicalLaneDispositions,
        outputLane,
    )
        ? canonicalLaneDispositions[outputLane]
        : undefined;
    if (
        !Array.isArray(outputLaneDispositions) ||
        !outputLaneDispositions.includes(outputDisposition)
    )
        errors.push("Diagnostics lane does not allow the disposition");
    const reasonBinding =
        typeof output.reasonCode === "string" &&
        Object.hasOwn(canonicalReasonBindings, output.reasonCode)
            ? canonicalReasonBindings[output.reasonCode]
            : undefined;
    if (
        !reasonBinding ||
        reasonBinding[0] !== output.lane ||
        reasonBinding[1] !== output.disposition
    )
        errors.push("Diagnostics reason is not bound to lane and disposition");

    for (const [field, expectedFields] of Object.entries(
        canonicalObjectFields,
    )) {
        const value = output[field];
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            errors.push(`Diagnostics ${field} must be an object`);
            continue;
        }
        unknownProperties(value, expectedFields, `diagnostics ${field}`, errors);
        if (!equalSets(Object.keys(value), expectedFields))
            errors.push(`Diagnostics ${field} fields are incomplete`);
    }
    const sourceBinding = output.sourceBinding;
    if (
        !isPlainObject(sourceBinding) ||
        !isReference(sourceBinding.repositoryRevision) ||
        !isReference(sourceBinding.authorityContractRevision) ||
        !isReference(sourceBinding.evidenceBundleDigest)
    )
        errors.push("Diagnostics source binding values are invalid");
    const profile = output.profile;
    if (
        !isPlainObject(profile) ||
        !["application", "client", "framework", "mixed", "non-cratis", "unknown"].includes(
            profile.value,
        ) ||
        !["UNVERIFIED", "VERIFIED"].includes(profile.status) ||
        !isReferenceArray(profile.evidenceRefs)
    )
        errors.push("Diagnostics profile values are invalid");
    const symptom = output.symptom;
    if (
        !isPlainObject(symptom) ||
        !isBoundedString(symptom.verbatimRedacted) ||
        !isBoundedString(symptom.expected) ||
        !isBoundedString(symptom.observed) ||
        !isBoundedStringArray(symptom.preconditions, 12) ||
        !isBoundedString(symptom.frequency, 128) ||
        !isBoundedString(symptom.environmentBoundary, 512) ||
        !isBoundedStringArray(
            symptom.reproductionSteps,
            12,
        ) ||
        !isBoundedString(symptom.reproductionState, 128) ||
        !isReferenceArray(symptom.evidenceRefs)
    )
        errors.push("Diagnostics symptom values are invalid");
    const proof = output.proof;
    if (
        !isPlainObject(proof) ||
        typeof proof.userVisibleRegressionProven !== "boolean" ||
        typeof proof.causalDiagnosisSupported !== "boolean" ||
        typeof proof.fixProven !== "boolean" ||
        !isReferenceArray(proof.failingArtifactRefs) ||
        !isReferenceArray(proof.passingArtifactRefs) ||
        !isReferenceArray(proof.correctionRefs) ||
        !isReferenceArray(proof.regressionAssertionRefs) ||
        !isReferenceArray(proof.cleanupProofRefs)
    )
        errors.push("Diagnostics proof values are invalid");
    const cleanup = output.cleanup;
    if (
        !isPlainObject(cleanup) ||
        typeof cleanup.required !== "boolean" ||
        !["NOT_APPLICABLE", "PENDING", "VERIFIED"].includes(cleanup.status) ||
        !isBoundedStringArray(cleanup.instrumentationIds, 3) ||
        cleanup.instrumentationIds.some((id) => !isIdentifier(id)) ||
        !isReferenceArray(cleanup.removalProofRefs)
    )
        errors.push("Diagnostics cleanup values are invalid");
    if (
        !isBoundedString(output.caseId, maximumIdentifierLength) ||
        !canonicalEnabledCaseIds.includes(output.caseId)
    )
        errors.push("Diagnostics case identifier is not enabled");
    const caseBinding =
        typeof output.caseId === "string" &&
        Object.hasOwn(canonicalCaseBindings, output.caseId)
            ? canonicalCaseBindings[output.caseId]
            : undefined;
    if (
        !caseBinding ||
        output.lane !== caseBinding[0] ||
        output.disposition !== caseBinding[1] ||
        output.reasonCode !== caseBinding[2]
    )
        errors.push("Diagnostics output does not match its enabled case binding");
    const expectedCollections = {
        handoffs: output.disposition === "HANDOFF" ? [output.lane] : [],
        blocked: output.disposition === "BLOCKED" ? [output.reasonCode] : [],
        skipped: output.disposition === "SKIPPED" ? [output.reasonCode] : [],
        inconclusive:
            output.disposition === "INCONCLUSIVE" ? [output.reasonCode] : [],
    };
    if (
        Object.entries(expectedCollections).some(
            ([field, expected]) =>
                !Array.isArray(output[field]) ||
                !equalSets(output[field], expected),
        )
    )
        errors.push("Diagnostics disposition collections changed");
    if (output.profile?.status === "VERIFIED")
        errors.push("Diagnostics verified profiles are disabled in this pilot phase");
    if (output.disposition === "SOURCE_DIAGNOSIS")
        errors.push("Diagnostics source diagnosis is disabled in this pilot phase");
    if (output.instrumentationRequests?.length > 0)
        errors.push("Diagnostics instrumentation is disabled in this pilot phase");
    if (output.facts?.length > 0 || output.hypotheses?.length > 0)
        errors.push("Diagnostics source claims are disabled in this pilot phase");
    if (
        output.proof?.userVisibleRegressionProven ||
        output.proof?.causalDiagnosisSupported ||
        output.proof?.fixProven ||
        [
            output.proof?.failingArtifactRefs,
            output.proof?.passingArtifactRefs,
            output.proof?.correctionRefs,
            output.proof?.regressionAssertionRefs,
            output.proof?.cleanupProofRefs,
        ].some((references) => references?.length > 0)
    )
        errors.push("Diagnostics proof claims are disabled in this pilot phase");
    if (
        output.cleanup?.required !== false ||
        output.cleanup?.status !== "NOT_APPLICABLE" ||
        output.cleanup?.instrumentationIds?.length !== 0 ||
        output.cleanup?.removalProofRefs?.length !== 0
    )
        errors.push("Diagnostics cleanup claims are disabled in this pilot phase");
    if (
        typeof output.reasonCode !== "string" ||
        !Object.hasOwn(canonicalConclusions, output.reasonCode) ||
        output.conclusion !== canonicalConclusions[output.reasonCode]
    )
        errors.push("Diagnostics conclusion is not canonical for its reason");
    if (!matchesClosedConstants(output.execution, canonicalExecutionConstants))
        errors.push("Diagnostics execution constants changed");
    for (const [field, maximumItems] of Object.entries(
        canonicalCollectionBounds,
    )) {
        const collection = output[field];
        if (!Array.isArray(collection) || collection.length > maximumItems) {
            errors.push(`Diagnostics ${field} collection is invalid`);
            continue;
        }
        if (field === "facts") {
            for (const fact of collection) {
                if (!fact || typeof fact !== "object" || Array.isArray(fact)) {
                    errors.push("Diagnostics fact must be an object");
                    continue;
                }
                unknownProperties(
                    fact,
                    canonicalFactFields,
                    "diagnostics fact",
                    errors,
                );
                if (!equalSets(Object.keys(fact), canonicalFactFields))
                    errors.push("Diagnostics fact fields are incomplete");
                if (
                    !isBoundedString(fact.statement, 512) ||
                    !isReferenceArray(fact.evidenceRefs) ||
                    !isReferenceArray(fact.productClaimRefs)
                )
                    errors.push("Diagnostics fact values are invalid");
            }
            const serializedFacts = collection.map((fact, index) => {
                if (
                    !isPlainObject(fact) ||
                    !isBoundedString(fact.statement, 512) ||
                    !isReferenceArray(fact.evidenceRefs) ||
                    !isReferenceArray(fact.productClaimRefs)
                )
                    return `<invalid-fact-${index}>`;
                const evidenceRefs = [...fact.evidenceRefs].sort(compareOrdinal);
                const productClaimRefs = [...fact.productClaimRefs].sort(
                    compareOrdinal,
                );
                return `${fact.statement}\u0000${evidenceRefs.join("\u0001")}\u0000${productClaimRefs.join("\u0001")}`;
            });
            if (serializedFacts.length !== new Set(serializedFacts).size)
                errors.push("Diagnostics facts are duplicated");
        } else {
            for (const item of collection) {
                if (!isBoundedString(item, 512))
                    errors.push(`Diagnostics ${field} item is invalid`);
            }
            if (collection.length !== new Set(collection).size)
                errors.push(`Diagnostics ${field} items are duplicated`);
        }
    }
    const allowedCodes = {
        redactions: canonicalRedactionCodes,
        limitations: canonicalLimitationCodes,
    };
    for (const [field, allowed] of Object.entries(allowedCodes)) {
        if (
            Array.isArray(output[field]) &&
            output[field].some((item) => !allowed.includes(item))
        )
            errors.push(`Diagnostics ${field} must use canonical codes`);
    }
    if (
        Array.isArray(output.handoffs) &&
        output.handoffs.some((lane) => !canonicalLanes.includes(lane))
    )
        errors.push("Diagnostics handoff lane is unknown");
    for (const field of ["blocked", "skipped", "inconclusive"]) {
        if (
            Array.isArray(output[field]) &&
            output[field].some(
                (reason) =>
                    typeof reason !== "string" ||
                    !Object.hasOwn(canonicalReasonBindings, reason),
            )
        )
            errors.push(`Diagnostics ${field} reason is unknown`);
    }
    if (
        !Array.isArray(output.hypotheses) ||
        output.hypotheses.length > 5
    )
        errors.push("Diagnostics hypothesis bound exceeded");
    else {
        for (const hypothesis of output.hypotheses) {
            if (!isPlainObject(hypothesis)) {
                errors.push("Diagnostics hypothesis must be an object");
                continue;
            }
            unknownProperties(
                hypothesis,
                canonicalHypothesisFields,
                "diagnostics hypothesis",
                errors,
            );
            if (!equalSets(Object.keys(hypothesis), canonicalHypothesisFields))
                errors.push("Diagnostics hypothesis fields are incomplete");
            if (
                !isIdentifier(hypothesis.id) ||
                !isBoundedString(hypothesis.statement) ||
                !isReferenceArray(hypothesis.evidenceRefs) ||
                !isReferenceArray(hypothesis.productClaimRefs) ||
                !isBoundedString(hypothesis.predictedObservation) ||
                !isBoundedString(hypothesis.discriminatingEvidence) ||
                !isBoundedString(hypothesis.supportsWhen) ||
                !isBoundedString(hypothesis.rejectsWhen) ||
                !["PROPOSED", "REJECTED", "SUPPORTED"].includes(hypothesis.status)
            )
                errors.push("Diagnostics hypothesis values are invalid");
        }
    }
    const hypothesisIds = Array.isArray(output.hypotheses)
        ? output.hypotheses
              .filter(isPlainObject)
              .map((hypothesis) => hypothesis.id)
              .filter(isIdentifier)
        : [];
    if (hypothesisIds.length !== new Set(hypothesisIds).size)
        errors.push("Diagnostics hypothesis identifiers are duplicated");
    if (
        !Array.isArray(output.instrumentationRequests) ||
        output.instrumentationRequests.length > 3
    )
        errors.push("Diagnostics instrumentation bound exceeded");
    else {
        for (const request of output.instrumentationRequests) {
            if (!isPlainObject(request)) {
                errors.push("Diagnostics instrumentation must be an object");
                continue;
            }
            unknownProperties(
                request,
                canonicalInstrumentationFields,
                "diagnostics instrumentation",
                errors,
            );
            if (
                !equalSets(
                    Object.keys(request),
                    canonicalInstrumentationFields,
                )
            )
                errors.push("Diagnostics instrumentation fields are incomplete");
            const boundHypothesis = Array.isArray(output.hypotheses)
                ? output.hypotheses.find(
                      (hypothesis) =>
                          isPlainObject(hypothesis) &&
                          hypothesis.id === request.hypothesisId,
                  )
                : undefined;
            if (
                request.applyAllowed !== false ||
                !boundHypothesis ||
                !isReferenceArray(boundHypothesis.evidenceRefs) ||
                boundHypothesis.evidenceRefs.length === 0 ||
                !isReferenceArray(boundHypothesis.productClaimRefs) ||
                boundHypothesis.productClaimRefs.length === 0 ||
                !isIdentifier(request.id) ||
                !isIdentifier(request.hypothesisId) ||
                !hypothesisIds.includes(request.hypothesisId) ||
                !canonicalInstrumentationStatuses.includes(request.status) ||
                !safeRelativePath(request.relativePath) ||
                !isBoundedString(request.symbol, maximumSymbolLength) ||
                !canonicalInstrumentationSignals.includes(request.signal) ||
                !isBoundedStringArray(request.allowedFields, 8) ||
                request.allowedFields.length === 0 ||
                request.allowedFields.some(
                    (field) =>
                        !canonicalInstrumentationAllowedFields.includes(field),
                ) ||
                !isBoundedStringArray(request.forbiddenFields, 16) ||
                !equalSets(
                    request.forbiddenFields,
                    canonicalInstrumentationForbiddenFields,
                ) ||
                !Number.isSafeInteger(request.maximumRecords) ||
                request.maximumRecords < 1 ||
                request.maximumRecords > maximumInstrumentationRecords ||
                !canonicalInstrumentationRedactionRules.includes(
                    request.redactionRule,
                ) ||
                !isBoundedString(request.removalTrigger, 512) ||
                !isBoundedStringArray(request.cleanupSteps, 10) ||
                request.cleanupSteps.length === 0 ||
                !isBoundedString(request.cleanupVerification, 512)
            )
                errors.push("Diagnostics instrumentation is unsafe or incomplete");
        }
        const requestIds = output.instrumentationRequests
            .filter(isPlainObject)
            .map((request) => request.id)
            .filter(isIdentifier);
        if (requestIds.length !== new Set(requestIds).size)
            errors.push("Diagnostics instrumentation identifiers are duplicated");
    }
    if (!Array.isArray(output.instrumentationRequests))
        errors.push("Diagnostics instrumentation collection must be an array");
    if (
        hasOperationClaim({
            facts: output.facts,
            hypotheses: output.hypotheses,
            instrumentationRequests: output.instrumentationRequests,
            conclusion: output.conclusion,
            limitations: output.limitations,
        })
    )
        errors.push("Diagnostics output contains an operation claim");
    try {
        const serializedOutput = JSON.stringify(output);
        if (typeof serializedOutput !== "string")
            throw new Error("Output cannot be serialized");
        if (Buffer.byteLength(serializedOutput) > 65536)
            errors.push("Diagnostics output exceeds byte limit");
        assertSafeContent(
            "diagnostics-output.json",
            Buffer.from(serializedOutput),
        );
    } catch (error) {
        errors.push(`Diagnostics output contains unsafe content: ${errorMessage(error)}`);
    }
    return errors;
}

export function validateDiagnosticsPilot(root = defaultRepositoryRoot) {
    const errors = [];
    const metadataDocument = readCatalogSafe(
        join(root, pilotRoot, "metadata.draft.json"),
        "Diagnostics metadata",
        errors,
    );
    const routesDocument = readCatalogSafe(
        join(root, pilotRoot, "symptom-routes.json"),
        "Diagnostics routes",
        errors,
    );
    const resultContractDocument = readCatalogSafe(
        join(root, pilotRoot, "result-contract.json"),
        "Diagnostics result contract",
        errors,
    );
    const assertionsDocument = readCatalogSafe(
        join(root, evaluationRoot, "assertions.json"),
        "Diagnostics assertions",
        errors,
    );
    const metadata = isPlainObject(metadataDocument) ? metadataDocument : {};
    const routes = isPlainObject(routesDocument) ? routesDocument : { routes: [] };
    const resultContract = isPlainObject(resultContractDocument)
        ? resultContractDocument
        : {};
    const assertions = isPlainObject(assertionsDocument)
        ? assertionsDocument
        : {};
    if (!isPlainObject(metadataDocument))
        errors.push("Diagnostics metadata must be an object");
    if (!isPlainObject(routesDocument))
        errors.push("Diagnostics routes must be an object");
    if (!isPlainObject(resultContractDocument))
        errors.push("Diagnostics result contract must be an object");
    if (!isPlainObject(assertionsDocument))
        errors.push("Diagnostics assertions must be an object");
    const authoringDocument = readCatalogSafe(
        join(root, "catalog/v2/authoring-contracts.json"),
        "Diagnostics authoring contracts",
        errors,
        { contracts: [] },
    );
    const authoringContracts =
        isPlainObject(authoringDocument) &&
        Array.isArray(authoringDocument.contracts)
            ? authoringDocument.contracts.filter(isPlainObject)
            : [];
    let cases = [];
    try {
        cases = readDiagnosticsCases(root);
    } catch (error) {
        errors.push(`Diagnostics cases: invalid JSON (${errorMessage(error)})`);
    }

    if (canonicalDigest(routesDocument) !== canonicalRoutesDigest)
        errors.push("Diagnostics routes digest changed");
    if (canonicalDigest(assertionsDocument) !== canonicalAssertionsDigest)
        errors.push("Diagnostics assertions digest changed");
    if (canonicalDigest(cases) !== canonicalCasesDigest)
        errors.push("Diagnostics cases digest changed");

    if (!equalSets(Object.keys(metadata), canonicalMetadataFields))
        errors.push("Diagnostics metadata fields changed");
    if (
        Object.entries(canonicalMetadataConstants).some(
            ([field, expected]) => metadata[field] !== expected,
        )
    )
        errors.push("Diagnostics metadata constants changed");
    if (
        !Array.isArray(metadata.effects) ||
        metadata.effects.length > 0 ||
        !Array.isArray(metadata.enabledEvaluationCaseIds)
    )
        errors.push("Diagnostics metadata collections changed");
    if (
        metadata.runtimeApproved !== false ||
        metadata.runtimeEligible !== false ||
        metadata.runtimeDiscoverable !== false ||
        metadata.evaluationPayloadIncludedAtRuntime !== false
    )
        errors.push("Diagnostics pilot must remain absent from runtime");
    if (
        metadata.trust !== "passive" ||
        metadata.executionAllowed !== false ||
        metadata.networkAllowed !== false ||
        metadata.runtimeAccessAllowed !== false ||
        metadata.repositoryWritesAllowed !== false ||
        metadata.sourceDiagnosisEnabled !== false ||
        metadata.instrumentationRequestsEnabled !== false ||
        metadata.verifiedProfilesEnabled !== false
    )
        errors.push("Diagnostics pilot must remain passive and effect-free");
    if (
        metadata.maximumEvidenceFiles !== 32 ||
        metadata.maximumEvidenceFileBytes !== 131072 ||
        metadata.maximumEvidenceBytes !== 2097152 ||
        metadata.maximumReproductionSteps !== 12 ||
        metadata.maximumHypotheses !== 5 ||
        metadata.maximumInstrumentationRequests !== 3 ||
        metadata.maximumOutputBytes !== 65536
    )
        errors.push("Diagnostics pilot bounds changed");
    const authoringContract = authoringContracts.find(
        (contract) => contract.id === metadata.authoringContractId,
    );
    if (!authoringContract || authoringContract.state !== "active")
        errors.push("Diagnostics pilot needs the active clean-room contract");

    const routeRecords = Array.isArray(routes.routes) ? routes.routes : [];
    if (!Array.isArray(routes.routes))
        errors.push("Diagnostics routes collection must be an array");
    const routeLanes = routeRecords
        .filter(isPlainObject)
        .map((route) =>
            typeof route.lane === "string" ? route.lane : "<invalid-lane>",
        );
    for (const duplicate of duplicates(routeLanes))
        errors.push(`Duplicate diagnostics route ${duplicate}`);
    for (const route of routeRecords.filter(isPlainObject)) {
        const routeLabel =
            typeof route.lane === "string" ? route.lane : "<invalid-lane>";
        if (!Array.isArray(route.allowedDispositions)) {
            errors.push(`${routeLabel}: dispositions must be an array`);
            continue;
        }
        for (const disposition of route.allowedDispositions) {
            const dispositionLabel =
                typeof disposition === "string"
                    ? disposition
                    : "<invalid-disposition>";
            if (!canonicalDispositions.includes(dispositionLabel))
                errors.push(
                    `${routeLabel}: unknown disposition ${dispositionLabel}`,
                );
        }
    }
    if (
        !equalSets(routeLanes, canonicalLanes) ||
        !equalSets(resultContract.lanes, canonicalLanes)
    )
        errors.push("Diagnostics lanes differ from the canonical eight-lane set");
    if (!equalSets(Object.keys(resultContract), canonicalResultContractFields))
        errors.push("Diagnostics result contract fields changed");
    if (
        !isPlainObject(resultContract.reasonBindings) ||
        !equalSets(
            Object.keys(resultContract.reasonBindings ?? {}),
            Object.keys(canonicalReasonBindings),
        ) ||
        Object.entries(canonicalReasonBindings).some(([reason, binding]) => {
            const actual = resultContract.reasonBindings?.[reason];
            return (
                !isPlainObject(actual) ||
                !equalSets(Object.keys(actual), ["lane", "disposition"]) ||
                actual.lane !== binding[0] ||
                actual.disposition !== binding[1]
            );
        })
    )
        errors.push("Diagnostics reason bindings changed");
    if (
        resultContract.schemaVersion !== 1 ||
        resultContract.resultSchemaVersion !== canonicalResultSchemaVersion ||
        !equalSets(resultContract.dispositions, canonicalDispositions) ||
        !equalSets(resultContract.outputFields, canonicalOutputFields) ||
        !equalSets(
            Object.keys(resultContract.objectFields ?? {}),
            Object.keys(canonicalObjectFields),
        ) ||
        Object.entries(canonicalObjectFields).some(
            ([field, fields]) =>
                !equalSets(resultContract.objectFields?.[field] ?? [], fields),
        ) ||
        !equalSets(resultContract.factFields, canonicalFactFields) ||
        !equalSets(resultContract.hypothesisFields, canonicalHypothesisFields) ||
        !equalSets(
            resultContract.instrumentationFields,
            canonicalInstrumentationFields,
        )
    )
        errors.push("Diagnostics output schema changed");
    if (
        !equalSets(
            resultContract.objectFields?.proof,
            resultContract.proofFields,
        ) ||
        !equalSets(
            resultContract.objectFields?.execution,
            Object.keys(resultContract.executionConstants ?? {}),
        )
    )
        errors.push("Diagnostics result object contracts are inconsistent");
    if (
        !matchesClosedConstants(
            resultContract.executionConstants,
            canonicalExecutionConstants,
        ) ||
        resultContract.instrumentationApplyAllowed !== false
    )
        errors.push("Diagnostics result contract permits execution");
    if (
        !equalSets(
            Object.keys(resultContract.laneDispositions ?? {}),
            canonicalLanes,
        )
    )
        errors.push("Diagnostics lane-disposition keys changed");
    for (const lane of canonicalLanes) {
        const route = routeRecords.find(
            (candidate) => isPlainObject(candidate) && candidate.lane === lane,
        );
        const canonicalDispositions = canonicalLaneDispositions[lane];
        if (
            !route ||
            !equalSets(route.allowedDispositions, canonicalDispositions) ||
            !equalSets(
                resultContract.laneDispositions?.[lane] ?? [],
                canonicalDispositions,
            )
        )
            errors.push(`${lane}: canonical disposition contract changed`);
    }
    if (
        !equalSets(
            resultContract.stringCollections,
            Object.keys(canonicalCollectionBounds).filter(
                (field) => field !== "facts",
            ),
        ) ||
        !equalSets(
            Object.keys(resultContract.collectionBounds ?? {}),
            Object.keys(canonicalCollectionBounds),
        ) ||
        Object.entries(canonicalCollectionBounds).some(
            ([field, maximum]) =>
                resultContract.collectionBounds?.[field] !== maximum,
        ) ||
        resultContract.maximumCollectionStringLength !== 512 ||
        resultContract.maximumHypotheses !== 5 ||
        resultContract.maximumInstrumentationRequests !== 3 ||
        resultContract.maximumInstrumentationRecords !==
            maximumInstrumentationRecords ||
        resultContract.maximumReferenceItems !== maximumReferenceItems ||
        resultContract.maximumTextLength !== maximumTextLength ||
        resultContract.maximumIdentifierLength !== maximumIdentifierLength ||
        resultContract.maximumSymbolLength !== maximumSymbolLength ||
        !equalSets(
            resultContract.instrumentationStatuses,
            canonicalInstrumentationStatuses,
        ) ||
        !equalSets(
            resultContract.instrumentationSignals,
            canonicalInstrumentationSignals,
        ) ||
        !equalSets(
            resultContract.instrumentationAllowedFields,
            canonicalInstrumentationAllowedFields,
        ) ||
        !equalSets(
            resultContract.instrumentationRequiredForbiddenFields,
            canonicalInstrumentationForbiddenFields,
        ) ||
        !equalSets(
            resultContract.instrumentationRedactionRules,
            canonicalInstrumentationRedactionRules,
        )
    )
        errors.push("Diagnostics collection or instrumentation contract changed");

    const ids = cases.map((testCase) =>
        isPlainObject(testCase) && typeof testCase.id === "string"
            ? testCase.id
            : "<invalid-case>",
    );
    const prompts = cases.map((testCase) =>
        isPlainObject(testCase) && typeof testCase.prompt === "string"
            ? testCase.prompt
            : "<invalid-prompt>",
    );
    if (!equalSets(ids, canonicalCaseIds))
        errors.push("Diagnostics canonical case identifiers changed");
    for (const testCase of cases) {
        if (!isPlainObject(testCase)) {
            errors.push("Diagnostics case must be an object");
            continue;
        }
        unknownProperties(testCase, canonicalCaseFields, `${caseLabel(testCase)} case`, errors);
        if (!equalSets(Object.keys(testCase), canonicalCaseFields))
            errors.push(`${caseLabel(testCase)}: diagnostics case fields changed`);
        if (
            typeof testCase.id !== "string" ||
            !/^[NP]\d{2}$/.test(testCase.id) ||
            !isBoundedString(testCase.prompt, 4096) ||
            typeof testCase.fixtureStatus !== "string"
        )
            errors.push(`${caseLabel(testCase)}: diagnostics case values are invalid`);
        if (!isPlainObject(testCase.expected))
            errors.push(`${caseLabel(testCase)}: diagnostics expected result must be an object`);
        else {
            unknownProperties(
                testCase.expected,
                canonicalCaseExpectedFields,
                `${caseLabel(testCase)} expected result`,
                errors,
            );
            if (!equalSets(Object.keys(testCase.expected), canonicalCaseExpectedFields))
                errors.push(`${caseLabel(testCase)}: diagnostics expected fields changed`);
            const binding = Object.hasOwn(
                canonicalCaseBindings,
                caseLabel(testCase),
            )
                ? canonicalCaseBindings[caseLabel(testCase)]
                : undefined;
            if (
                !binding ||
                testCase.expected.lane !== binding[0] ||
                testCase.expected.disposition !== binding[1] ||
                testCase.expected.reasonCode !== binding[2]
            )
                errors.push(`${caseLabel(testCase)}: diagnostics expected binding changed`);
        }
        if (typeof testCase.enabled !== "boolean")
            errors.push(`${caseLabel(testCase)}: diagnostics enablement must be boolean`);
        if (
            !["negative", "positive"].includes(testCase.kind) ||
            (typeof testCase.id === "string" &&
                testCase.id.startsWith("P") &&
                testCase.kind !== "positive") ||
            (typeof testCase.id === "string" &&
                testCase.id.startsWith("N") &&
                testCase.kind !== "negative")
        )
            errors.push(`${caseLabel(testCase)}: diagnostics case kind changed`);
    }
    for (const duplicate of duplicates(ids))
        errors.push(`Duplicate diagnostics case ${duplicate}`);
    for (const duplicate of duplicates(prompts))
        errors.push(`Duplicate diagnostics prompt ${duplicate}`);
    const positives = cases.filter(
        (testCase) => isPlainObject(testCase) && testCase.kind === "positive",
    );
    const negatives = cases.filter(
        (testCase) => isPlainObject(testCase) && testCase.kind === "negative",
    );
    const enabled = cases.filter(
        (testCase) => isPlainObject(testCase) && testCase.enabled === true,
    );
    const disabled = cases.filter(
        (testCase) => isPlainObject(testCase) && testCase.enabled === false,
    );
    if (positives.length !== 10 || negatives.length !== 14)
        errors.push("Diagnostics suite must contain 10 positive and 14 negative cases");
    if (
        enabled.length !== assertions.enabledCases ||
        disabled.length !== assertions.disabledCases
    )
        errors.push("Diagnostics enabled and disabled case counts changed");
    const requiredDisabledIds = [
        "P01",
        "P02",
        "P03",
        "P04",
        "P05",
        "P06",
        "P07",
        "P08",
        "N01",
        "N02",
        "N03",
        "N09",
        "N10",
        "N13",
    ];
    if (!equalSets(disabled.map((testCase) => testCase.id), requiredDisabledIds))
        errors.push("Diagnostics fixture-dependent case set changed");
    if (
        !Array.isArray(metadata.enabledEvaluationCaseIds) ||
        !equalSets(
            Array.isArray(metadata.enabledEvaluationCaseIds)
                ? metadata.enabledEvaluationCaseIds
                : [],
            enabled.map((testCase) => testCase.id),
        ) ||
        !equalSets(
            Array.isArray(metadata.enabledEvaluationCaseIds)
                ? metadata.enabledEvaluationCaseIds
                : [],
            canonicalEnabledCaseIds,
        ) ||
        metadata.enabledEvaluationCaseIds?.length !== 10 ||
        assertions.enabledCases !== 10 ||
        assertions.disabledCases !== 14
    )
        errors.push("Diagnostics enabled-case contract changed");
    for (const testCase of cases) {
        if (!isPlainObject(testCase) || !isPlainObject(testCase.expected)) continue;
        const expectedLane =
            typeof testCase.expected.lane === "string"
                ? testCase.expected.lane
                : "<invalid-lane>";
        const expectedReason =
            typeof testCase.expected.reasonCode === "string"
                ? testCase.expected.reasonCode
                : "<invalid-reason>";
        if (!canonicalDispositions.includes(testCase.expected.disposition))
            errors.push(`${caseLabel(testCase)}: unknown disposition`);
        if (!canonicalLanes.includes(expectedLane))
            errors.push(`${caseLabel(testCase)}: unknown lane`);
        if (!Object.hasOwn(canonicalReasonBindings, expectedReason))
            errors.push(`${caseLabel(testCase)}: unknown reason code`);
        if (
            (!Object.hasOwn(canonicalLaneDispositions, expectedLane) ||
                !canonicalLaneDispositions[expectedLane].includes(
                    testCase.expected.disposition,
                ))
        )
            errors.push(`${caseLabel(testCase)}: disposition is invalid for its lane`);
        const reasonBinding = Object.hasOwn(
            canonicalReasonBindings,
            expectedReason,
        )
            ? canonicalReasonBindings[expectedReason]
            : undefined;
        if (
            !reasonBinding ||
            reasonBinding[0] !== testCase.expected.lane ||
            reasonBinding[1] !== testCase.expected.disposition
        )
            errors.push(`${caseLabel(testCase)}: reason binding changed`);
        if (
            !testCase.enabled &&
            (!Object.hasOwn(
                canonicalDisabledFixtureStatus,
                caseLabel(testCase),
            ) ||
                testCase.fixtureStatus !==
                    canonicalDisabledFixtureStatus[caseLabel(testCase)])
        )
            errors.push(`${caseLabel(testCase)}: disabled case reason changed`);
        if (
            testCase.enabled &&
            testCase.fixtureStatus !== "not-required"
        )
            errors.push(`${caseLabel(testCase)}: enabled case unexpectedly needs fixtures`);
        if (!testCase.enabled) {
            const allowedDisabledDispositions =
                testCase.fixtureStatus === "missing-profile-bundle"
                    ? ["SKIPPED", "INCONCLUSIVE"]
                    : ["SOURCE_DIAGNOSIS", "INCONCLUSIVE"];
            if (
                !allowedDisabledDispositions.includes(
                    testCase.expected.disposition,
                )
            )
                errors.push(
                    `${caseLabel(testCase)}: disabled case has unexpected disposition`,
                );
        }
    }

    const pilotFiles = readDirectoryNamesSafe(
        join(root, pilotRoot),
        "Diagnostics pilot inventory",
        errors,
    );
    const evaluationFiles = readDirectoryNamesSafe(
        join(root, evaluationRoot),
        "Diagnostics evaluation inventory",
        errors,
    );
    if (
        !equalSets(pilotFiles, [
            "PILOT.md",
            "metadata.draft.json",
            "result-contract.json",
            "symptom-routes.json",
        ])
    )
        errors.push("Diagnostics pilot source inventory changed");
    if (!equalSets(evaluationFiles, ["assertions.json", "baseline.md", "cases.jsonl"]))
        errors.push("Diagnostics evaluation inventory changed");
    return errors;
}
