#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import {
    existsSync,
    lstatSync,
    readFileSync,
    realpathSync,
    renameSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
} from "./catalog-validation.mjs";
import { validateMcpGuidanceProductContract } from "./mcp-guidance-product-contract.mjs";
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

function normalizedPathKey(path) {
    return path.normalize("NFC").toLowerCase();
}

function pathsCollide(left, right) {
    const leftKey = normalizedPathKey(left);
    const rightKey = normalizedPathKey(right);
    return (
        leftKey === rightKey ||
        leftKey.startsWith(`${rightKey}/`) ||
        rightKey.startsWith(`${leftKey}/`)
    );
}

function assertConfinedPath(root, repositoryPath, expectedKind) {
    if (!safeRepositoryPath(repositoryPath))
        throw new Error(`unsafe repository path ${repositoryPath}`);
    const rootReal = realpathSync(root);
    const segments = repositoryPath.split("/");
    let current = root;
    for (let index = 0; index < segments.length; index++) {
        current = join(current, segments[index]);
        if (!existsSync(current)) continue;
        const stat = lstatSync(current);
        if (stat.isSymbolicLink())
            throw new Error(`repository path traverses symlink ${repositoryPath}`);
        if (index < segments.length - 1 && !stat.isDirectory())
            throw new Error(`repository path has a non-directory parent ${repositoryPath}`);
    }
    const parent = dirname(join(root, repositoryPath));
    if (!existsSync(parent) || !lstatSync(parent).isDirectory())
        throw new Error(`repository path parent is missing ${repositoryPath}`);
    const parentReal = realpathSync(parent);
    if (
        parentReal !== rootReal &&
        !parentReal.startsWith(`${rootReal}${sep}`)
    )
        throw new Error(`repository path escapes root ${repositoryPath}`);
    const absolute = join(root, repositoryPath);
    if (expectedKind === "file") {
        if (!existsSync(absolute) || !lstatSync(absolute).isFile())
            throw new Error(`repository input is not a regular file ${repositoryPath}`);
    } else if (expectedKind === "output" && existsSync(absolute)) {
        const stat = lstatSync(absolute);
        if (!stat.isFile() || stat.isSymbolicLink())
            throw new Error(`generated output is not a regular file ${repositoryPath}`);
    } else if (expectedKind === "directory") {
        if (!existsSync(absolute) || !lstatSync(absolute).isDirectory())
            throw new Error(`repository input is not a directory ${repositoryPath}`);
    }
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
    const contractErrors = validateMcpGuidanceProductContract(
        productCatalog,
        productSchema,
    );
    if (contractErrors.length > 0)
        throw new Error(
            `Refusing to generate MCP guidance references: ${contractErrors.join("; ")}`,
        );
    const errors = [];
    const ids = new Set();
    const outputPaths = new Map();
    const inputPaths = new Set([
        mcpGuidanceProductPaths.catalog,
        mcpGuidanceProductPaths.schema,
        mcpGuidanceProductPaths.sourceContracts,
        mcpGuidanceProductPaths.evidence,
        "catalog/schemas/evidence.schema.json",
        "catalog/schemas/v2/catalog-v2.schema.json",
        "catalog/support-policy.json",
        "catalog/ecosystem-versions.json",
        "catalog/v2/artifact-assurance-profiles.json",
        "catalog/v2/ecosystem-contracts.json",
        "distribution/ecosystem-artifact-bindings.json",
    ]);
    for (const path of inputPaths)
        assertConfinedPath(root, path, "file");
    const expected = {};
    for (const product of productCatalog.products) {
        const productPaths = [
            product.classificationPath,
            product.classificationSchemaPath,
            product.skillRoot,
            product.observationalReferencePath,
            product.blockedReferencePath,
        ];
        const unsafe = productPaths.some((path) => !safeRepositoryPath(path));
        if (unsafe) {
            errors.push(`${product.id}: unsafe repository path`);
            continue;
        }
        if (
            !product.observationalReferencePath.startsWith(
                `${product.skillRoot}/references/`,
            ) ||
            !product.blockedReferencePath.startsWith(
                `${product.skillRoot}/references/`,
            )
        ) {
            errors.push(`${product.id}: generated references escape the skill root`);
            continue;
        }
        inputPaths.add(product.classificationPath);
        inputPaths.add(product.classificationSchemaPath);
        assertConfinedPath(root, product.classificationPath, "file");
        assertConfinedPath(root, product.classificationSchemaPath, "file");
        assertConfinedPath(root, product.skillRoot, "directory");
        if (ids.has(product.id))
            errors.push(`MCP guidance contains duplicate product ${product.id}`);
        ids.add(product.id);
        const inputs =
            overrides.inputsByProduct?.[product.id] ?? loadInputs(root, product);
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
                const key = normalizedPathKey(path);
                if (outputPaths.has(key))
                    errors.push(
                        `MCP guidance contains colliding outputs ${outputPaths.get(key)} and ${path}`,
                    );
                for (const existing of outputPaths.values())
                    if (pathsCollide(existing, path))
                        errors.push(
                            `MCP guidance contains parent, case, or Unicode-colliding outputs ${existing} and ${path}`,
                        );
                outputPaths.set(key, path);
                expected[path] = content;
            }
        } catch (error) {
            errors.push(`${product.id}: ${error.message}`);
        }
    }
    for (const outputPath of Object.keys(expected)) {
        for (const inputPath of inputPaths)
            if (pathsCollide(outputPath, inputPath))
                errors.push(
                    `MCP guidance output ${outputPath} collides with authority input ${inputPath}`,
                );
        try {
            assertConfinedPath(root, outputPath, "output");
        } catch (error) {
            errors.push(error.message);
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
    const staged = [];
    const committed = [];
    try {
        let index = 0;
        for (const [path, content] of Object.entries(expected)) {
            assertConfinedPath(root, path, "output");
            const output = join(root, path);
            const temporary = join(
                dirname(output),
                `.${basename(output)}.tmp-${process.pid}-${index++}`,
            );
            if (existsSync(temporary))
                throw new Error(`temporary output already exists ${temporary}`);
            writeFileSync(temporary, content, { flag: "wx" });
            if (!lstatSync(temporary).isFile())
                throw new Error(`temporary output is not a regular file ${temporary}`);
            staged.push({
                output,
                temporary,
                original: existsSync(output)
                    ? readFileSync(output)
                    : null,
            });
        }
        for (const operation of staged) {
            renameSync(operation.temporary, operation.output);
            committed.push(operation);
        }
    } catch (error) {
        for (const operation of committed.reverse()) {
            if (operation.original === null) rmSync(operation.output, { force: true });
            else writeFileSync(operation.output, operation.original);
        }
        throw error;
    } finally {
        for (const operation of staged)
            if (existsSync(operation.temporary))
                rmSync(operation.temporary, { force: true });
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
