#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";
import {
    chronicleMcpGuidanceReferencePaths,
    expectedChronicleMcpGuidanceReferences,
    validateChronicleMcpGenerationInputs,
} from "./generate-chronicle-mcp-guidance-references.mjs";

export const mcpGuidanceProductPaths = Object.freeze({
    catalog: "catalog/mcp-guidance-products.json",
    schema: "catalog/schemas/mcp-guidance-products.schema.json",
    sourceContracts: "catalog/v2/source-contracts.json",
    evidence: "catalog/evidence.json",
});

function safeRepositoryPath(path) {
    return (
        typeof path === "string" &&
        path.length > 0 &&
        !isAbsolute(path) &&
        !path.includes("\\") &&
        !path.split("/").some((segment) => segment === "." || segment === "..")
    );
}

function loadInputs(root, product) {
    return {
        catalog: readCatalog(join(root, product.classificationPath)),
        schema: readCatalog(join(root, product.classificationSchemaPath)),
        sourceContracts: readCatalog(
            join(root, mcpGuidanceProductPaths.sourceContracts),
        ),
        evidence: readCatalog(join(root, mcpGuidanceProductPaths.evidence)),
    };
}

export function expectedMcpGuidanceReferences(
    root = defaultRepositoryRoot,
    overrides = {},
) {
    const productCatalog =
        overrides.productCatalog ??
        readCatalog(join(root, mcpGuidanceProductPaths.catalog));
    const productSchema =
        overrides.productSchema ??
        readCatalog(join(root, mcpGuidanceProductPaths.schema));
    const errors = [
        ...validateSchemaVocabulary(productSchema),
        ...validateAgainstSchema(
            productCatalog,
            productSchema,
            productSchema,
        ),
    ];
    const ids = new Set();
    const outputPaths = new Set();
    const expected = {};
    for (const product of productCatalog.products) {
        for (const path of [
            product.classificationPath,
            product.classificationSchemaPath,
            product.skillRoot,
            product.observationalReferencePath,
            product.blockedReferencePath,
        ])
            if (!safeRepositoryPath(path))
                errors.push(`${product.id}: unsafe repository path ${path}`);
        if (
            !product.observationalReferencePath.startsWith(
                `${product.skillRoot}/references/`,
            ) ||
            !product.blockedReferencePath.startsWith(
                `${product.skillRoot}/references/`,
            )
        )
            errors.push(`${product.id}: generated references escape the skill root`);
        if (ids.has(product.id))
            errors.push(`MCP guidance contains duplicate product ${product.id}`);
        ids.add(product.id);
        const inputs = overrides.inputsByProduct?.[product.id] ??
            loadInputs(root, product);
        if (
            inputs.catalog.guidanceProductId !== product.id ||
            inputs.catalog.guidanceComponentId !== product.componentId ||
            inputs.catalog.sourceContractId !== product.sourceContractId
        )
            errors.push(`${product.id}: classification product binding changed`);
        const auxiliaryErrors = validateChronicleMcpGenerationInputs(
            root,
            inputs,
            overrides.supportCatalogs,
        );
        errors.push(...auxiliaryErrors.map((error) => `${product.id}: ${error}`));
        try {
            const rendered = expectedChronicleMcpGuidanceReferences(
                inputs.catalog,
                inputs,
                product.displayName,
            );
            const observational =
                rendered[chronicleMcpGuidanceReferencePaths.observational];
            const blocked =
                rendered[chronicleMcpGuidanceReferencePaths.blocked];
            for (const [path, content] of [
                [product.observationalReferencePath, observational],
                [product.blockedReferencePath, blocked],
            ]) {
                if (outputPaths.has(path))
                    errors.push(`MCP guidance contains duplicate output ${path}`);
                outputPaths.add(path);
                expected[path] = content;
            }
        } catch (error) {
            errors.push(`${product.id}: ${error.message}`);
        }
    }
    if (errors.length > 0)
        throw new Error(
            `Refusing to generate MCP guidance references: ${errors.join("; ")}`,
        );
    return expected;
}

export function generateMcpGuidanceReferences(root = defaultRepositoryRoot) {
    const expected = expectedMcpGuidanceReferences(root);
    for (const [path, content] of Object.entries(expected)) {
        const output = join(root, path);
        mkdirSync(dirname(output), { recursive: true });
        writeFileSync(output, content);
    }
    return expected;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const generated = generateMcpGuidanceReferences(
        resolve(fileURLToPath(new URL("..", import.meta.url))),
    );
    process.stdout.write(
        `Generated ${Object.keys(generated).length} MCP guidance references.\n`,
    );
}
