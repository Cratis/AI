#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { isUtf8 } from "node:buffer";
import { createHash } from "node:crypto";
import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    renameSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { compareOrdinal } from "./catalog-ordering.mjs";
import {
    readCatalog,
    validateAgainstSchema,
} from "./catalog-validation.mjs";
import { v2SchemaPath } from "./catalog-v2-validation.mjs";
import { assertSafeContent } from "./public-artifact-materializer.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const inputPaths = [
    "catalog/v2/authoring-contracts.json",
    "catalog/v2/bundles.json",
    "catalog/v2/evidence.json",
    "catalog/v2/human-catalog.json",
    "catalog/v2/source-contracts.json",
    "catalog/v2/targets.json",
    "catalog/v2/taxonomy.json",
    "catalog/v2/upstream-companions.json",
];

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function inputDigest(contents) {
    const hash = createHash("sha256");
    for (const path of [...inputPaths].sort(compareOrdinal)) {
        hash.update(path);
        hash.update("\0");
        hash.update(contents.get(path));
        hash.update("\0");
    }
    return hash.digest("hex");
}

function parseInput(path, content) {
    if (!isUtf8(content))
        throw new Error(`Human catalog input must be valid UTF-8: ${path}`);
    try {
        return JSON.parse(content.toString("utf8"));
    } catch (error) {
        throw new Error(`Human catalog input must be strict JSON: ${path}`, {
            cause: error,
        });
    }
}

function loadInputs() {
    const contractPath = "catalog/v2/human-catalog.json";
    const contractContent = readFileSync(join(repositoryRoot, contractPath));
    if (contractContent.length > 1024 * 1024)
        throw new Error("Human catalog contract exceeds bootstrap size limit");
    const humanContract = parseInput(contractPath, contractContent);
    if (contractContent.length > humanContract.limits.maximumInputBytes)
        throw new Error("Human catalog inputs exceed maximum input bytes");
    const contents = new Map([[contractPath, contractContent]]);
    let totalBytes = contractContent.length;
    for (const path of inputPaths) {
        if (path === contractPath) continue;
        const content = readFileSync(join(repositoryRoot, path));
        totalBytes += content.length;
        if (totalBytes > humanContract.limits.maximumInputBytes)
            throw new Error("Human catalog inputs exceed maximum input bytes");
        contents.set(path, content);
    }
    const catalogs = new Map([[contractPath, humanContract]]);
    assertBounded(humanContract, humanContract.limits);
    for (const [path, content] of contents) {
        if (path === contractPath) continue;
        const catalog = parseInput(path, content);
        assertBounded(catalog, humanContract.limits);
        catalogs.set(path, catalog);
    }
    return {
        catalogs,
        digest: inputDigest(contents),
        humanContract,
    };
}

function json(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
}

function assertBounded(value, limits, depth = 0) {
    if (depth > limits.maximumJsonDepth)
        throw new Error("Human catalog input exceeds maximum JSON depth");
    if (typeof value === "string") {
        if (Buffer.byteLength(value) > limits.maximumStringBytes)
            throw new Error("Human catalog input exceeds maximum string size");
        return;
    }
    if (Array.isArray(value)) {
        if (value.length > limits.maximumItemsPerRegistry)
            throw new Error("Human catalog input exceeds maximum registry size");
        for (const item of value) assertBounded(item, limits, depth + 1);
        return;
    }
    if (value && typeof value === "object") {
        for (const item of Object.values(value))
            assertBounded(item, limits, depth + 1);
    }
}

export function markdownText(value) {
    return value
        .replaceAll("\\", "\\\\")
        .replaceAll("`", "\\`")
        .replaceAll("*", "\\*")
        .replaceAll("_", "\\_")
        .replaceAll("[", "\\[")
        .replaceAll("]", "\\]")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replace(/[\r\n]+/g, " ");
}

function applicabilityText(applicability) {
    if (applicability.state === "applicable")
        return applicability.ids.join(", ");
    if (applicability.state === "not-applicable")
        return `Not applicable — ${markdownText(applicability.reason)}`;
    return `Unclassified — ${markdownText(applicability.reason)}`;
}

function renderList(values, fallback = "None") {
    return values.length > 0
        ? values.map((value) => `- ${markdownText(value)}`)
        : [`- ${markdownText(fallback)}`];
}

function renderCapability(capability) {
    const sectionSuffix = ` — ${capability.id}`;
    const lines = [
        `## ${capability.semanticName}`,
        "",
        `- **ID:** \`${capability.id}\``,
        `- **Audience:** ${capability.audience}`,
        `- **Lifecycle:** ${capability.lifecycle}`,
        `- **Approval:** ${capability.approvalState}`,
        `- **Runtime eligible:** ${capability.runtimeEligible ? "yes" : "no"}`,
        "",
        `### Purpose${sectionSuffix}`,
        "",
        markdownText(capability.purpose),
        "",
        `### When to use${sectionSuffix}`,
        "",
        markdownText(capability.whenToUse),
        "",
        `### When not to use${sectionSuffix}`,
        "",
        ...renderList(capability.whenNotToUse),
        "",
        `### Invocation${sectionSuffix}`,
        "",
        `- Capability kind: ${capability.capabilityKind}`,
        `- Invocation: ${capability.invocation}`,
        "",
        `### Applicability${sectionSuffix}`,
        "",
        `- Products: ${capability.products.join(", ")}`,
        `- Languages: ${capability.languages.join(", ")}`,
        `- Architectures: ${applicabilityText(capability.architectures)}`,
        `- Personas: ${applicabilityText(capability.personas)}`,
        `- Surfaces: ${applicabilityText(capability.surfaces)}`,
        `- Repository profiles: ${applicabilityText(capability.repositoryProfiles)}`,
        "",
        `### Dependencies${sectionSuffix}`,
        "",
        ...renderList(
            capability.dependencies.map(
                (edge) =>
                    `${edge.category}:${edge.dependencyId} (${edge.strength}; missing → ${edge.missingBehavior.action})`,
            ),
            "Unclassified",
        ),
        "",
        `### Trust and effects${sectionSuffix}`,
        "",
        `- Trust class: ${capability.trust.class}`,
        `- Assessment: ${capability.trust.assessmentState}`,
        ...renderList(
            capability.trust.effects.map(
                (effect) =>
                    `${effect.operation} ${effect.resourceBoundary}: ${effect.scope}`,
            ),
            "No assessed effects",
        ),
        "",
        `### Evidence and support${sectionSuffix}`,
        "",
        ...renderList(
            capability.authoringContractIds.map(
                (id) => `Authoring contract: ${id}`,
            ),
            "Authoring contract unclassified",
        ),
        ...renderList(capability.evidenceIds.map((id) => `Evidence: ${id}`)),
        "",
        `### Related capabilities${sectionSuffix}`,
        "",
        ...renderList(capability.relatedTargetIds),
        "",
        `### Bundle membership${sectionSuffix}`,
        "",
        ...renderList(capability.bundleIds),
    ];
    return lines;
}

function renderCapabilities(capabilities) {
    const lines = [];
    capabilities.forEach((capability, index) => {
        lines.push(...renderCapability(capability));
        if (index + 1 < capabilities.length) lines.push("");
    });
    return lines;
}

function canonicalApplicability(applicability) {
    return {
        state: applicability.state,
        ids: [...applicability.ids].sort(compareOrdinal),
        reason: applicability.reason,
    };
}

function canonicalEffect(effect) {
    const record = {
        id: effect.id,
        operation: effect.operation,
        resourceBoundary: effect.resourceBoundary,
        scope: effect.scope,
        dataClassifications: [...effect.dataClassifications].sort(compareOrdinal),
        reversible: effect.reversible,
        confirmation: {
            required: effect.confirmation.required,
            timing: effect.confirmation.timing,
            reason: effect.confirmation.reason,
        },
        authorization: {
            required: effect.authorization.required,
            authority: effect.authorization.authority,
            evidenceIds: [...effect.authorization.evidenceIds].sort(
                compareOrdinal,
            ),
        },
        evidenceIds: [...effect.evidenceIds].sort(compareOrdinal),
    };
    if (effect.rollbackOrCompensation)
        Object.assign(record, {
            rollbackOrCompensation: effect.rollbackOrCompensation,
        });
    return record;
}

function canonicalTrust(trust) {
    return {
        class: trust.class,
        assessmentState: trust.assessmentState,
        effects: trust.effects
            .map(canonicalEffect)
            .sort((left, right) => compareOrdinal(left.id, right.id)),
    };
}

export function buildHumanCatalogOutputs() {
    const schema = readCatalog(join(repositoryRoot, v2SchemaPath));
    const { catalogs, digest, humanContract } = loadInputs();
    const targets = catalogs.get("catalog/v2/targets.json").targets;
    const bundles = catalogs.get("catalog/v2/bundles.json").bundles;

    const publicTargetIds = new Set(
        targets
            .filter((target) => target.audience === "public")
            .map((target) => target.id),
    );
    const bundleIdsByTarget = new Map();
    for (const bundle of bundles) {
        for (const targetId of [
            ...bundle.rootTargetIds,
            ...bundle.selectedSoftOrOptionalTargetIds,
        ]) {
            const ids = bundleIdsByTarget.get(targetId) ?? [];
            ids.push(bundle.id);
            bundleIdsByTarget.set(targetId, ids);
        }
    }
    const capabilities = targets
        .filter((target) =>
            humanContract.includeAudiences.includes(target.audience),
        )
        .map((target) => ({
            id: target.id,
            semanticName: target.semanticName,
            audience: target.audience,
            purpose: target.capability,
            whenToUse: target.positiveTriggerIntent,
            whenNotToUse: [...target.nearMissExclusions].sort(compareOrdinal),
            capabilityKind: target.capabilityKind,
            invocation: target.invocation,
            lifecycle: target.lifecycle,
            approvalState: target.approval.state,
            runtimeEligible: target.includeInRuntime,
            products: [...target.products].sort(compareOrdinal),
            languages: [...target.languages].sort(compareOrdinal),
            architectures: canonicalApplicability(target.architectures),
            personas: canonicalApplicability(target.personas),
            surfaces: canonicalApplicability(target.surfaces),
            repositoryProfiles: canonicalApplicability(
                target.repositoryProfiles,
            ),
            trust: canonicalTrust(target.trust),
            dependencies: [...target.dependencyEdges].sort((left, right) =>
                compareOrdinal(
                    `${left.category}:${left.dependencyId}`,
                    `${right.category}:${right.dependencyId}`,
                ),
            ),
            authoringContractIds: [...target.authoringContractIds].sort(
                compareOrdinal,
            ),
            evidenceIds: [...target.evidenceIds].sort(compareOrdinal),
            relatedTargetIds: [
                ...new Set([
                    ...target.collisionSet,
                    ...target.dependencies.targets,
                ]),
            ]
                .filter((targetId) => publicTargetIds.has(targetId))
                .sort(compareOrdinal),
            bundleIds: [...(bundleIdsByTarget.get(target.id) ?? [])].sort(
                compareOrdinal,
            ),
        }))
        .sort((left, right) => compareOrdinal(left.id, right.id));
    const data = {
        schemaVersion: 2,
        contractVersion: humanContract.contractVersion,
        disclaimer: humanContract.disclaimer,
        inputDigest: digest,
        capabilities,
    };
    const dataErrors = validateAgainstSchema(
        data,
        schema.$defs.generatedHumanCatalog,
        schema,
    );
    if (dataErrors.length > 0)
        throw new Error(`Generated human catalog is invalid: ${dataErrors.join("; ")}`);

    const markdownLines = [
        "# Cratis capability catalog",
        "",
        `> ${markdownText(humanContract.disclaimer)}`,
        "",
        "This catalog is generated from reviewed catalog metadata. It is a human",
        "navigation surface, not source authority and not an installation artifact.",
        "",
        ...renderCapabilities(capabilities),
    ];
    const contents = new Map([
        [humanContract.generatedFiles.data, Buffer.from(json(data))],
        [
            humanContract.generatedFiles.markdown,
            Buffer.from(`${markdownLines.join("\n")}\n`),
        ],
    ]);
    for (const [path, content] of contents)
        assertSafeContent(`human-catalog/${path}`, content);
    const files = [...contents.entries()]
        .map(([path, content]) => ({
            path,
            size: content.length,
            sha256: sha256(content),
        }))
        .sort((left, right) => compareOrdinal(left.path, right.path));
    const manifest = {
        schemaVersion: 2,
        contractVersion: humanContract.contractVersion,
        inputDigest: digest,
        files,
    };
    const manifestErrors = validateAgainstSchema(
        manifest,
        schema.$defs.generatedHumanCatalogManifest,
        schema,
    );
    if (manifestErrors.length > 0)
        throw new Error(`Generated manifest is invalid: ${manifestErrors.join("; ")}`);
    contents.set(humanContract.generatedFiles.manifest, Buffer.from(json(manifest)));
    if (contents.size > humanContract.limits.maximumGeneratedFiles)
        throw new Error("Human catalog exceeds maximum generated files");
    const generatedBytes = [...contents.values()].reduce(
        (total, content) => total + content.length,
        0,
    );
    if (generatedBytes > humanContract.limits.maximumGeneratedBytes)
        throw new Error("Human catalog exceeds maximum generated bytes");
    return { contents, humanContract };
}

function currentFiles(root) {
    if (!existsSync(root)) return [];
    const paths = [];
    function visit(current) {
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const absolutePath = join(current, entry.name);
            if (entry.isDirectory()) visit(absolutePath);
            else if (entry.isFile())
                paths.push(relative(root, absolutePath).split(sep).join("/"));
            else throw new Error("Generated human catalog contains a non-regular path");
        }
    }
    visit(root);
    return paths.sort(compareOrdinal);
}

export function checkHumanCatalogOutputs(outputs, root) {
    const expectedPaths = [...outputs.keys()].sort(compareOrdinal);
    const existingPaths = currentFiles(root);
    if (JSON.stringify(existingPaths) !== JSON.stringify(expectedPaths))
        throw new Error("Generated human catalog file inventory is stale");
    for (const [path, content] of outputs) {
        const current = readFileSync(join(root, path));
        if (!current.equals(content))
            throw new Error(`Generated human catalog is stale: ${path}`);
    }
}

export function writeHumanCatalogOutputsAtomically(
    outputs,
    root,
    options = {},
) {
    const manifestPath = "manifest.json";
    if (!outputs.has(manifestPath))
        throw new Error("Generated human catalog requires manifest.json");
    mkdirSync(root, { recursive: true });
    const partialPaths = new Map();
    try {
        for (const [path, content] of outputs) {
            const partial = join(root, `${path}.partial-${process.pid}`);
            mkdirSync(dirname(partial), { recursive: true });
            writeFileSync(partial, content, { flag: "wx" });
            partialPaths.set(path, partial);
        }
        let publishedDataFiles = 0;
        for (const path of [...outputs.keys()]
            .filter((path) => path !== manifestPath)
            .sort(compareOrdinal)) {
            renameSync(partialPaths.get(path), join(root, path));
            publishedDataFiles += 1;
            if (publishedDataFiles === options.failAfterDataFiles)
                throw new Error("Injected failure after data publication");
        }
        renameSync(
            partialPaths.get(manifestPath),
            join(root, manifestPath),
        );
        const expectedPaths = new Set(outputs.keys());
        for (const path of currentFiles(root)) {
            if (!expectedPaths.has(path))
                rmSync(join(root, path), { recursive: true, force: true });
        }
    } catch (error) {
        for (const partial of partialPaths.values())
            rmSync(partial, { force: true });
        throw error;
    }
}

function main() {
    const { contents, humanContract } = buildHumanCatalogOutputs();
    const outputRoot = join(repositoryRoot, humanContract.outputRoot);
    if (process.argv.includes("--check")) {
        checkHumanCatalogOutputs(contents, outputRoot);
        process.stdout.write("Generated human catalog is current.\n");
    } else {
        mkdirSync(dirname(outputRoot), { recursive: true });
        writeHumanCatalogOutputsAtomically(contents, outputRoot);
        process.stdout.write(
            `Generated human catalog: ${contents.size} files under ${humanContract.outputRoot}.\n`,
        );
    }
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    main();
}
