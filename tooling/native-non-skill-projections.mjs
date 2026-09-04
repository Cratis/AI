#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { compareOrdinal } from "./catalog-ordering.mjs";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
} from "./catalog-validation.mjs";
import {
    createLogicalTree,
    projectLogicalTree,
    writeProjectedRoot,
} from "./deterministic-release-tree.mjs";

export const s8NativeProjectionPaths = Object.freeze({
    components: "catalog/components.json",
    projections: "catalog/component-projections.json",
    hostAdapters: "catalog/host-adapters.json",
    evidence: "catalog/evidence.json",
    componentSchema: "catalog/schemas/components.schema.json",
    projectionSchema: "catalog/schemas/component-projections.schema.json",
    expectedTree: "tooling/fixtures/s8-native-non-skill-expected-tree.json",
});

const expectedStaticComponentAnchor =
    "1dfa8932759fb50d4991a2d77ce5c0dae80a150601aea4e4aa5f16d134db0354";
const expectedStaticProjectionAnchor =
    "5994bb761eeaf6f44fd5da70af8434f93b5197ccc7325bb9aa536eb1a9bf0056";
const expectedStaticProjectionHostAnchor =
    "ae962a476c91b871d5e9906280e6751e64d962d325a15f37ad8e35e04825eb9a";

const expectedRoots = Object.freeze([
    "devin-hosted-instructions",
    "jetbrains-ai-assistant-rules",
    "tabnine-guidelines",
    "visual-studio-copilot-instructions",
]);
function semanticAnchor(records) {
    return createHash("sha256")
        .update(
            `${[...records]
                .sort((left, right) => compareOrdinal(left.id, right.id))
                .map((record) => JSON.stringify(record))
                .join("\n")}\n`,
        )
        .digest("hex");
}

function canonicalFileDigest(path, content) {
    return createHash("sha256")
        .update(path)
        .update("\0")
        .update(content)
        .update("\0")
        .digest("hex");
}

function componentSourceDigest(source) {
    return createHash("sha256")
        .update(source.path)
        .update("\0")
        .update(source.digest)
        .update("\0")
        .digest("hex");
}

const forbiddenPayloadPathPattern =
    /(?:^|\/)(?:scripts?|hooks?|mcp|lsp|agents?|prompts?|commands?)(?:\/|$)/iu;
const forbiddenPayloadBasenames = new Set([
    "SKILL.md",
    "plugin.json",
    "package.json",
    "package-lock.json",
    "yarn.lock",
    "settings.json",
    "mcp.json",
]);

function containedBy(root, path) {
    const value = relative(root, path);
    return (
        value !== "" &&
        value !== ".." &&
        !value.startsWith(`..${sep}`) &&
        !isAbsolute(value)
    );
}

function generatedStaticProjections(catalog) {
    return catalog.projections
        .filter((projection) => projection.state === "generated-static")
        .sort((left, right) => compareOrdinal(left.id, right.id));
}

export function buildNativeNonSkillProjectionPlan(
    root = defaultRepositoryRoot,
) {
    const components = readCatalog(
        join(root, s8NativeProjectionPaths.components),
    );
    const projections = readCatalog(
        join(root, s8NativeProjectionPaths.projections),
    );
    const componentSchema = readCatalog(
        join(root, s8NativeProjectionPaths.componentSchema),
    );
    const projectionSchema = readCatalog(
        join(root, s8NativeProjectionPaths.projectionSchema),
    );
    const selected = generatedStaticProjections(projections);
    const selectedComponentIds = new Set(
        selected.map((projection) => projection.componentId),
    );
    const selectedHostIds = new Set(
        selected.map((projection) => projection.hostId),
    );
    const metadataErrors = [
        ...validateAgainstSchema(components, componentSchema, componentSchema),
        ...validateAgainstSchema(
            projections,
            projectionSchema,
            projectionSchema,
        ),
    ];
    if (
        semanticAnchor(
            components.components.filter((component) =>
                selectedComponentIds.has(component.id),
            ),
        ) !== expectedStaticComponentAnchor ||
        semanticAnchor(selected) !== expectedStaticProjectionAnchor ||
        semanticAnchor(
            projections.hosts.filter((host) => selectedHostIds.has(host.id)),
        ) !== expectedStaticProjectionHostAnchor
    )
        metadataErrors.push(
            "S8 component or projection metadata differs from the reviewed anchors",
        );
    if (metadataErrors.length > 0)
        throw new Error(
            `Component metadata blocks S8 generation: ${metadataErrors.join("; ")}`,
        );
    const hostAdapters = readCatalog(
        join(root, s8NativeProjectionPaths.hostAdapters),
    );
    const evidence = readCatalog(join(root, s8NativeProjectionPaths.evidence));
    const componentsById = new Map(
        components.components.map((component) => [component.id, component]),
    );
    const hostsById = new Map(projections.hosts.map((host) => [host.id, host]));
    const adaptersById = new Map(
        hostAdapters.hosts.map((adapter) => [adapter.id, adapter]),
    );
    const observationsById = new Map(
        evidence.observations.map((observation) => [
            observation.id,
            observation,
        ]),
    );
    if (selected.length !== 70)
        throw new Error(
            `S8 requires exactly 70 projections; found ${selected.length}`,
        );
    const logicalPaths = new Set();
    const mappingsByRoot = new Map();
    const receiptProjections = [];
    for (const projection of selected) {
        const component = componentsById.get(projection.componentId);
        const host = hostsById.get(projection.hostId);
        const adapter = adaptersById.get(host?.hostAdapterId);
        const observation = observationsById.get(projection.evidenceIds[0]);
        if (
            !component ||
            !component.classification.passive ||
            !host ||
            host.materialization !== "static-fixture" ||
            !host.staticOutputRoot ||
            !adapter ||
            !observation ||
            observation.observedOn > evidence.asOf ||
            observation.validThrough < evidence.asOf ||
            observation.subject.kind !== "ecosystem" ||
            observation.subject.id !== adapter.ecosystemId ||
            projection.projectedKind !== component.kind ||
            projection.outputPaths.length !== 1
        )
            throw new Error(
                `${projection.id}: S8 authority or effect contract changed`,
            );
        const source = component.canonicalSources.find(
            (candidate) =>
                candidate.ownership === "owner" &&
                candidate.ownerComponentId === component.id,
        );
        if (!source || component.canonicalSources.length !== 1)
            throw new Error(
                `${projection.id}: canonical ownership is not exact`,
            );
        const outputPath = projection.outputPaths[0];
        const rootPrefix = `${host.staticOutputRoot}/`;
        if (!outputPath.startsWith(rootPrefix))
            throw new Error(
                `${projection.id}: output escapes declared fixture root`,
            );
        const relativeOutput = outputPath.slice(rootPrefix.length);
        const basename = relativeOutput.split("/").at(-1);
        if (
            forbiddenPayloadBasenames.has(basename) ||
            forbiddenPayloadPathPattern.test(outputPath) ||
            forbiddenPayloadPathPattern.test(relativeOutput)
        )
            throw new Error(
                `${projection.id}: forbidden payload path ${relativeOutput}`,
            );
        logicalPaths.add(source.path);
        const mappings = mappingsByRoot.get(host.staticOutputRoot) ?? [];
        mappings.push({ sourcePath: source.path, path: relativeOutput });
        mappingsByRoot.set(host.staticOutputRoot, mappings);
        receiptProjections.push({
            projectionId: projection.id,
            componentId: component.id,
            canonicalOwnerId: source.ownerComponentId,
            semanticKind: component.kind,
            sourcePath: source.path,
            sourceDigest: source.digest,
            outputPath,
            hostId: host.id,
            hostAdapterId: host.hostAdapterId,
            evidenceIds: [...projection.evidenceIds],
        });
    }
    const roots = [...mappingsByRoot]
        .map(([outputRoot, mappings]) => ({
            id: outputRoot,
            root: outputRoot,
            parityGroup: outputRoot,
            mappings: mappings.sort((left, right) =>
                compareOrdinal(left.path, right.path),
            ),
        }))
        .sort((left, right) => compareOrdinal(left.root, right.root));
    if (
        JSON.stringify(roots.map((candidate) => candidate.root)) !==
        JSON.stringify(expectedRoots)
    )
        throw new Error("S8 root inventory differs from the reviewed contract");
    const metrics = { sourceReads: 0, finalReads: 0, bytesHashed: 0 };
    const logicalTree = createLogicalTree({
        sourceRoot: root,
        approvedFiles: [...logicalPaths].sort(compareOrdinal),
        metrics,
    });
    for (const sourcePath of logicalPaths) {
        const projection = receiptProjections.find(
            (candidate) => candidate.sourcePath === sourcePath,
        );
        const component = componentsById.get(projection.componentId);
        const source = component.canonicalSources[0];
        const content = logicalTree.read(sourcePath);
        if (canonicalFileDigest(sourcePath, content) !== source.digest)
            throw new Error(
                `${projection.projectionId}: canonical source digest drift`,
            );
        if (componentSourceDigest(source) !== component.contentDigest)
            throw new Error(
                `${projection.projectionId}: component source digest drift`,
            );
    }
    const projectedTree = projectLogicalTree(logicalTree, roots, {
        concurrency: 1,
    });
    const receipt = Object.freeze({
        schemaVersion: "1.0.0",
        state: "S8_NATIVE_NON_SKILL_STATIC_FIXTURE",
        generatedBy: "tooling/native-non-skill-projections.mjs",
        roots: projectedTree.roots.map((candidate) => ({
            id: candidate.id,
            outputRoot: candidate.root,
            files: candidate.files.map((file) => ({
                path: file.path,
                sourcePath: file.sourcePath,
                size: file.size,
                sha256: file.sha256,
            })),
        })),
        projections: receiptProjections
            .map((projection) => ({
                ...projection,
                outputDigest: logicalTree.byPath.get(projection.sourcePath)
                    .sha256,
            }))
            .sort((left, right) =>
                compareOrdinal(left.projectionId, right.projectionId),
            ),
        rootCount: projectedTree.roots.length,
        fileCount: projectedTree.files.length,
        uniqueComponentCount: new Set(
            receiptProjections.map((projection) => projection.componentId),
        ).size,
        executionPerformed: false,
        hostTestingPerformed: false,
        installationPerformed: false,
        lifecycleTestingPerformed: false,
        networkAccessPerformed: false,
        supportGranted: false,
        publicationGranted: false,
        runtimeGranted: false,
        promotionGranted: false,
    });
    return Object.freeze({ logicalTree, projectedTree, receipt, metrics });
}

export function expectedNativeNonSkillProjectionTree(
    root = defaultRepositoryRoot,
) {
    return buildNativeNonSkillProjectionPlan(root).receipt;
}

export function validateNativeNonSkillProjectionContract(
    root = defaultRepositoryRoot,
) {
    const errors = [];
    try {
        const expected = expectedNativeNonSkillProjectionTree(root);
        const fixture = readCatalog(
            join(root, s8NativeProjectionPaths.expectedTree),
        );
        if (JSON.stringify(fixture) !== JSON.stringify(expected))
            errors.push("S8 native non-skill expected tree is stale");
        if (
            expected.rootCount !== 4 ||
            expected.fileCount !== 70 ||
            expected.uniqueComponentCount !== 35
        )
            errors.push("S8 native non-skill cardinality changed");
    } catch (error) {
        errors.push(error.message);
    }
    return errors;
}

export function generateNativeNonSkillProjectionFixture(
    destination,
    root = defaultRepositoryRoot,
) {
    const repositoryReal = realpathSync(root);
    const absoluteDestination = resolve(destination);
    const parent = dirname(absoluteDestination);
    if (!existsSync(parent) || !lstatSync(parent).isDirectory())
        throw new Error("S8 destination parent must be an existing directory");
    const parentReal = realpathSync(parent);
    if (
        containedBy(repositoryReal, parentReal) ||
        parentReal === repositoryReal
    )
        throw new Error(
            "S8 fixture destination must be outside the repository",
        );
    const plan = buildNativeNonSkillProjectionPlan(root);
    const validation = writeProjectedRoot(
        absoluteDestination,
        plan.projectedTree,
        { concurrency: 1, metrics: plan.metrics },
    );
    if (validation.fileCount !== 70)
        throw new Error("S8 generated fixture validation is incomplete");
    return Object.freeze({
        receipt: plan.receipt,
        validation,
        destination: absoluteDestination,
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const errors = validateNativeNonSkillProjectionContract();
    if (errors.length > 0) {
        for (const error of errors) process.stderr.write(`- ${error}\n`);
        process.exitCode = 1;
    } else
        process.stdout.write(
            "S8 native non-skill projection contract validation passed.\n",
        );
}
