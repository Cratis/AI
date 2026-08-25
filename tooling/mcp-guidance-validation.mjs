// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultRepositoryRoot, readCatalog } from "./catalog-validation.mjs";
import { validateMcpGuidanceProductContract } from "./mcp-guidance-product-contract.mjs";
import {
    expectedMcpGuidanceReferences,
    mcpGuidanceProductPaths,
} from "./generate-mcp-guidance-references.mjs";

const expectedSkillFiles = Object.freeze([
    "LICENSE",
    "SKILL.md",
    "references/blocked-tools.md",
    "references/observational-tools.md",
]);

function filesUnder(root, sourceRoot) {
    const absoluteRoot = join(root, sourceRoot);
    const files = [];
    const visit = (current) => {
        for (const entry of readdirSync(current).sort()) {
            const path = join(current, entry);
            const stat = lstatSync(path);
            if (stat.isSymbolicLink())
                throw new Error(
                    `${relative(root, path).split(sep).join("/")} is a symlink`,
                );
            if (stat.isDirectory()) visit(path);
            else if (stat.isFile())
                files.push(
                    relative(absoluteRoot, path).split(sep).join("/"),
                );
            else
                throw new Error(
                    `${relative(root, path).split(sep).join("/")} is a special file`,
                );
        }
    };
    visit(absoluteRoot);
    return files.sort();
}

export function validateMcpGuidanceProducts(
    root = defaultRepositoryRoot,
    { requireIntegratedComponents = true } = {},
) {
    const errors = [];
    let products;
    let productSchema;
    let components;
    let projections;
    let profiles;
    let artifacts;
    try {
        products = readCatalog(join(root, mcpGuidanceProductPaths.catalog));
        productSchema = readCatalog(join(root, mcpGuidanceProductPaths.schema));
        if (requireIntegratedComponents) {
            components = readCatalog(join(root, "catalog/components.json"));
            projections = readCatalog(
                join(root, "catalog/component-projections.json"),
            );
            profiles = readCatalog(
                join(root, "distribution/profile-catalog.json"),
            );
            artifacts = readCatalog(join(root, "catalog/v2/artifacts.json"));
        }
    } catch (error) {
        return [`MCP guidance products cannot be loaded: ${error.message}`];
    }
    errors.push(
        ...validateMcpGuidanceProductContract(products, productSchema),
    );
    let expected = {};
    try {
        expected = expectedMcpGuidanceReferences(root);
    } catch (error) {
        errors.push(error.message);
    }
    for (const [path, content] of Object.entries(expected)) {
        if (!existsSync(join(root, path)))
            errors.push(`MCP guidance reference is missing: ${path}`);
        else if (readFileSync(join(root, path), "utf8") !== content)
            errors.push(`MCP guidance reference is stale: ${path}`);
    }
    for (const product of products.products) {
        try {
            const files = filesUnder(root, product.skillRoot);
            if (JSON.stringify(files) !== JSON.stringify(expectedSkillFiles))
                errors.push(`${product.id}: skill source inventory changed`);
            const sourceText = files
                .map((path) =>
                    readFileSync(join(root, product.skillRoot, path), "utf8"),
                )
                .join("\n");
            for (const forbidden of [
                /tools\/call/iu,
                /jsonrpc/iu,
                /mcp\.json/iu,
                /https?:\/\//iu,
                /```(?:bash|sh|powershell|json)/iu,
            ])
                if (forbidden.test(sourceText))
                    errors.push(
                        `${product.id}: passive source contains forbidden executable material`,
                    );
            if (
                product.id === "studio" &&
                (/studio_[a-z0-9_]+/iu.test(sourceText) ||
                    /\b(?:GET|POST|PUT|PATCH|DELETE)\s+\//u.test(sourceText))
            )
                errors.push(
                    "Studio public guidance contains private implementation details",
                );
        } catch (error) {
            errors.push(`${product.id}: skill source failed: ${error.message}`);
        }
        if (!requireIntegratedComponents) continue;
        const component = components.components.find(
            (candidate) => candidate.id === product.componentId,
        );
        if (
            !component ||
            component.kind !== "skill" ||
            component.classification.effect !== "guided-read" ||
            component.classification.executable ||
            component.approval.state !== "modeled"
        )
            errors.push(`${product.id}: passive skill component binding changed`);
        if (
            projections.projections.some(
                (projection) => projection.componentId === product.componentId,
            )
        )
            errors.push(`${product.id}: guidance cannot create a projection`);
        for (const profileId of product.profileIds) {
            const profile = [
                ...profiles.publicProfiles,
                ...profiles.engineeringProfiles,
            ].find((candidate) => candidate.id === profileId);
            if (
                !profile?.availableTargets?.includes(product.componentId) ||
                profile.state !== "preview-source-candidate"
            )
                errors.push(`${product.id}: profile candidate binding changed`);
        }
        for (const artifact of artifacts.artifacts)
            if (
                (artifact.materializationAllowed || artifact.runtimeEligible) &&
                artifact.componentInventory.skills.includes(product.componentId)
            )
                errors.push(
                    `${product.id}: guidance entered a materialized or runtime artifact`,
                );
    }
    if (
        requireIntegratedComponents &&
        components.components.some(
            (component) => component.kind === "mcp" || component.kind === "lsp",
        )
    )
        errors.push("Passive MCP guidance cannot create MCP or LSP components");
    return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const errors = validateMcpGuidanceProducts(
        resolve(fileURLToPath(new URL("..", import.meta.url))),
    );
    if (errors.length > 0) {
        for (const error of errors) process.stderr.write(`- ${error}\n`);
        process.exitCode = 1;
    } else process.stdout.write("Multi-product MCP guidance validation passed.\n");
}
