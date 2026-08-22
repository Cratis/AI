#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);
const pilotRoot = "pilots/evidence-bound-code-review";
const evaluationRoot = "evals/evidence-bound-code-review";
const caseIds = [
    "N01",
    "N02",
    "N03",
    "N04",
    "N05",
    "N06",
    "N07",
    "N08",
    "N09",
    "N10",
    "N11",
    "N12",
    "N13",
    "N14",
    "N15",
    "N16",
    "P01",
    "P02",
    "P03",
    "P04",
    "P05",
    "P06",
    "P07",
    "P08",
    "P09",
    "P10",
];
const positiveIds = [
    "P01",
    "P02",
    "P03",
    "P04",
    "P05",
    "P06",
    "P07",
    "P08",
    "P09",
    "P10",
];
const negativeIds = caseIds.filter((id) => id.startsWith("N"));
const supportedProfiles = [
    "APPLICATION",
    "FRAMEWORK",
    "CLIENT",
    "NON_CRATIS",
    "CORPUS",
];
const supportedDimensions = [
    "CORRECTNESS",
    "SECURITY",
    "PERFORMANCE",
    "ARCHITECTURE",
    "SPECS",
    "DOCUMENTATION",
];
const outcomes = [
    "FINDING",
    "NO_FINDINGS",
    "BLOCKED",
    "INCONCLUSIVE",
    "SKIPPED",
    "REFUSED",
];
const claimBases = ["ARTIFACT_ONLY", "ARTIFACT_AND_BOUND_AUTHORITY"];
const caseIdPattern = /^[NP]\d{2}$/;
const artifactRoles = [
    "REPOSITORY_INVENTORY",
    "PACKAGE_MANIFEST",
    "PROJECT_INSTRUCTIONS",
    "DIFF",
    "SOURCE_BEFORE",
    "SOURCE_AFTER",
    "SPEC",
    "DOCUMENTATION",
    "REPOSITORY_POLICY",
    "REQUEST_SPECIFICATION",
    "VERIFICATION_RECEIPT",
];
const requiredLimitations = [
    "BOUND_INPUT_ONLY",
    "EXTERNAL_REPOSITORY_CORRESPONDENCE_NOT_VERIFIED",
    "NO_AMBIENT_REPOSITORY_ACCESS",
    "NO_EXTERNAL_PRODUCT_AUTHORITY",
    "NO_EFFECT_TELEMETRY",
    "NOT_A_MERGE_OR_PROMOTION_DECISION",
];
const contractDigests = {
    "PILOT.md":
        "sha256:6f952bbb86a9f89334efdac8bb026ddc4873bacaaa6729488d0af6b9b6e2261d",
    "metadata.draft.json":
        "sha256:fb7db644736ed92396181b9ad6c01848a632f004e08e0b14f7f690b33c3c85b1",
    "result-contract.json":
        "sha256:d694891da9f21467c4bec9aa6bdab8b93a234d4f24c753f348d90ac5841d1658",
    "review-envelope-contract.json":
        "sha256:e518f0959fd955cf5597ad761e0ca22fefe20fbaea7dc6e604c70a58d19bb139",
    "routes.draft.json":
        "sha256:80a559919cf0476f9f1e2bff5019ece4c553525aa3a8fb241f0113a01a16f532",
    "../../evals/evidence-bound-code-review/assertions.json":
        "sha256:49f0b8689d64995c97011f4559367f23d47c456997cc80d6986a5cc9fec99a35",
};
const contractRevision =
    "sha256:2883543d7a37a95f813ad796e4ae2a36cce260a37463a10659551837e81b65be";
const casesDigest =
    "103c5e45442f173faf19e2083d4e9ebba34f7930441a0dd05ce2c112b491b1ff";
const fixtureManifestDigest =
    "a92a36bf6b4ac81342fa66d2abbb7b8e3c42b7e1a07e90f1c0e4237c9ee33453";
const expectedInvalidEnvelopes = {
    N03: {
        reason: "MISSING_REVIEW_ENVELOPE",
        errors: ["MISSING_REVIEW_ENVELOPE"],
    },
    N04: {
        reason: "DIGEST_MISMATCH",
        errors: ["ARTIFACT_FIELDS", "ENVELOPE_DIGEST", "FILE_ARTIFACT_BINDING"],
    },
    N05: { reason: "DIGEST_MISMATCH", errors: ["ENVELOPE_DIGEST"] },
    N06: {
        reason: "DIGEST_MISMATCH",
        errors: ["DIFF_MISMATCH", "ENVELOPE_DIGEST"],
    },
    N07: {
        reason: "DIGEST_MISMATCH",
        errors: ["ENVELOPE_DIGEST", "FILE_SET_DIGEST", "SCOPE_DIGEST"],
    },
};

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

export function canonicalizeReviewJson(value) {
    return `${renderCanonical(value)}\n`;
}
export function sha256CanonicalReviewJson(value) {
    return createHash("sha256")
        .update(canonicalizeReviewJson(value))
        .digest("hex");
}
function sha256(value) {
    return createHash("sha256").update(value).digest("hex");
}
function exactKeys(value, keys) {
    return (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        JSON.stringify(Object.keys(value).sort(compareCodePoints)) ===
            JSON.stringify([...keys].sort(compareCodePoints))
    );
}
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function safeError(error) {
    return error && typeof error.message === "string"
        ? error.message.replace(/(?:[A-Za-z]:)?[\\/][^\s]+/g, "<path>")
        : "unknown";
}

function cloneJson(root) {
    if (!root || typeof root !== "object") return { error: "expected object" };
    const stack = [
        { source: root, parent: null, key: null, depth: 0, ancestors: [] },
    ];
    let output;
    let nodes = 0;
    let bytes = 0;
    const assign = (parent, key, value) => {
        if (parent === null) output = value;
        else {
            const descriptor = Object.create(null);
            descriptor.value = value;
            descriptor.enumerable = true;
            descriptor.writable = true;
            descriptor.configurable = true;
            Object.defineProperty(parent, key, descriptor);
        }
    };
    while (stack.length) {
        const current = stack.pop();
        nodes++;
        if (nodes > 50000 || current.depth > 32)
            return { error: "structural bound" };
        const value = current.source;
        if (value === null || typeof value === "boolean") {
            bytes += 5;
            assign(current.parent, current.key, value);
            continue;
        }
        if (typeof value === "string") {
            if (
                value.normalize("NFC") !== value ||
                /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(
                    value,
                ) ||
                Buffer.byteLength(value) > 4096
            )
                return { error: "invalid string" };
            bytes += Buffer.byteLength(value);
            if (bytes > 1048576) return { error: "byte bound" };
            assign(current.parent, current.key, value);
            continue;
        }
        if (typeof value === "number") {
            if (!Number.isSafeInteger(value)) return { error: "unsafe number" };
            bytes += 24;
            assign(current.parent, current.key, value);
            continue;
        }
        if (!value || typeof value !== "object" || utilTypes.isProxy(value))
            return { error: "non-json value" };
        if (current.ancestors.includes(value)) return { error: "cycle" };
        try {
            const isArray = Array.isArray(value);
            const prototype = Object.getPrototypeOf(value);
            if (
                isArray
                    ? prototype !== Array.prototype
                    : prototype !== Object.prototype && prototype !== null
            )
                return { error: "prototype" };
            const descriptors = Object.getOwnPropertyDescriptors(value);
            const entries = Object.entries(descriptors).filter(
                ([key]) => !(isArray && key === "length"),
            );
            if (entries.length + stack.length + nodes > 50000)
                return { error: "node bound" };
            let target;
            if (isArray) {
                const length =
                    Object.hasOwn(descriptors, "length") &&
                    Object.hasOwn(descriptors.length, "value")
                        ? descriptors.length.value
                        : undefined;
                if (
                    !Number.isSafeInteger(length) ||
                    length < 0 ||
                    length > 50000 ||
                    entries.length !== length
                )
                    return { error: "sparse array" };
                target = Array.from({ length });
            } else target = Object.create(null);
            assign(current.parent, current.key, target);
            const ancestors = [...current.ancestors, value];
            for (let index = entries.length - 1; index >= 0; index--) {
                const [key, descriptor] = entries[index];
                if (
                    key.length > 4096 ||
                    descriptor.get ||
                    descriptor.set ||
                    !descriptor.enumerable ||
                    !Object.hasOwn(descriptor, "value") ||
                    key === "toJSON"
                )
                    return { error: "descriptor" };
                stack.push({
                    source: descriptor.value,
                    parent: target,
                    key,
                    depth: current.depth + 1,
                    ancestors,
                });
            }
        } catch {
            return { error: "inspection" };
        }
    }
    return { value: output };
}

function readContainedText(repositoryRoot, relativePath, maximumBytes, errors) {
    try {
        const root = realpathSync(repositoryRoot);
        const path = join(root, relativePath);
        const stat = lstatSync(path);
        if (!stat.isFile() || stat.size > maximumBytes)
            throw new Error("regular bounded file required");
        const real = realpathSync(path);
        const fromRoot = relative(root, real);
        if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot))
            throw new Error("escape");
        return readFileSync(real, "utf8");
    } catch (error) {
        errors.push(`${relativePath}: ${safeError(error)}`);
        return null;
    }
}

function readContainedJson(repositoryRoot, relativePath, maximumBytes, errors) {
    try {
        const root = realpathSync(repositoryRoot);
        const path = join(root, relativePath);
        const stat = lstatSync(path);
        if (!stat.isFile() || stat.size > maximumBytes)
            throw new Error("regular bounded file required");
        const real = realpathSync(path);
        const fromRoot = relative(root, real);
        if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot))
            throw new Error("escape");
        const content = readFileSync(real, "utf8");
        if (content.charCodeAt(0) === 0xfeff)
            errors.push(`${relativePath}: BOM`);
        let value;
        try {
            value = JSON.parse(content);
        } catch {
            errors.push(`${relativePath}: invalid JSON`);
            return null;
        }
        const cloned = cloneJson(value);
        if (cloned.error) {
            errors.push(`${relativePath}: ${cloned.error}`);
            return null;
        }
        value = cloned.value;
        if (content !== canonicalizeReviewJson(value))
            errors.push(`${relativePath}: noncanonical bytes`);
        return { value, content };
    } catch (error) {
        errors.push(`${relativePath}: ${safeError(error)}`);
        return null;
    }
}
function inventory(repositoryRoot, relativePath, expected, errors) {
    try {
        const root = realpathSync(repositoryRoot);
        const path = join(root, relativePath);
        if (!lstatSync(path).isDirectory())
            throw new Error("directory required");
        const real = realpathSync(path);
        const fromRoot = relative(root, real);
        if (fromRoot.startsWith("..") || isAbsolute(fromRoot))
            throw new Error("escape");
        const entries = readdirSync(real, { withFileTypes: true });
        const names = entries
            .map((entry) => entry.name)
            .sort(compareCodePoints);
        if (
            JSON.stringify(names) !==
                JSON.stringify([...expected].sort(compareCodePoints)) ||
            entries.some((entry) => !entry.isFile() && !entry.isDirectory())
        )
            errors.push(`${relativePath}: inventory changed`);
        return entries;
    } catch (error) {
        errors.push(`${relativePath}: ${safeError(error)}`);
        return [];
    }
}
function safePath(path) {
    return (
        typeof path === "string" &&
        path === path.normalize("NFC") &&
        !isAbsolute(path) &&
        !path.includes("\\") &&
        !/^[A-Za-z]:/.test(path) &&
        !/^\w+:\/\//.test(path) &&
        !/[\u0000-\u001f\u007f-\u009f]/.test(path) &&
        path
            .split("/")
            .every((segment) => segment && segment !== "." && segment !== "..")
    );
}

const envelopeFields = [
    "schemaVersion",
    "envelopeId",
    "repository",
    "revision",
    "scope",
    "artifacts",
    "suppliedVerificationReceiptRefs",
];
export function validateReviewEnvelope(input, { evaluatedCaseId } = {}) {
    const errors = [];
    const cloned = cloneJson(input);
    if (cloned.error) return [`ENVELOPE_${cloned.error}`];
    const envelope = cloned.value;
    if (!exactKeys(envelope, envelopeFields)) errors.push("ENVELOPE_FIELDS");
    if (envelope?.schemaVersion !== "1.0.0") errors.push("ENVELOPE_VERSION");
    const evaluatedCaseIdValid =
        typeof evaluatedCaseId === "string" &&
        caseIdPattern.test(evaluatedCaseId);
    const envelopeIdValid =
        typeof envelope?.envelopeId === "string" &&
        /^env-[np]\d{2}$/.test(envelope.envelopeId);
    if (!envelopeIdValid) errors.push("ENVELOPE_ID");
    if (!evaluatedCaseIdValid) errors.push("EVALUATED_CASE_ID");
    if (
        envelopeIdValid &&
        evaluatedCaseIdValid &&
        envelope.envelopeId !== `env-${evaluatedCaseId.toLowerCase()}`
    )
        errors.push("ENVELOPE_CASE_BINDING");
    const repository = exactKeys(envelope?.repository, [
        "opaqueId",
        "inventoryComplete",
        "inventoryArtifactRef",
        "profileEvidenceRefs",
    ])
        ? envelope.repository
        : Object.create(null);
    const revision = exactKeys(envelope?.revision, [
        "vcs",
        "baseRevision",
        "headRevision",
        "headTreeSha256",
        "diffArtifactRef",
        "diffSha256",
    ])
        ? envelope.revision
        : Object.create(null);
    const scope = exactKeys(envelope?.scope, [
        "mode",
        "requestedDimensions",
        "files",
        "excludedPaths",
        "fileSetSha256",
        "scopeSha256",
    ])
        ? envelope.scope
        : Object.create(null);
    const artifactList = Array.isArray(envelope?.artifacts)
        ? envelope.artifacts
        : [];
    const receiptRefs = Array.isArray(envelope?.suppliedVerificationReceiptRefs)
        ? envelope.suppliedVerificationReceiptRefs
        : [];

    if (
        !exactKeys(envelope?.repository, [
            "opaqueId",
            "inventoryComplete",
            "inventoryArtifactRef",
            "profileEvidenceRefs",
        ]) ||
        typeof repository.opaqueId !== "string" ||
        typeof repository.inventoryComplete !== "boolean" ||
        !Array.isArray(repository.profileEvidenceRefs)
    )
        errors.push("REPOSITORY_FIELDS");

    if (
        !exactKeys(envelope?.revision, [
            "vcs",
            "baseRevision",
            "headRevision",
            "headTreeSha256",
            "diffArtifactRef",
            "diffSha256",
        ]) ||
        revision.vcs !== "git" ||
        !/^git:[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(
            revision.baseRevision ?? "",
        ) ||
        !/^git:[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(
            revision.headRevision ?? "",
        ) ||
        !/^[0-9a-f]{64}$/.test(revision.headTreeSha256 ?? "") ||
        !/^[0-9a-f]{64}$/.test(revision.diffSha256 ?? "")
    )
        errors.push("REVISION_FIELDS");

    if (
        !exactKeys(envelope?.scope, [
            "mode",
            "requestedDimensions",
            "files",
            "excludedPaths",
            "fileSetSha256",
            "scopeSha256",
        ]) ||
        !["DIFF", "EMPTY"].includes(scope.mode) ||
        !Array.isArray(scope.requestedDimensions) ||
        scope.requestedDimensions.length === 0 ||
        scope.requestedDimensions.some(
            (dimension) => !supportedDimensions.includes(dimension),
        ) ||
        new Set(scope.requestedDimensions).size !==
            scope.requestedDimensions.length ||
        !Array.isArray(scope.files) ||
        scope.files.length > 32 ||
        !Array.isArray(scope.excludedPaths) ||
        scope.excludedPaths.some((path) => !safePath(path))
    )
        errors.push("SCOPE_FIELDS");

    if (
        !Array.isArray(envelope?.artifacts) ||
        envelope.artifacts.length === 0 ||
        envelope.artifacts.length > 64
    )
        errors.push("ARTIFACTS");
    const artifacts = new Map();
    for (const artifact of artifactList) {
        const artifactValid =
            artifact &&
            typeof artifact === "object" &&
            !Array.isArray(artifact) &&
            exactKeys(artifact, [
                "id",
                "role",
                "path",
                "mediaType",
                "sha256",
                "byteLength",
                "provenance",
                "content",
            ]) &&
            typeof artifact.id === "string" &&
            artifact.id.length > 0 &&
            artifactRoles.includes(artifact.role) &&
            safePath(artifact.path) &&
            typeof artifact.mediaType === "string" &&
            typeof artifact.content === "string" &&
            artifact.content.length <= 262144 &&
            sha256(artifact.content) === artifact.sha256 &&
            Buffer.byteLength(artifact.content) === artifact.byteLength &&
            artifact.provenance === "CLEAN_ROOM_SYNTHETIC";
        if (!artifactValid) {
            errors.push("ARTIFACT_FIELDS");
            continue;
        }
        if (artifacts.has(artifact.id)) {
            errors.push("DUPLICATE_ARTIFACT");
            continue;
        }
        artifacts.set(artifact.id, artifact);
    }

    const inventory = artifacts.get(repository.inventoryArtifactRef);
    const profileEvidenceRefs = Array.isArray(repository.profileEvidenceRefs)
        ? repository.profileEvidenceRefs
        : [];
    if (
        !inventory ||
        inventory.role !== "REPOSITORY_INVENTORY" ||
        profileEvidenceRefs.length !== 1 ||
        profileEvidenceRefs[0] !== repository.inventoryArtifactRef
    )
        errors.push("PROFILE_EVIDENCE");
    if (inventory) {
        try {
            const inventoryValue = JSON.parse(inventory.content);
            if (
                !inventoryValue ||
                typeof inventoryValue !== "object" ||
                inventoryValue.complete !== repository.inventoryComplete
            )
                errors.push("INVENTORY_COMPLETENESS");
        } catch {
            errors.push("PROFILE_INVENTORY");
        }
    }
    if (!Array.isArray(envelope?.suppliedVerificationReceiptRefs))
        errors.push("VERIFICATION_RECEIPT_REFS");
    if (receiptRefs.length > 0 && !evaluatedCaseIdValid)
        errors.push("EVALUATED_CASE_ID");
    for (const reference of receiptRefs) {
        const receipt = artifacts.get(reference);
        if (!receipt || receipt.role !== "VERIFICATION_RECEIPT") {
            errors.push("VERIFICATION_RECEIPT");
            continue;
        }
        if (!evaluatedCaseIdValid) {
            errors.push("VERIFICATION_RECEIPT_BINDING");
            continue;
        }
        try {
            const value = JSON.parse(receipt.content);
            const expectedReceipt = {
                schemaVersion: "1.0.0",
                caseId: evaluatedCaseId,
                repositoryOpaqueId: repository.opaqueId,
                headRevision: revision.headRevision,
                diffSha256: revision.diffSha256,
                scopeSha256: scope.scopeSha256,
                dimensions: scope.requestedDimensions,
                status: "SUPPLIED_ONLY",
            };
            if (
                canonicalizeReviewJson(value) !==
                canonicalizeReviewJson(expectedReceipt)
            )
                errors.push("VERIFICATION_RECEIPT_BINDING");
        } catch {
            errors.push("VERIFICATION_RECEIPT_BINDING");
        }
    }

    const diff = artifacts.get(revision.diffArtifactRef);
    if (!diff || diff.role !== "DIFF" || diff.sha256 !== revision.diffSha256)
        errors.push("DIFF_MISMATCH");

    const paths = new Set();
    const validFiles = [];
    const boundFiles = [];
    for (const file of Array.isArray(scope.files) ? scope.files : []) {
        if (!file || typeof file !== "object" || Array.isArray(file)) {
            errors.push("SCOPE_FILE");
            continue;
        }
        const fileValid =
            exactKeys(file, [
                "path",
                "beforeArtifactRef",
                "afterArtifactRef",
                "afterSha256",
                "changedLineRanges",
            ]) &&
            safePath(file.path) &&
            !paths.has(file.path) &&
            Array.isArray(file.changedLineRanges) &&
            file.changedLineRanges.length > 0 &&
            file.changedLineRanges.every(
                (range) =>
                    exactKeys(range, ["start", "end"]) &&
                    Number.isSafeInteger(range.start) &&
                    Number.isSafeInteger(range.end) &&
                    range.start >= 1 &&
                    range.end >= range.start,
            );
        if (!fileValid) {
            errors.push("SCOPE_FILE");
            continue;
        }
        paths.add(file.path);
        validFiles.push(file);
        const before = artifacts.get(file.beforeArtifactRef);
        const after = artifacts.get(file.afterArtifactRef);
        const fileArtifactsBound =
            before &&
            before.role === "SOURCE_BEFORE" &&
            before.path === file.path &&
            after &&
            after.role === "SOURCE_AFTER" &&
            after.path === file.path &&
            after.sha256 === file.afterSha256;
        if (fileArtifactsBound) boundFiles.push(file);
        else errors.push("FILE_ARTIFACT_BINDING");
        if (fileArtifactsBound && Array.isArray(file.changedLineRanges)) {
            const beforeLineCount = before.content.split("\n").length;
            const afterLineCount = after.content.split("\n").length;
            const sortedRanges = [...file.changedLineRanges].sort(
                (left, right) => left.start - right.start,
            );
            if (
                sortedRanges.some(
                    (range, index) =>
                        range.end > beforeLineCount ||
                        range.end > afterLineCount ||
                        (index > 0 &&
                            range.start <= sortedRanges[index - 1].end),
                )
            )
                errors.push("RANGE_OUT_OF_BOUNDS");
        }
        if (fileArtifactsBound && diff) {
            for (const range of file.changedLineRanges) {
                const count = range.end - range.start + 1;
                const beforeLines = before.content
                    .split("\n")
                    .slice(range.start - 1, range.end);
                const afterLines = after.content
                    .split("\n")
                    .slice(range.start - 1, range.end);
                const expectedHunk = [
                    `@@ -${range.start},${count} +${range.start},${count} @@`,
                    ...beforeLines.map((line) => `-${line}`),
                    ...afterLines.map((line) => `+${line}`),
                ].join("\n");
                if (
                    !diff.content.includes(`--- a/${file.path}\n`) ||
                    !diff.content.includes(`+++ b/${file.path}\n`) ||
                    !diff.content.includes(`${expectedHunk}\n`)
                )
                    errors.push("DIFF_CONTENT_BINDING");
            }
        }
    }

    if (diff && boundFiles.length > 0) {
        const expectedDiffParts = [];
        for (const file of boundFiles) {
            const before = artifacts.get(file.beforeArtifactRef);
            const after = artifacts.get(file.afterArtifactRef);
            if (!before || !after) continue;
            const beforeLines = before.content.split("\n");
            const afterLines = after.content.split("\n");
            const changedLines = new Set();
            expectedDiffParts.push(`--- a/${file.path}`, `+++ b/${file.path}`);
            for (const range of file.changedLineRanges) {
                const count = range.end - range.start + 1;
                expectedDiffParts.push(
                    `@@ -${range.start},${count} +${range.start},${count} @@`,
                );
                for (let line = range.start; line <= range.end; line++) {
                    changedLines.add(line);
                    expectedDiffParts.push(`-${beforeLines[line - 1]}`);
                }
                for (let line = range.start; line <= range.end; line++)
                    expectedDiffParts.push(`+${afterLines[line - 1]}`);
            }
            const maximumLines = Math.max(
                beforeLines.length,
                afterLines.length,
            );
            for (let line = 1; line <= maximumLines; line++) {
                if (
                    beforeLines[line - 1] !== afterLines[line - 1] &&
                    !changedLines.has(line)
                )
                    errors.push("UNDECLARED_SOURCE_CHANGE");
            }
        }
        const expectedDiff = `${expectedDiffParts.join("\n")}\n`;
        if (diff.content !== expectedDiff) errors.push("DIFF_CONTENT_BINDING");
    }
    if (scope.mode === "EMPTY" && diff?.content !== "")
        errors.push("NONEMPTY_EMPTY_DIFF");

    if (
        exactKeys(scope, [
            "mode",
            "requestedDimensions",
            "files",
            "excludedPaths",
            "fileSetSha256",
            "scopeSha256",
        ]) &&
        Array.isArray(scope.files)
    ) {
        const fileSet = validFiles
            .map((file) => ({ path: file.path, afterSha256: file.afterSha256 }))
            .sort((left, right) => compareCodePoints(left.path, right.path));
        if (sha256(canonicalizeReviewJson(fileSet)) !== scope.fileSetSha256)
            errors.push("FILE_SET_DIGEST");
        const { scopeSha256, ...scopePayload } = scope;
        if (sha256(canonicalizeReviewJson(scopePayload)) !== scopeSha256)
            errors.push("SCOPE_DIGEST");
    }
    if (
        scope.mode === "DIFF" &&
        Array.isArray(scope.files) &&
        scope.files.length === 0
    )
        errors.push("EMPTY_DIFF_SCOPE");
    if (
        scope.mode === "EMPTY" &&
        Array.isArray(scope.files) &&
        scope.files.length !== 0
    )
        errors.push("NONEMPTY_EMPTY_SCOPE");
    return [...new Set(errors)].sort(compareCodePoints);
}

function loadCorpus(repositoryRoot, errors) {
    const path = `${evaluationRoot}/cases.jsonl`;
    const content = readContainedText(repositoryRoot, path, 2097152, errors);
    if (content !== null && sha256(content) !== casesDigest)
        errors.push("CASES_DIGEST");
    const casesFile = readContainedJsonLines(repositoryRoot, path, errors);
    return new Map(
        casesFile
            .filter((item) => item && typeof item.id === "string")
            .map((item) => [item.id, item]),
    );
}
function readContainedJsonLines(repositoryRoot, relativePath, errors) {
    try {
        const root = realpathSync(repositoryRoot);
        const path = join(root, relativePath);
        const stat = lstatSync(path);
        if (!stat.isFile() || stat.size > 2097152)
            throw new Error("regular bounded file required");
        const real = realpathSync(path);
        if (relative(root, real).startsWith("..")) throw new Error("escape");
        const records = [];
        for (const [index, line] of readFileSync(real, "utf8")
            .split(/\r?\n/)
            .filter(Boolean)
            .entries()) {
            try {
                const parsed = JSON.parse(line);
                const cloned = cloneJson(parsed);
                if (cloned.error)
                    errors.push(`${relativePath}:${index + 1}:${cloned.error}`);
                else records.push(cloned.value);
            } catch {
                errors.push(`${relativePath}:${index + 1}:invalid JSON`);
            }
        }
        return records;
    } catch (error) {
        errors.push(`${relativePath}:${safeError(error)}`);
        return [];
    }
}

export function validateReviewResult(
    input,
    { repositoryRoot = defaultRepositoryRoot, evaluatedCaseId } = {},
) {
    const errors = [];
    if (
        typeof evaluatedCaseId !== "string" ||
        !caseIdPattern.test(evaluatedCaseId)
    )
        errors.push("EVALUATED_CASE_ID");
    const cases = loadCorpus(repositoryRoot, errors);
    const testCase = cases.get(evaluatedCaseId);
    const cloned = cloneJson(input);
    if (cloned.error) return [...errors, `RESULT_${cloned.error}`];
    if (!testCase) {
        errors.push("CASE_NOT_FOUND");
        return [...new Set(errors)].sort(compareCodePoints);
    }
    const result = cloned.value;
    if (
        canonicalizeReviewJson(result) !==
        canonicalizeReviewJson(testCase.expected)
    )
        errors.push("RESULT_ORACLE_MISMATCH");
    if (result.evaluatedCaseId !== evaluatedCaseId)
        errors.push("RESULT_CASE_MISMATCH");
    return [...new Set(errors)].sort(compareCodePoints);
}

function validateExpectedResult(
    testCase,
    envelope,
    declaredEnvelopeSha256,
    errors,
) {
    const expected = testCase.expected;
    if (!isRecord(expected)) {
        errors.push(`${testCase.id}:EXPECTED_RESULT_MISSING`);
        return;
    }
    const expectedLimitations = Array.isArray(expected.limitations)
        ? expected.limitations
        : [];
    const expectedFindings = Array.isArray(expected.findings)
        ? expected.findings
        : [];
    const dimensionResults = Array.isArray(expected.dimensionResults)
        ? expected.dimensionResults
        : [];
    const reviewBinding = isRecord(expected.reviewBinding)
        ? expected.reviewBinding
        : Object.create(null);
    const profile = isRecord(expected.profile)
        ? expected.profile
        : Object.create(null);
    const suppliedReceiptRefs = Array.isArray(
        expected.suppliedVerificationReceiptRefs,
    )
        ? expected.suppliedVerificationReceiptRefs
        : [];
    const expectedCaseInputSha256 = sha256(
        canonicalizeReviewJson({
            caseId: testCase.id,
            prompt: testCase.prompt,
            suppliedEnvelopeSha256: declaredEnvelopeSha256,
        }),
    );
    if (
        expected.requestBinding?.caseInputSha256 !== expectedCaseInputSha256 ||
        expected.requestBinding?.suppliedEnvelopeSha256 !==
            declaredEnvelopeSha256
    )
        errors.push(`${testCase.id}:REQUEST_BINDING`);
    if (!supportedProfiles.includes(profile.value) && profile.value !== null)
        errors.push(`${testCase.id}:PROFILE`);
    if (!outcomes.includes(expected.outcome))
        errors.push(`${testCase.id}:OUTCOME`);
    if (
        !Array.isArray(expected.limitations) ||
        !requiredLimitations.every((code) => expectedLimitations.includes(code))
    )
        errors.push(`${testCase.id}:LIMITATIONS`);
    const findingOutcome = expected.outcome === "FINDING";
    if (
        !Array.isArray(expected.findings) ||
        (findingOutcome && expectedFindings.length === 0) ||
        (!findingOutcome && expectedFindings.length > 0)
    )
        errors.push(`${testCase.id}:FINDING_CARDINALITY`);
    if (
        expected.outcome === "NO_FINDINGS" &&
        !expectedLimitations.includes("NO_FINDINGS_IS_NOT_DEFECT_FREE")
    )
        errors.push(`${testCase.id}:NO_FINDINGS_LIMITATION`);
    if (
        ["FINDING", "NO_FINDINGS", "INCONCLUSIVE"].includes(expected.outcome) &&
        reviewBinding.status !== "BOUND"
    )
        errors.push(`${testCase.id}:BOUND_REVIEW_REQUIRED`);
    if (expected.outcome === "BLOCKED" && reviewBinding.status !== "NOT_BOUND")
        errors.push(`${testCase.id}:BLOCKED_BINDING`);
    if (
        expected.outcome === "REFUSED" &&
        reviewBinding.status !== "NOT_REVIEWED"
    )
        errors.push(`${testCase.id}:REFUSED_BINDING`);
    if (!envelope) return;
    const envelopeArtifacts = Array.isArray(envelope.artifacts)
        ? envelope.artifacts.filter(isRecord)
        : [];
    const scope = isRecord(envelope.scope)
        ? envelope.scope
        : Object.create(null);
    const scopeFiles = Array.isArray(scope.files)
        ? scope.files.filter(isRecord)
        : [];
    const requestedScopeDimensions = Array.isArray(scope.requestedDimensions)
        ? scope.requestedDimensions
        : [];
    const envelopeReceiptRefs = Array.isArray(
        envelope.suppliedVerificationReceiptRefs,
    )
        ? envelope.suppliedVerificationReceiptRefs
        : [];
    const artifacts = new Map(
        envelopeArtifacts.map((artifact) => [artifact.id, artifact]),
    );
    if (reviewBinding.status === "BOUND") {
        const expectedFiles = scopeFiles.map((file) => ({
            path: file.path,
            afterSha256: file.afterSha256,
        }));
        if (
            reviewBinding.repositoryOpaqueId !== envelope.repository.opaqueId ||
            reviewBinding.baseRevision !== envelope.revision.baseRevision ||
            reviewBinding.headRevision !== envelope.revision.headRevision ||
            reviewBinding.diffSha256 !== envelope.revision.diffSha256 ||
            reviewBinding.scopeSha256 !== scope.scopeSha256 ||
            reviewBinding.fileSetSha256 !== scope.fileSetSha256 ||
            !Array.isArray(reviewBinding.files) ||
            canonicalizeReviewJson(reviewBinding.files) !==
                canonicalizeReviewJson(expectedFiles)
        )
            errors.push(`${testCase.id}:REVIEW_BINDING`);
    }
    if (
        !Array.isArray(expected.suppliedVerificationReceiptRefs) ||
        canonicalizeReviewJson(suppliedReceiptRefs) !==
            canonicalizeReviewJson(envelopeReceiptRefs)
    )
        errors.push(`${testCase.id}:RECEIPT_BINDING`);
    if (
        reviewBinding.status === "BOUND" &&
        dimensionResults.length !== requestedScopeDimensions.length
    )
        errors.push(`${testCase.id}:DIMENSION_COVERAGE`);
    const dimensionIds = new Set();
    const requestedDimensions = new Set();
    const reviewedDimensions = new Set();
    for (const dimensionResult of dimensionResults) {
        if (!isRecord(dimensionResult)) {
            errors.push(`${testCase.id}:DIMENSION_BINDING`);
            continue;
        }
        const requestedDimensionValid =
            typeof dimensionResult.requestedDimension === "string" &&
            supportedDimensions.includes(dimensionResult.requestedDimension);
        const reviewedDimensionValid =
            dimensionResult.reviewedDimension === null ||
            (typeof dimensionResult.reviewedDimension === "string" &&
                supportedDimensions.includes(
                    dimensionResult.reviewedDimension,
                ));
        let expectedRoute = null;
        if (dimensionResult.status === "SKIPPED")
            expectedRoute = "OUT_OF_SCOPE_REVIEW";
        else if (
            reviewedDimensionValid &&
            dimensionResult.reviewedDimension !== null
        )
            expectedRoute = `${dimensionResult.reviewedDimension}_REVIEW`;
        const expectedFindingRefs = expectedFindings
            .filter(
                (finding) =>
                    isRecord(finding) &&
                    finding.dimension === dimensionResult.reviewedDimension,
            )
            .map((finding) => finding.id);
        if (
            !requestedDimensionValid ||
            !reviewedDimensionValid ||
            dimensionIds.has(dimensionResult.id) ||
            requestedDimensions.has(dimensionResult.requestedDimension) ||
            !requestedScopeDimensions.includes(
                dimensionResult.requestedDimension,
            ) ||
            (dimensionResult.reviewedDimension !== null &&
                !requestedScopeDimensions.includes(
                    dimensionResult.reviewedDimension,
                )) ||
            dimensionResult.routeId !== expectedRoute ||
            dimensionResult.status !== expected.outcome ||
            !Array.isArray(dimensionResult.basisRefs) ||
            dimensionResult.basisRefs.some(
                (reference) => !artifacts.has(reference),
            ) ||
            canonicalizeReviewJson(dimensionResult.findingRefs) !==
                canonicalizeReviewJson(expectedFindingRefs)
        )
            errors.push(`${testCase.id}:DIMENSION_BINDING`);
        dimensionIds.add(dimensionResult.id);
        requestedDimensions.add(dimensionResult.requestedDimension);
        if (
            reviewedDimensionValid &&
            dimensionResult.reviewedDimension !== null
        )
            reviewedDimensions.add(dimensionResult.reviewedDimension);
    }
    if (scope.mode === "EMPTY") {
        if (
            scopeFiles.length !== 0 ||
            expected.outcome !== "SKIPPED" ||
            expected.outcomeReasonCode !== "EMPTY_REVIEWABLE_SCOPE" ||
            expectedFindings.length !== 0 ||
            reviewBinding.status !== "BOUND"
        )
            errors.push(`${testCase.id}:EMPTY_SCOPE_OUTCOME`);
    }
    let inventory;
    try {
        inventory = JSON.parse(
            artifacts.get(envelope.repository.inventoryArtifactRef)?.content ??
                "null",
        );
    } catch {
        errors.push(`${testCase.id}:PROFILE_INVENTORY`);
    }
    if (
        reviewBinding.status === "BOUND" &&
        canonicalizeReviewJson(
            Array.isArray(profile.evidenceRefs) ? profile.evidenceRefs : [],
        ) !== canonicalizeReviewJson(envelope.repository.profileEvidenceRefs)
    )
        errors.push(`${testCase.id}:PROFILE_EVIDENCE_BINDING`);
    if (reviewBinding.status === "BOUND" && profile.status === "CLASSIFIED") {
        if (
            !inventory ||
            inventory.complete !== true ||
            inventory.profile !== profile.value
        )
            errors.push(`${testCase.id}:PROFILE_DERIVATION`);
    } else if (
        reviewBinding.status === "BOUND" &&
        profile.status === "UNRESOLVED" &&
        inventory?.complete === true &&
        !Array.isArray(inventory?.profiles)
    )
        errors.push(`${testCase.id}:PROFILE_SHOULD_RESOLVE`);
    const changedPaths = new Set(scopeFiles.map((file) => file.path));
    const suppliedAuthorityRefs = envelopeArtifacts
        .filter((artifact) =>
            ["REPOSITORY_POLICY", "REQUEST_SPECIFICATION"].includes(
                artifact.role,
            ),
        )
        .map((artifact) => artifact.id);
    for (const finding of expectedFindings) {
        if (!isRecord(finding)) {
            errors.push(`${testCase.id}:FINDING_FIELDS`);
            continue;
        }
        if (!reviewedDimensions.has(finding.dimension))
            errors.push(`${testCase.id}:${finding.id}:FINDING_DIMENSION`);
        const findingEvidence = Array.isArray(finding.evidence)
            ? finding.evidence
            : [];
        if (findingEvidence.length === 0)
            errors.push(`${testCase.id}:${finding.id}:EVIDENCE_REQUIRED`);
        let changedEvidence = false;
        for (const evidence of findingEvidence) {
            if (!isRecord(evidence)) {
                errors.push(`${testCase.id}:${finding.id}:EVIDENCE_BINDING`);
                continue;
            }
            const artifact = artifacts.get(evidence.artifactRef);
            if (!artifact || artifact.sha256 !== evidence.artifactSha256)
                errors.push(`${testCase.id}:${finding.id}:EVIDENCE_BINDING`);
            if (evidence.kind === "FILE_LINES") {
                const scopedFile = scopeFiles.find(
                    (file) => file.path === evidence.path,
                );
                const scopedRanges = Array.isArray(
                    scopedFile?.changedLineRanges,
                )
                    ? scopedFile.changedLineRanges.filter(isRecord)
                    : [];
                const rangeBound =
                    scopedFile &&
                    Number.isSafeInteger(evidence.startLine) &&
                    Number.isSafeInteger(evidence.endLine) &&
                    evidence.startLine <= evidence.endLine &&
                    scopedRanges.some(
                        (range) =>
                            evidence.startLine >= range.start &&
                            evidence.endLine <= range.end,
                    );
                if (
                    !changedPaths.has(evidence.path) ||
                    !rangeBound ||
                    evidence.scopeRole !== "CHANGED" ||
                    evidence.artifactRef !== scopedFile?.afterArtifactRef ||
                    evidence.artifactSha256 !== scopedFile?.afterSha256 ||
                    artifact?.role !== "SOURCE_AFTER" ||
                    artifact.path !== scopedFile?.path ||
                    artifact.sha256 !== scopedFile?.afterSha256
                )
                    errors.push(
                        `${testCase.id}:${finding.id}:CHANGED_EVIDENCE`,
                    );
                else {
                    const lines = artifact.content.split("\n");
                    const excerpt = lines
                        .slice(evidence.startLine - 1, evidence.endLine)
                        .join("\n");
                    if (sha256(excerpt) !== evidence.excerptSha256)
                        errors.push(
                            `${testCase.id}:${finding.id}:EXCERPT_DIGEST`,
                        );
                    changedEvidence = true;
                }
            }
        }
        if (!changedEvidence)
            errors.push(`${testCase.id}:${finding.id}:NO_CHANGED_EVIDENCE`);
        const authorityRefs = Array.isArray(finding.authorityRefs)
            ? finding.authorityRefs
            : [];
        if (!claimBases.includes(finding.claimBasis))
            errors.push(`${testCase.id}:${finding.id}:CLAIM_BASIS`);
        if (
            finding.claimBasis === "ARTIFACT_ONLY" &&
            (!Array.isArray(finding.authorityRefs) ||
                authorityRefs.length !== 0 ||
                suppliedAuthorityRefs.length !== 0)
        )
            errors.push(`${testCase.id}:${finding.id}:AUTHORITY_BINDING`);
        if (finding.claimBasis === "ARTIFACT_AND_BOUND_AUTHORITY") {
            const dimensionResult = dimensionResults.find(
                (item) =>
                    isRecord(item) &&
                    item.reviewedDimension === finding.dimension,
            );
            const basisRefs = Array.isArray(dimensionResult?.basisRefs)
                ? dimensionResult.basisRefs
                : [];
            if (
                !Array.isArray(finding.authorityRefs) ||
                authorityRefs.length === 0 ||
                canonicalizeReviewJson(authorityRefs) !==
                    canonicalizeReviewJson(suppliedAuthorityRefs) ||
                new Set(authorityRefs).size !== authorityRefs.length ||
                authorityRefs.some((reference) => {
                    const artifact = artifacts.get(reference);
                    return (
                        !artifact ||
                        ![
                            "REPOSITORY_POLICY",
                            "REQUEST_SPECIFICATION",
                        ].includes(artifact.role) ||
                        !basisRefs.includes(reference)
                    );
                })
            )
                errors.push(`${testCase.id}:${finding.id}:AUTHORITY_BINDING`);
        }
        if (
            ["ARCHITECTURE", "SPECS"].includes(finding.dimension) &&
            finding.claimBasis !== "ARTIFACT_AND_BOUND_AUTHORITY"
        )
            errors.push(`${testCase.id}:${finding.id}:AUTHORITY_BINDING`);
    }
}

export function validateCodeReviewPilot(
    repositoryRoot = defaultRepositoryRoot,
) {
    const errors = [];
    const pilotFiles = [
        "PILOT.md",
        "contract-lock.json",
        "metadata.draft.json",
        "result-contract.json",
        "review-envelope-contract.json",
        "routes.draft.json",
    ];
    inventory(repositoryRoot, pilotRoot, pilotFiles, errors);
    inventory(
        repositoryRoot,
        evaluationRoot,
        ["assertions.json", "baseline.md", "cases.jsonl", "fixtures"],
        errors,
    );
    inventory(
        repositoryRoot,
        `${evaluationRoot}/fixtures`,
        ["envelopes", "manifest.json"],
        errors,
    );
    inventory(
        repositoryRoot,
        `${evaluationRoot}/fixtures/envelopes`,
        caseIds.map((id) => `${id}.json`),
        errors,
    );

    for (const [path, expectedDigest] of Object.entries(contractDigests)) {
        const relativePath = path.startsWith("../")
            ? `${evaluationRoot}/assertions.json`
            : `${pilotRoot}/${path}`;
        const content =
            path === "PILOT.md"
                ? readContainedText(
                      repositoryRoot,
                      relativePath,
                      1048576,
                      errors,
                  )
                : readContainedJson(
                      repositoryRoot,
                      relativePath,
                      1048576,
                      errors,
                  )?.content;
        if (
            content !== null &&
            content !== undefined &&
            sha256(content) !== expectedDigest.slice(7)
        )
            errors.push(`${relativePath}: digest changed`);
    }

    const metadataRead = readContainedJson(
        repositoryRoot,
        `${pilotRoot}/metadata.draft.json`,
        65536,
        errors,
    );
    if (metadataRead) {
        const metadata = metadataRead.value;
        if (
            JSON.stringify(metadata.supportedProfiles) !==
                JSON.stringify(supportedProfiles) ||
            JSON.stringify(metadata.supportedDimensions) !==
                JSON.stringify(supportedDimensions) ||
            JSON.stringify(metadata.outcomes) !== JSON.stringify(outcomes) ||
            metadata.persistedModelRuns !== 0 ||
            Object.values(metadata.permissions ?? {}).some(
                (value) => value !== false,
            )
        )
            errors.push("METADATA_CONTRACT");
    }

    const lockRead = readContainedJson(
        repositoryRoot,
        `${pilotRoot}/contract-lock.json`,
        65536,
        errors,
    );
    if (lockRead) {
        const expectedEntries = Object.entries(contractDigests).map(
            ([path, digest]) => ({ path, digest }),
        );
        const expectedPayload = {
            schemaVersion: "1.0.0",
            entries: expectedEntries,
        };
        const { contractRevision: declaredRevision, ...payload } =
            lockRead.value;
        if (
            canonicalizeReviewJson(payload) !==
                canonicalizeReviewJson(expectedPayload) ||
            declaredRevision !== contractRevision ||
            sha256CanonicalReviewJson(expectedPayload) !==
                contractRevision.slice(7)
        )
            errors.push("CONTRACT_REVISION");
    }

    const assertionsRead = readContainedJson(
        repositoryRoot,
        `${evaluationRoot}/assertions.json`,
        65536,
        errors,
    );
    if (assertionsRead) {
        const assertions = assertionsRead.value;
        if (
            assertions.positiveCases !== 10 ||
            assertions.negativeCases !== 16 ||
            assertions.totalCases !== 26 ||
            assertions.modelRuns !== 0 ||
            assertions.runtimeEligible !== false
        )
            errors.push("ASSERTIONS");
    }

    const cases = loadCorpus(repositoryRoot, errors);
    if (
        JSON.stringify([...cases.keys()].sort(compareCodePoints)) !==
        JSON.stringify(caseIds)
    )
        errors.push("CASE_INVENTORY");
    const actualPositive = [...cases.values()]
        .filter((item) => item.kind === "positive")
        .map((item) => item.id)
        .sort(compareCodePoints);
    const actualNegative = [...cases.values()]
        .filter((item) => item.kind === "negative")
        .map((item) => item.id)
        .sort(compareCodePoints);
    if (
        JSON.stringify(actualPositive) !==
            JSON.stringify([...positiveIds].sort(compareCodePoints)) ||
        JSON.stringify(actualNegative) !==
            JSON.stringify([...negativeIds].sort(compareCodePoints))
    )
        errors.push("CASE_KINDS");

    const manifestRead = readContainedJson(
        repositoryRoot,
        `${evaluationRoot}/fixtures/manifest.json`,
        131072,
        errors,
    );
    if (manifestRead && sha256(manifestRead.content) !== fixtureManifestDigest)
        errors.push("MANIFEST_DIGEST");
    const manifest = manifestRead?.value;
    const manifestEntries = Array.isArray(manifest?.entries)
        ? manifest.entries
        : [];
    if (
        JSON.stringify(
            manifestEntries
                .map((entry) => entry.caseId)
                .sort(compareCodePoints),
        ) !== JSON.stringify(caseIds)
    )
        errors.push("MANIFEST_CASES");
    if (manifest) {
        const { manifestRevision, ...payload } = manifest;
        if (sha256(canonicalizeReviewJson(payload)) !== manifestRevision)
            errors.push("MANIFEST_REVISION");
    }

    for (const id of caseIds) {
        const fixtureRead = readContainedJson(
            repositoryRoot,
            `${evaluationRoot}/fixtures/envelopes/${id}.json`,
            1048576,
            errors,
        );
        if (!fixtureRead) continue;
        const wrapper = fixtureRead.value;
        const entry = manifestEntries.find(
            (candidate) => candidate.caseId === id,
        );
        if (
            !entry ||
            entry.filename !== `${id}.json` ||
            entry.digest !== sha256(fixtureRead.content)
        )
            errors.push(`${id}:MANIFEST_BINDING`);
        if (wrapper.caseId !== id) errors.push(`${id}:WRAPPER_CASE`);
        const testCase = cases.get(id);
        if (
            !testCase ||
            testCase.envelopeRef !== `${id}.json` ||
            testCase.caseInputSha256 !==
                sha256(
                    canonicalizeReviewJson({
                        caseId: id,
                        prompt: testCase.prompt,
                        suppliedEnvelopeSha256: wrapper.declaredEnvelopeSha256,
                    }),
                )
        )
            errors.push(`${id}:CASE_BINDING`);

        let envelopeErrors = [];
        if (wrapper.envelope === null) {
            if (id !== "N03") errors.push(`${id}:MISSING_ENVELOPE`);
        } else {
            envelopeErrors = validateReviewEnvelope(wrapper.envelope, {
                evaluatedCaseId: id,
            });
            const actualDigest = sha256(
                canonicalizeReviewJson(wrapper.envelope),
            );
            if (actualDigest !== wrapper.declaredEnvelopeSha256)
                envelopeErrors.push("ENVELOPE_DIGEST");
        }
        const expectedInvalid = expectedInvalidEnvelopes[id];
        if (expectedInvalid) {
            if (
                testCase?.expected?.outcomeReasonCode !== expectedInvalid.reason
            )
                errors.push(`${id}:INVALID_REASON_ORACLE`);
            const actualErrors =
                id === "N03" && wrapper.envelope === null
                    ? ["MISSING_REVIEW_ENVELOPE"]
                    : [...new Set(envelopeErrors)].sort(compareCodePoints);
            if (
                JSON.stringify(actualErrors) !==
                JSON.stringify(
                    [...expectedInvalid.errors].sort(compareCodePoints),
                )
            )
                errors.push(`${id}:INVALID_ERROR_SET`);
        } else if (envelopeErrors.length > 0)
            errors.push(`${id}:VALID_ENVELOPE:${envelopeErrors.join("|")}`);

        if (testCase) {
            validateExpectedResult(
                testCase,
                envelopeErrors.length === 0 ? wrapper.envelope : null,
                wrapper.declaredEnvelopeSha256,
                errors,
            );
            if (
                validateReviewResult(testCase.expected, {
                    repositoryRoot,
                    evaluatedCaseId: id,
                }).length > 0
            )
                errors.push(`${id}:EXPECTED_RESULT`);
        }
    }
    return [...new Set(errors)].sort(compareCodePoints);
}

function main() {
    const errors = validateCodeReviewPilot();
    if (errors.length) {
        process.stderr.write(
            `Code review pilot validation failed with ${errors.length} error(s):\n`,
        );
        for (const error of errors) process.stderr.write(`- ${error}\n`);
        process.exitCode = 1;
    } else
        process.stdout.write(
            "Code review pilot validation passed: 26 cases, zero model runs.\n",
        );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
