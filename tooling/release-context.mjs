// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareOrdinal } from "./catalog-ordering.mjs";
import {
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

export const releaseCatalogDescriptors = Object.freeze({
    profileCatalog: Object.freeze({
        path: "distribution/profile-catalog.json",
    }),
    marketplaceRequirements: Object.freeze({
        path: "distribution/marketplace-requirements.json",
    }),
    artifactMatrix: Object.freeze({
        path: "distribution/artifact-matrix.json",
    }),
    engineeringArtifactMatrix: Object.freeze({
        path: "distribution/engineering-artifact-matrix.json",
    }),
    ecosystemArtifactBindings: Object.freeze({
        path: "distribution/ecosystem-artifact-bindings.json",
        schemaPath: "distribution/ecosystem-artifact-bindings.schema.json",
    }),
    artifactAssurancePolicy: Object.freeze({
        path: "distribution/artifact-assurance-policy.json",
        schemaPath: "distribution/artifact-assurance-policy.schema.json",
    }),
    sources: Object.freeze({
        path: "catalog/v2/sources.json",
        definition: "sourcesCatalog",
    }),
    targets: Object.freeze({
        path: "catalog/v2/targets.json",
        definition: "targetsCatalog",
    }),
    artifacts: Object.freeze({
        path: "catalog/v2/artifacts.json",
        definition: "artifactsCatalog",
    }),
    sourceContracts: Object.freeze({
        path: "catalog/v2/source-contracts.json",
        definition: "sourceContractsCatalog",
    }),
    authoringContracts: Object.freeze({
        path: "catalog/v2/authoring-contracts.json",
        definition: "authoringContractsCatalog",
    }),
    artifactAssuranceProfiles: Object.freeze({
        path: "catalog/v2/artifact-assurance-profiles.json",
        schemaPath: "catalog/schemas/artifact-assurance-profiles.schema.json",
    }),
});

function deepFreeze(value, seen = new Set()) {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    for (const child of Object.values(value)) deepFreeze(child, seen);
    return Object.freeze(value);
}

function parseJson(path, content) {
    try {
        return JSON.parse(content.toString("utf8"));
    } catch (error) {
        throw new Error(`Release catalog must be strict JSON: ${path}`, {
            cause: error,
        });
    }
}

function recordsForCatalog(key, catalog) {
    const candidates = {
        profileCatalog: [
            ...(catalog.publicProfiles ?? []),
            ...(catalog.engineeringProfiles ?? []),
        ],
        marketplaceRequirements: catalog.requirements,
        artifactMatrix: catalog.targets,
        engineeringArtifactMatrix: catalog.packageBoundaries,
        ecosystemArtifactBindings: catalog.bindings,
        artifactAssurancePolicy: catalog.classes,
        sources: catalog.sources,
        targets: catalog.targets,
        artifacts: catalog.artifacts,
        sourceContracts: catalog.contracts,
        authoringContracts: catalog.contracts,
        artifactAssuranceProfiles: catalog.profiles,
    };
    return candidates[key] ?? [];
}

function immutableOrdinalIndex(key, records) {
    if (!Array.isArray(records))
        throw new Error(`Release catalog ${key} has no indexable record array`);
    const sorted = [...records].sort((left, right) =>
        compareOrdinal(left.id, right.id),
    );
    const index = new Map();
    for (const record of sorted) {
        if (!record || typeof record.id !== "string" || record.id.length === 0)
            throw new Error(
                `Release catalog ${key} contains a record without an id`,
            );
        if (index.has(record.id))
            throw new Error(
                `Release catalog ${key} contains duplicate id ${record.id}`,
            );
        index.set(record.id, record);
    }
    const ids = Object.freeze(sorted.map((record) => record.id));
    const byId = Object.freeze(
        Object.fromEntries(sorted.map((record) => [record.id, record])),
    );
    return Object.freeze({
        ids,
        byId,
        get(id) {
            return index.get(id);
        },
        has(id) {
            return index.has(id);
        },
    });
}

function validateCatalog(descriptor, catalog, schemas) {
    if (descriptor.schemaPath) {
        const schema = schemas.get(descriptor.schemaPath);
        const vocabularyErrors = validateSchemaVocabulary(schema);
        const errors = [
            ...vocabularyErrors,
            ...validateAgainstSchema(catalog, schema),
        ];
        if (errors.length > 0)
            throw new Error(
                `${descriptor.path} failed validation: ${errors.join("; ")}`,
            );
    }
    if (descriptor.definition) {
        const schema = schemas.get("catalog/schemas/v2/catalog-v2.schema.json");
        const branch = { $ref: `#/$defs/${descriptor.definition}` };
        const errors = validateAgainstSchema(catalog, branch, schema);
        if (errors.length > 0)
            throw new Error(
                `${descriptor.path} failed validation: ${errors.join("; ")}`,
            );
    }
    if (!catalog || typeof catalog !== "object" || Array.isArray(catalog))
        throw new Error(`${descriptor.path} must contain an object`);
}

/**
 * Loads every release-planning catalog and schema at most once. The resulting
 * context has no environment, network, or clock input and exposes only frozen
 * values and read-only ordinal ID lookups.
 */
export function createReleaseContext({
    repositoryRoot = defaultRepositoryRoot,
    descriptors = releaseCatalogDescriptors,
    readFile = readFileSync,
} = {}) {
    const root = resolve(repositoryRoot);
    const bytesByPath = new Map();
    const readOnce = (path) => {
        if (!bytesByPath.has(path))
            bytesByPath.set(path, Buffer.from(readFile(join(root, path))));
        return bytesByPath.get(path);
    };
    const schemaPaths = new Set(["catalog/schemas/v2/catalog-v2.schema.json"]);
    for (const descriptor of Object.values(descriptors))
        if (descriptor.schemaPath) schemaPaths.add(descriptor.schemaPath);
    const schemas = new Map(
        [...schemaPaths]
            .sort(compareOrdinal)
            .map((path) => [path, parseJson(path, readOnce(path))]),
    );
    const catalogs = {};
    const ordinalMaps = {};
    for (const key of Object.keys(descriptors).sort(compareOrdinal)) {
        const descriptor = descriptors[key];
        const catalog = parseJson(descriptor.path, readOnce(descriptor.path));
        validateCatalog(descriptor, catalog, schemas);
        catalogs[key] = deepFreeze(catalog);
        ordinalMaps[key] = immutableOrdinalIndex(
            key,
            recordsForCatalog(key, catalog),
        );
    }
    const context = {
        schemaVersion: "1.0.0",
        catalogs: deepFreeze(catalogs),
        catalogDigests: Object.freeze(
            Object.fromEntries(
                Object.entries(descriptors).map(([key, descriptor]) => [
                    key,
                    createHash("sha256")
                        .update(readOnce(descriptor.path))
                        .digest("hex"),
                ]),
            ),
        ),
        ordinalMaps: Object.freeze(ordinalMaps),
        catalogPaths: Object.freeze(
            Object.fromEntries(
                Object.entries(descriptors)
                    .sort(([left], [right]) => compareOrdinal(left, right))
                    .map(([key, descriptor]) => [key, descriptor.path]),
            ),
        ),
        readCount: bytesByPath.size,
        get(catalog, id) {
            const index = ordinalMaps[catalog];
            if (!index) throw new Error(`Unknown release catalog: ${catalog}`);
            return index.get(id);
        },
        require(catalog, id) {
            const value = this.get(catalog, id);
            if (!value) throw new Error(`Unknown ${catalog} id: ${id}`);
            return value;
        },
    };
    return Object.freeze(context);
}
