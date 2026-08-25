// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
    chronicleMcpGuidancePaths,
    validateChronicleMcpGuidance,
} from "../chronicle-mcp-guidance-validation.mjs";
import {
    chronicleMcpGuidanceReferencePaths,
    expectedChronicleMcpGuidanceReferences,
} from "../generate-chronicle-mcp-guidance-references.mjs";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
} from "../catalog-validation.mjs";

function clone(value) {
    return structuredClone(value);
}

function loadCatalog() {
    return readCatalog(
        join(defaultRepositoryRoot, chronicleMcpGuidancePaths.catalog),
    );
}

function validateCatalog(catalog) {
    return validateChronicleMcpGuidance(defaultRepositoryRoot, {
        catalog,
        schema: readCatalog(
            join(defaultRepositoryRoot, chronicleMcpGuidancePaths.schema),
        ),
        sourceContracts: readCatalog(
            join(
                defaultRepositoryRoot,
                chronicleMcpGuidancePaths.sourceContract,
            ),
        ),
        evidence: readCatalog(
            join(defaultRepositoryRoot, chronicleMcpGuidancePaths.evidence),
        ),
    });
}

function subject(overrides = {}) {
    return {
        id: "candidate_tool",
        effectClass: "observational",
        disposition: "passive-allowed",
        sourceRevision: "1".repeat(40),
        implementationDigest: "2".repeat(64),
        schemaDigest: "3".repeat(64),
        effects: ["read"],
        boundedOutput: true,
        outputClassification: "internal",
        evidenceIds: ["repo-main-b795d53"],
        redactionReviewEvidenceIds: ["repo-main-b795d53"],
        annotationHints: {
            readOnly: true,
            destructive: false,
            idempotent: true,
            openWorld: false,
        },
        ...overrides,
    };
}

test("Chronicle MCP guidance starts empty, deny-all, and valid", () => {
    const catalog = loadCatalog();
    assert.deepEqual(validateChronicleMcpGuidance(), []);
    assert.equal(catalog.authorityState, "NO_ADMITTED_TOOL_EFFECT_EVIDENCE");
    assert.equal(catalog.upstreamRevision, null);
    assert.deepEqual(catalog.tools, []);
    assert.deepEqual(catalog.prompts, []);
    assert.equal(catalog.emission.invocationAllowed, false);
    assert.equal(catalog.emission.serverBytesAllowed, false);
});

test("classification schema is closed and supports exact future subject ids", () => {
    const catalog = loadCatalog();
    const schema = readCatalog(
        join(defaultRepositoryRoot, chronicleMcpGuidancePaths.schema),
    );
    const mutated = clone(catalog);
    mutated.unexpected = true;
    assert(
        validateAgainstSchema(mutated, schema, schema).some((error) =>
            error.includes("unknown property unexpected"),
        ),
    );
    const future = clone(catalog);
    future.upstreamRevision = "1".repeat(40);
    future.tools.push(subject());
    assert.deepEqual(validateAgainstSchema(future, schema, schema), []);
});

test("hints and read-sounding names cannot override destructive code evidence", () => {
    const catalog = loadCatalog();
    catalog.upstreamRevision = "1".repeat(40);
    catalog.tools.push(
        subject({
            id: "list_safe_items",
            effectClass: "effectful",
            effects: ["read", "destructive"],
            annotationHints: {
                readOnly: true,
                destructive: false,
                idempotent: true,
                openWorld: false,
            },
        }),
    );
    const errors = validateCatalog(catalog);
    assert(
        errors.some((error) =>
            error.includes("effectful behavior must remain blocked"),
        ),
    );
    const references = expectedChronicleMcpGuidanceReferences(catalog);
    assert.equal(
        references[chronicleMcpGuidanceReferencePaths.observational].includes(
            "list_safe_items",
        ),
        false,
    );
});

test("unknown, effectful, unbounded, and unredacted subjects cannot be admitted", () => {
    const catalog = loadCatalog();
    const candidates = [
        subject({ effectClass: "unknown" }),
        subject({ id: "write_item", effects: ["write"] }),
        subject({ id: "open_query", boundedOutput: false }),
        subject({
            id: "raw_query",
            outputClassification: "unknown",
            redactionReviewEvidenceIds: [],
        }),
    ];
    for (const candidate of candidates) {
        assert(
            !(
                candidate.effectClass === "observational" &&
                candidate.effects.every((effect) => effect === "read") &&
                candidate.boundedOutput &&
                candidate.outputClassification !== "unknown" &&
                candidate.redactionReviewEvidenceIds.length > 0
            ),
        );
    }
    catalog.upstreamRevision = "1".repeat(40);
    for (const candidate of candidates) {
        const mutated = clone(catalog);
        mutated.tools = [candidate];
        assert(
            validateCatalog(mutated).some(
                (error) =>
                    error.includes("passive observational admission") ||
                    error.includes("only evidence-proven observational") ||
                    error.includes("missing authority must fail closed"),
            ),
        );
    }
});

test("generated references are deterministic and contain no invocation material", () => {
    const catalog = loadCatalog();
    const first = expectedChronicleMcpGuidanceReferences(catalog);
    const second = expectedChronicleMcpGuidanceReferences(clone(catalog));
    assert.deepEqual(first, second);
    for (const [path, expected] of Object.entries(first)) {
        assert.equal(
            readFileSync(join(defaultRepositoryRoot, path), "utf8"),
            expected,
        );
        assert.doesNotMatch(expected, /tools\/call|jsonrpc|mcp\.json|https?:\/\//iu);
        assert.doesNotMatch(expected, /```(?:bash|sh|powershell|json)/iu);
    }
});
