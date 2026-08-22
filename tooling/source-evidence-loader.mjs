// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import {
    lstatSync,
    opendirSync,
    readFileSync,
    realpathSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareOrdinal } from "./catalog-ordering.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);
const contractRelativeRoot = "evidence/source-evidence/contracts/v1";
const registryRelativePath =
    "evidence/source-evidence/registries/application-slice-diagnostics.v1.json";
const contractId = "cratis-source-evidence";
const contractRevision =
    "sha256:d19468453fc3040186034db5099dd3bd9f52b2c8e6256a2f1f70e8d3a59ce62f";
const registryRevision =
    "sha256:d0d7416c64624e225062bd74a543ab2f82b061cee4f522e6bd56a26fbee19e6c";
const sourceCaseIds = [
    "N09",
    "N10",
    "P01",
    "P02",
    "P03",
    "P04",
    "P05",
    "P06",
    "P07",
    "P08",
];
const normativeDigests = {
    "policy.json":
        "sha256:15e8d1dc88c63cf7e84ff1ab48a8d788a1a1aaf1fbb17796ee77ecbbbd54d4b5",
    "schemas/admission.schema.json":
        "sha256:7464e14d1fd6a765b972bf65a0ce0ca14cea2ad1535a14fa9fdf54479e7299fb",
    "schemas/bundle.schema.json":
        "sha256:7fbe3718608ab7370770b434364c91bbd1cb1eedbaa9b6671fd1fe5402ca618c",
    "schemas/contract-files.schema.json":
        "sha256:336a902f18b170fc02ecfdbee5ddf4abf5606941e7ebec2927e5fb9933de4464",
    "schemas/owner-attestation.schema.json":
        "sha256:6c2622d76f00054bd399e5fcd08a9713096d2eacd4b1c3a7d0b5268158e73fe0",
    "schemas/policy.schema.json":
        "sha256:34fefa4ef66b6da42b0b5d1386277eb0d810ef34cfbcf2eacf692ef89c971c36",
    "schemas/proof.schema.json":
        "sha256:d7099b116cf89928f2e3e6ab0dfebc8c8b3528ce84177e0fc1a7e6f194aab914",
    "schemas/redaction-review.schema.json":
        "sha256:2ff46cbfdd6e8b3c14d6892835f64e77b697ee081e9b1ab3f046b2d1e2e13da3",
    "schemas/registry.schema.json":
        "sha256:98980c501474f8187bd7d9e42d035147bad5d893518d024cffbf14c2140a15b6",
    "schemas/revocation.schema.json":
        "sha256:e62da81ac4ffd5516f515d016f0fa1a9cd557f00d07eeb12f5e0f3da4ac8432d",
    "schemas/source-verification.schema.json":
        "sha256:490e29604caf05ce792e7dd89393ecf9f475ad1c7e10b9600c0833bcc185552a",
};

function compareUnicodeCodePoint(left, right) {
    const leftPoints = Array.from(left, (character) => character.codePointAt(0));
    const rightPoints = Array.from(right, (character) => character.codePointAt(0));
    const length = Math.min(leftPoints.length, rightPoints.length);
    for (let index = 0; index < length; index++) {
        if (leftPoints[index] !== rightPoints[index])
            return leftPoints[index] - rightPoints[index];
    }
    return leftPoints.length - rightPoints.length;
}

function renderCanonicalJson(value, depth = 0) {
    const indentation = "  ".repeat(depth);
    const childIndentation = "  ".repeat(depth + 1);
    if (Array.isArray(value)) {
        if (value.length === 0) return "[]";
        return `[\n${value
            .map(
                (item) =>
                    `${childIndentation}${renderCanonicalJson(item, depth + 1)}`,
            )
            .join(",\n")}\n${indentation}]`;
    }
    if (value && typeof value === "object") {
        const keys = Object.keys(value).sort(compareUnicodeCodePoint);
        if (keys.length === 0) return "{}";
        return `{\n${keys
            .map(
                (key) =>
                    `${childIndentation}${JSON.stringify(key)}: ${renderCanonicalJson(value[key], depth + 1)}`,
            )
            .join(",\n")}\n${indentation}}`;
    }
    return JSON.stringify(value);
}

export function canonicalSourceEvidenceJson(value) {
    return `${renderCanonicalJson(value)}\n`;
}

const canonicalJsonText = canonicalSourceEvidenceJson;

function digest(content) {
    return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function exactNames(
    repositoryRoot,
    relativePath,
    expected,
    label,
    errors,
) {
    try {
        const root = realpathSync(repositoryRoot);
        const path = join(root, relativePath);
        const stat = lstatSync(path);
        if (!stat.isDirectory()) throw new Error("not a directory");
        const real = realpathSync(path);
        const fromRoot = relative(root, real);
        if (fromRoot.startsWith("..") || isAbsolute(fromRoot))
            throw new Error("directory escapes repository root");
        const entries = [];
        const directory = opendirSync(real);
        try {
            let entry;
            while ((entry = directory.readSync()) !== null) {
                if (entries.length >= 256)
                    throw new Error("inventory exceeds bounds");
                if (
                    entry.name.length > 128 ||
                    entry.name.normalize("NFC") !== entry.name ||
                    /[\u0000-\u001f\u007f-\u009f]/.test(entry.name)
                )
                    throw new Error("inventory name exceeds bounds");
                entries.push(entry);
            }
        } finally {
            directory.closeSync();
        }
        const names = entries.map((entry) => entry.name).sort(compareOrdinal);
        const sortedExpected = [...expected].sort(compareOrdinal);
        if (
            JSON.stringify(names) !== JSON.stringify(sortedExpected) ||
            entries.some(
                (entry) =>
                    !entry.isFile() && !entry.isDirectory(),
            )
        )
            errors.push(`${label} inventory changed`);
        return entries;
    } catch {
        errors.push(`${label} inventory is unavailable`);
        return [];
    }
}

function containedRegularFile(repositoryRoot, relativePath, maximumBytes, errors) {
    if (
        typeof relativePath !== "string" ||
        relativePath.includes("\\") ||
        isAbsolute(relativePath) ||
        relativePath.split("/").some((segment) => !segment || segment === "." || segment === "..")
    ) {
        errors.push(`${relativePath}: invalid source evidence path`);
        return null;
    }
    try {
        const root = realpathSync(repositoryRoot);
        const path = join(root, relativePath);
        const stat = lstatSync(path);
        if (!stat.isFile() || stat.size > maximumBytes)
            throw new Error("expected a bounded regular file");
        const real = realpathSync(path);
        const fromRoot = relative(root, real);
        if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot))
            throw new Error("file escapes repository root");
        return readFileSync(real, "utf8");
    } catch {
        errors.push(`${relativePath}: file is unavailable or invalid`);
        return null;
    }
}

function validateCanonicalValues(
    value,
    label,
    errors,
    depth = 0,
    state = { nodes: 0, failed: false },
) {
    if (state.failed) return;
    state.nodes++;
    if (depth > 32 || state.nodes > 10000) {
        errors.push(`${label}: JSON exceeds structural bounds`);
        state.failed = true;
        return;
    }
    if (typeof value === "string") {
        if (
            Buffer.byteLength(value, "utf8") > 8192 ||
            value.normalize("NFC") !== value ||
            /[\u0000-\u001f\u007f-\u009f]/.test(value)
        ) {
            errors.push(`${label}: string violates canonical JSON v1`);
            state.failed = true;
        }
        return;
    }
    if (typeof value === "number" && !Number.isSafeInteger(value)) {
        errors.push(`${label}: numbers must be safe integers`);
        state.failed = true;
        return;
    }
    if (Array.isArray(value)) {
        if (value.length > 1000) {
            errors.push(`${label}: array exceeds canonical bound`);
            state.failed = true;
            return;
        }
        for (const item of value) {
            validateCanonicalValues(item, label, errors, depth + 1, state);
            if (state.failed) break;
        }
        return;
    }
    if (value && typeof value === "object") {
        const keys = Object.keys(value);
        if (keys.length > 1000) {
            errors.push(`${label}: object exceeds canonical bound`);
            state.failed = true;
            return;
        }
        for (const key of keys) {
            validateCanonicalValues(key, label, errors, depth + 1, state);
            if (state.failed) break;
            validateCanonicalValues(value[key], label, errors, depth + 1, state);
            if (state.failed) break;
        }
    }
}

function parseCanonicalObject(content, label, errors) {
    if (content === null) return null;
    if (content.charCodeAt(0) === 0xfeff) errors.push(`${label}: BOM is forbidden`);
    let value;
    try {
        value = JSON.parse(content);
    } catch {
        errors.push(`${label}: invalid JSON`);
        return null;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        errors.push(`${label}: expected an object`);
        return null;
    }
    const validationErrorCount = errors.length;
    validateCanonicalValues(value, label, errors);
    if (errors.length > validationErrorCount) return null;
    if (content !== canonicalJsonText(value))
        errors.push(`${label}: bytes are not canonical JSON v1`);
    return value;
}

function assertClosedObjectSchemas(value, label, errors, depth = 0) {
    if (depth > 32) {
        errors.push(`${label}: schema exceeds depth bound`);
        return;
    }
    if (Array.isArray(value)) {
        for (const [index, item] of value.entries())
            assertClosedObjectSchemas(item, `${label}[${index}]`, errors, depth + 1);
        return;
    }
    if (!value || typeof value !== "object") return;
    if (value.type === "object" && value.additionalProperties !== false)
        errors.push(`${label}: object schema must set additionalProperties false`);
    for (const [key, nested] of Object.entries(value))
        assertClosedObjectSchemas(nested, `${label}.${key}`, errors, depth + 1);
}

function deepFreezeNullPrototype(value) {
    if (Array.isArray(value)) {
        for (const item of value) deepFreezeNullPrototype(item);
        return Object.freeze(value);
    }
    if (value && typeof value === "object") {
        Object.setPrototypeOf(value, null);
        for (const nested of Object.values(value)) deepFreezeNullPrototype(nested);
        return Object.freeze(value);
    }
    return value;
}

export function validateSourceEvidenceContract(
    repositoryRoot = defaultRepositoryRoot,
) {
    const errors = [];
    exactNames(
        repositoryRoot,
        "evidence/source-evidence",
        ["contracts", "registries"],
        "Source evidence root",
        errors,
    );
    exactNames(
        repositoryRoot,
        "evidence/source-evidence/contracts",
        ["v1"],
        "Source evidence contracts",
        errors,
    );
    exactNames(
        repositoryRoot,
        contractRelativeRoot,
        ["README.md", "contract-files.json", "policy.json", "schemas"],
        "Source evidence contract v1",
        errors,
    );
    exactNames(
        repositoryRoot,
        `${contractRelativeRoot}/schemas`,
        Object.keys(normativeDigests)
            .filter((path) => path.startsWith("schemas/"))
            .map((path) => path.slice("schemas/".length)),
        "Source evidence schemas",
        errors,
    );
    exactNames(
        repositoryRoot,
        "evidence/source-evidence/registries",
        ["application-slice-diagnostics.v1.json"],
        "Source evidence registries",
        errors,
    );

    containedRegularFile(
        repositoryRoot,
        `${contractRelativeRoot}/README.md`,
        65536,
        errors,
    );
    const lockContent = containedRegularFile(
        repositoryRoot,
        `${contractRelativeRoot}/contract-files.json`,
        65536,
        errors,
    );
    const lock = parseCanonicalObject(lockContent, "Source evidence contract lock", errors);
    const expectedEntries = Object.entries(normativeDigests)
        .sort(([left], [right]) => compareOrdinal(left, right))
        .map(([path, expectedDigest]) => ({ path, digest: expectedDigest }));
    if (
        !lock ||
        lock.schemaVersion !== "source-evidence-contract-files/v1" ||
        canonicalJsonText(lock.entries) !== canonicalJsonText(expectedEntries)
    )
        errors.push("Source evidence contract lock changed");
    if (lock && digest(canonicalJsonText(lock)) !== contractRevision)
        errors.push("Source evidence contract revision changed");

    for (const [path, expectedDigest] of Object.entries(normativeDigests)) {
        const content = containedRegularFile(
            repositoryRoot,
            `${contractRelativeRoot}/${path}`,
            65536,
            errors,
        );
        const value = parseCanonicalObject(
            content,
            `Source evidence ${path}`,
            errors,
        );
        if (content !== null && digest(content) !== expectedDigest)
            errors.push(`Source evidence ${path}: digest changed`);
        if (path.startsWith("schemas/") && value)
            assertClosedObjectSchemas(value, path, errors);
    }

    const registryContent = containedRegularFile(
        repositoryRoot,
        registryRelativePath,
        32768,
        errors,
    );
    const registry = parseCanonicalObject(
        registryContent,
        "Source evidence diagnostics registry",
        errors,
    );
    const expectedPayload = {
        contractId,
        contractRevision,
        phase: "CONTRACT_ONLY",
        admissions: [],
        revocations: [],
    };
    const expectedRegistry = {
        schemaVersion: "source-evidence-registry/v1",
        registryRevision,
        payload: expectedPayload,
    };
    if (
        !registry ||
        canonicalJsonText(registry) !== canonicalJsonText(expectedRegistry) ||
        digest(canonicalJsonText(expectedPayload)) !== registryRevision
    )
        errors.push("Source evidence diagnostics registry changed");
    return errors;
}

export function loadDiagnosticsSourceEvidence({
    repositoryRoot = defaultRepositoryRoot,
    evaluatedCaseId,
    expectedBundleRevision,
} = {}) {
    const errors = validateSourceEvidenceContract(repositoryRoot);
    if (!sourceCaseIds.includes(evaluatedCaseId))
        errors.push("SOURCE_CASE_NOT_ALLOWED");
    if (
        expectedBundleRevision !== undefined &&
        (typeof expectedBundleRevision !== "string" ||
            !/^sha256:[0-9a-f]{64}$/.test(expectedBundleRevision))
    )
        errors.push("EXPECTED_BUNDLE_REVISION_INVALID");
    const result = {
        status: "unavailable",
        authorityState: "CONTRACT_ONLY",
        code: "NO_ADMITTED_SOURCE_EVIDENCE",
        caseActivationAllowed: false,
        proof: null,
        errors: errors.slice(0, 64),
    };
    return deepFreezeNullPrototype(result);
}

export const sourceEvidenceContract = Object.freeze({
    contractId,
    contractRevision,
    registryRevision,
    sourceCaseIds: Object.freeze([...sourceCaseIds]),
});
