// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
    defaultRepositoryRoot,
    readCatalog,
} from "../catalog-validation.mjs";
import {
    expectedMcpGuidanceReferences,
    mcpGuidanceProductPaths,
} from "../generate-mcp-guidance-references.mjs";
import { validateMcpGuidanceProducts } from "../mcp-guidance-validation.mjs";

function clone(value) {
    return structuredClone(value);
}

test("multi-product MCP guidance is closed and Chronicle output stays byte-identical", () => {
    assert.deepEqual(
        validateMcpGuidanceProducts(defaultRepositoryRoot, {
            requireIntegratedComponents: false,
        }),
        [],
    );
    const expected = expectedMcpGuidanceReferences();
    for (const [path, content] of Object.entries(expected))
        assert.equal(readFileSync(join(defaultRepositoryRoot, path), "utf8"), content);
    assert.equal(Object.keys(expected).length, 4);
});

test("Studio starts with no implementation authority or admitted subjects", () => {
    const studio = readCatalog(
        join(
            defaultRepositoryRoot,
            "catalog/studio-mcp-tool-classifications.json",
        ),
    );
    assert.equal(studio.guidanceProductId, "studio");
    assert.equal(studio.sourceContractId, null);
    assert.equal(studio.upstreamRevision, null);
    assert.equal(studio.inventoryDigest, null);
    assert.equal(studio.inventoryEvidenceId, null);
    assert.deepEqual(studio.tools, []);
    assert.deepEqual(studio.prompts, []);
    assert.equal(studio.emission.invocationAllowed, false);
    assert.equal(studio.emission.serverBytesAllowed, false);
});

test("Chronicle authority cannot be substituted for Studio", () => {
    const productCatalog = readCatalog(
        join(defaultRepositoryRoot, mcpGuidanceProductPaths.catalog),
    );
    const productSchema = readCatalog(
        join(defaultRepositoryRoot, mcpGuidanceProductPaths.schema),
    );
    const studio = productCatalog.products.find(
        (product) => product.id === "studio",
    );
    const inputsByProduct = {};
    for (const product of productCatalog.products)
        inputsByProduct[product.id] = {
            catalog: readCatalog(join(defaultRepositoryRoot, product.classificationPath)),
            schema: readCatalog(
                join(defaultRepositoryRoot, product.classificationSchemaPath),
            ),
            sourceContracts: readCatalog(
                join(defaultRepositoryRoot, "catalog/v2/source-contracts.json"),
            ),
            evidence: readCatalog(
                join(defaultRepositoryRoot, "catalog/evidence.json"),
            ),
        };
    inputsByProduct.studio.catalog.sourceContractId =
        "cratis-chronicle-mcp-source";
    assert.throws(
        () =>
            expectedMcpGuidanceReferences(defaultRepositoryRoot, {
                productCatalog: clone(productCatalog),
                productSchema,
                inputsByProduct,
            }),
        /studio: classification product binding changed/u,
    );
    assert.equal(studio.sourceContractId, null);
});

test("Studio public bytes contain no implementation inventory or executable material", () => {
    const productCatalog = readCatalog(
        join(defaultRepositoryRoot, mcpGuidanceProductPaths.catalog),
    );
    const studio = productCatalog.products.find(
        (product) => product.id === "studio",
    );
    const source = [
        "SKILL.md",
        "references/observational-tools.md",
        "references/blocked-tools.md",
    ]
        .map((path) =>
            readFileSync(join(defaultRepositoryRoot, studio.skillRoot, path), "utf8"),
        )
        .join("\n");
    assert.doesNotMatch(source, /studio_[a-z0-9_]+/iu);
    assert.doesNotMatch(source, /tools\/call|jsonrpc|mcp\.json|https?:\/\//iu);
    assert.doesNotMatch(source, /\b(?:GET|POST|PUT|PATCH|DELETE)\s+\//u);
    assert.doesNotMatch(source, /```(?:bash|sh|powershell|json)/iu);
});

test("invalid product generation fails before any output is selected", () => {
    const productCatalog = readCatalog(
        join(defaultRepositoryRoot, mcpGuidanceProductPaths.catalog),
    );
    const productSchema = readCatalog(
        join(defaultRepositoryRoot, mcpGuidanceProductPaths.schema),
    );
    productCatalog.products[1].observationalReferencePath = "../escape.md";
    assert.throws(
        () =>
            expectedMcpGuidanceReferences(defaultRepositoryRoot, {
                productCatalog,
                productSchema,
            }),
        /unsafe repository path|escape the skill root/u,
    );
});
