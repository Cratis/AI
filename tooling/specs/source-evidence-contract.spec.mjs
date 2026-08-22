// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    renameSync,
    rmSync,
    symlinkSync,
    unlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
    canonicalSourceEvidenceJson,
    loadDiagnosticsSourceEvidence,
    sourceEvidenceContract,
    validateSourceEvidenceContract,
} from "../source-evidence-loader.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);

function withFixture(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-source-evidence-"));
    try {
        cpSync(
            join(repositoryRoot, "evidence"),
            join(root, "evidence"),
            { recursive: true },
        );
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function hashTree(path) {
    const files = [];
    function walk(current, relativePath = "") {
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const child = join(current, entry.name);
            const childRelative = relativePath
                ? `${relativePath}/${entry.name}`
                : entry.name;
            if (entry.isDirectory()) walk(child, childRelative);
            else
                files.push([
                    childRelative,
                    createHash("sha256")
                        .update(readFileSync(child))
                        .digest("hex"),
                ]);
        }
    }
    walk(path);
    return files.sort(([left], [right]) => left.localeCompare(right));
}

function canonicalJson(value) {
    function sort(item) {
        if (Array.isArray(item)) return item.map(sort);
        if (item && typeof item === "object")
            return Object.fromEntries(
                Object.keys(item)
                    .sort()
                    .map((key) => [key, sort(item[key])]),
            );
        return item;
    }
    return `${JSON.stringify(sort(value), null, 2)}\n`;
}

test("source evidence contract and empty registry pass", () => {
    assert.deepEqual(validateSourceEvidenceContract(), []);
    assert.equal(sourceEvidenceContract.sourceCaseIds.length, 10);
    for (const caseId of sourceEvidenceContract.sourceCaseIds) {
        const result = loadDiagnosticsSourceEvidence({
            repositoryRoot,
            evaluatedCaseId: caseId,
        });
        assert.deepEqual({ ...result }, {
            status: "unavailable",
            authorityState: "CONTRACT_ONLY",
            code: "NO_ADMITTED_SOURCE_EVIDENCE",
            caseActivationAllowed: false,
            proof: null,
            errors: [],
        });
        assert.equal(Object.getPrototypeOf(result), null);
        assert.equal(Object.isFrozen(result), true);
    }
});

test("source evidence loader rejects non-source cases and malformed revisions", () => {
    const result = loadDiagnosticsSourceEvidence({
        repositoryRoot,
        evaluatedCaseId: "N01",
        expectedBundleRevision: "latest",
    });
    assert(result.errors.includes("SOURCE_CASE_NOT_ALLOWED"));
    assert(result.errors.includes("EXPECTED_BUNDLE_REVISION_INVALID"));
    assert.equal(result.proof, null);
    assert.equal(result.caseActivationAllowed, false);
});

test("source evidence loading never mutates contract inputs", () => {
    withFixture((root) => {
        const evidenceRoot = join(root, "evidence/source-evidence");
        const before = hashTree(evidenceRoot);
        loadDiagnosticsSourceEvidence({
            repositoryRoot: root,
            evaluatedCaseId: "P01",
        });
        assert.deepEqual(hashTree(evidenceRoot), before);
    });
});

test("source evidence contract lock rejects omission and stale digests", () => {
    withFixture((root) => {
        const path = join(
            root,
            "evidence/source-evidence/contracts/v1/contract-files.json",
        );
        const value = JSON.parse(readFileSync(path, "utf8"));
        value.entries.pop();
        value.entries[0].digest = `sha256:${"0".repeat(64)}`;
        writeFileSync(path, canonicalJson(value));
        const errors = validateSourceEvidenceContract(root);
        assert(errors.includes("Source evidence contract lock changed"));
        assert(errors.includes("Source evidence contract revision changed"));
    });
});

test("source evidence registry cannot self-admit or self-revoke", () => {
    withFixture((root) => {
        const path = join(
            root,
            "evidence/source-evidence/registries/application-slice-diagnostics.v1.json",
        );
        const value = JSON.parse(readFileSync(path, "utf8"));
        value.payload.phase = "ACTIVE";
        value.payload.admissions = [`sha256:${"a".repeat(64)}`];
        value.payload.revocations = [`sha256:${"b".repeat(64)}`];
        value.registryRevision = `sha256:${"c".repeat(64)}`;
        value.approved = true;
        writeFileSync(path, canonicalJson(value));
        assert(
            validateSourceEvidenceContract(root).includes(
                "Source evidence diagnostics registry changed",
            ),
        );
    });
});

test("source evidence inventory rejects missing extra and symlink entries", () => {
    withFixture((root) => {
        const schemaRoot = join(
            root,
            "evidence/source-evidence/contracts/v1/schemas",
        );
        unlinkSync(join(schemaRoot, "proof.schema.json"));
        writeFileSync(join(schemaRoot, "extra.schema.json"), "{}\n");
        symlinkSync(
            "policy.schema.json",
            join(schemaRoot, "proof.schema.json"),
        );
        const errors = validateSourceEvidenceContract(root);
        assert(errors.includes("Source evidence schemas inventory changed"));
        assert(
            errors.some((error) =>
                error.includes("schemas/proof.schema.json: file is unavailable or invalid"),
            ),
        );
    });
});

test("source evidence canonical readers reject BOM malformed and trailing bytes", () => {
    withFixture((root) => {
        const base = join(root, "evidence/source-evidence/contracts/v1");
        const policyPath = join(base, "policy.json");
        writeFileSync(
            policyPath,
            `\ufeff${readFileSync(policyPath, "utf8")}trailing`,
        );
        const registryPath = join(
            root,
            "evidence/source-evidence/registries/application-slice-diagnostics.v1.json",
        );
        writeFileSync(registryPath, "{\n");
        const errors = validateSourceEvidenceContract(root);
        assert(errors.some((error) => error.includes("BOM is forbidden")));
        assert(errors.some((error) => error.includes("invalid JSON")));
    });
});

test("source evidence canonical values require NFC, byte bounds, and safe integers", () => {
    const mutations = [
        [
            "string violates canonical JSON v1",
            (policy) => (policy.purpose = "e\u0301valuation"),
        ],
        [
            "string violates canonical JSON v1",
            (policy) => (policy.purpose = "😀".repeat(3000)),
        ],
        [
            "numbers must be safe integers",
            (policy) => (policy.contractVersion = 1.5),
        ],
    ];
    for (const [expected, mutate] of mutations) {
        withFixture((root) => {
            const policyPath = join(
                root,
                "evidence/source-evidence/contracts/v1/policy.json",
            );
            const policy = JSON.parse(readFileSync(policyPath, "utf8"));
            mutate(policy);
            writeFileSync(policyPath, canonicalJson(policy));
            assert(
                validateSourceEvidenceContract(root).some((error) =>
                    error.includes(expected),
                ),
                expected,
            );
        });
    }
});

test("source evidence canonical key ordering uses Unicode code points", () => {
    const rendered = canonicalSourceEvidenceJson({
        "2": "two",
        "10": "ten",
        "💩": "astral",
        "": "bmp",
    });
    assert(rendered.indexOf('"10"') < rendered.indexOf('"2"'));
    assert(rendered.indexOf('""') < rendered.indexOf('"💩"'));
});

test("source evidence directories reject symlinks and excessive entries", () => {
    withFixture((root) => {
        const contractRoot = join(
            root,
            "evidence/source-evidence/contracts/v1",
        );
        const schemaRoot = join(contractRoot, "schemas");
        const realSchemaRoot = join(contractRoot, "schemas-real");
        renameSync(schemaRoot, realSchemaRoot);
        symlinkSync("schemas-real", schemaRoot);
        let errors = validateSourceEvidenceContract(root);
        assert(
            errors.some((error) =>
                error.includes("Source evidence schemas inventory is unavailable"),
            ),
        );
        unlinkSync(schemaRoot);
        renameSync(realSchemaRoot, schemaRoot);
        for (let index = 0; index < 257; index++)
            writeFileSync(join(schemaRoot, `extra-${index}.json`), "{}\n");
        errors = validateSourceEvidenceContract(root);
        assert(
            errors.some((error) =>
                error.includes("Source evidence schemas inventory is unavailable"),
            ),
        );
    });
    withFixture((root) => {
        const readmePath = join(
            root,
            "evidence/source-evidence/contracts/v1/README.md",
        );
        unlinkSync(readmePath);
        mkdirSync(readmePath);
        assert(
            validateSourceEvidenceContract(root).some((error) =>
                error.includes("README.md: file is unavailable or invalid"),
            ),
        );
    });
});

test("source evidence deep JSON and failures remain bounded and path-neutral", () => {
    withFixture((root) => {
        const policyPath = join(
            root,
            "evidence/source-evidence/contracts/v1/policy.json",
        );
        const policy = JSON.parse(readFileSync(policyPath, "utf8"));
        let nested = { value: "leaf" };
        for (let index = 0; index < 40; index++) nested = { nested };
        policy.unexpected = nested;
        writeFileSync(policyPath, canonicalJson(policy));
        const errors = validateSourceEvidenceContract(root);
        assert(
            errors.some((error) => error.includes("JSON exceeds structural bounds")),
        );
    });
    const result = loadDiagnosticsSourceEvidence({
        repositoryRoot: "/nonexistent/private/checkout",
        evaluatedCaseId: "P01",
    });
    assert(result.errors.length > 0);
    assert(
        result.errors.every(
            (error) => !error.includes("/nonexistent/private/checkout"),
        ),
    );
});

test("source evidence schemas remain closed", () => {
    withFixture((root) => {
        const path = join(
            root,
            "evidence/source-evidence/contracts/v1/schemas/registry.schema.json",
        );
        const value = JSON.parse(readFileSync(path, "utf8"));
        value.additionalProperties = true;
        writeFileSync(path, canonicalJson(value));
        const errors = validateSourceEvidenceContract(root);
        assert(
            errors.some((error) =>
                error.includes("object schema must set additionalProperties false"),
            ),
        );
        assert(
            errors.some((error) =>
                error.includes("schemas/registry.schema.json: digest changed"),
            ),
        );
    });
});
