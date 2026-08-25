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
import { readCatalog, validateAgainstSchema } from "./catalog-validation.mjs";
import { v2SchemaPath } from "./catalog-v2-validation.mjs";
import { assertSafeContent } from "./public-artifact-materializer.mjs";
import { presentProfile } from "./profile-presentation.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const inputPaths = [
    "catalog/v2/authoring-contracts.json",
    "catalog/v2/bundles.json",
    "catalog/v2/components.json",
    "catalog/v2/component-projections.json",
    "catalog/v2/evidence.json",
    "catalog/v2/ecosystem-artifact-coverage.json",
    "catalog/v2/human-catalog.json",
    "catalog/v2/source-contracts.json",
    "catalog/v2/support.json",
    "catalog/v2/targets.json",
    "catalog/v2/taxonomy.json",
    "catalog/v2/upstream-companions.json",
    "catalog/host-adapters.json",
    "distribution/profile-catalog.json",
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
            throw new Error(
                "Human catalog input exceeds maximum registry size",
            );
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

function compareAudienceThenId(left, right) {
    const audienceDifference =
        (left.audience === "public" ? 0 : 1) -
        (right.audience === "public" ? 0 : 1);
    return audienceDifference || compareOrdinal(left.id, right.id);
}

function renderProfile(profile) {
    const lines = [
        `### ${profile.displayName}`,
        "",
        `- **Profile ID:** \`${profile.id}\``,
        `- **Audience:** ${profile.audience}`,
        `- **Package:** \`${profile.packageName}\``,
        `- **State:** ${profile.state}`,
        `- **Installable:** ${profile.installable ? "yes" : "no"}`,
        `- **Materialization:** ${profile.materialization}`,
        "",
        profile.description,
        "",
        `**Intended for:** ${profile.intendedFor}`,
        "",
        `- Products: ${profile.products.join(", ") || "shared engineering behavior"}`,
        `- Languages: ${profile.languages.join(", ") || "language-agnostic"}`,
        `- Repository kinds: ${profile.repositoryKinds.join(", ") || "consumer projects"}`,
        "",
        "#### Included capabilities",
        "",
        ...renderList(
            profile.targetIds,
            "No approved or candidate capabilities yet",
        ),
        "",
        "#### Composed profiles",
        "",
        ...renderList(profile.composes),
    ];
    return lines;
}

function renderProfiles(profiles) {
    return profiles.flatMap((profile, index) => [
        ...(index === 0 ? [] : [""]),
        ...renderProfile(profile),
    ]);
}

function resolveProfileTargets(profileId, profilesById, cache, resolving) {
    if (cache.has(profileId)) return cache.get(profileId);
    if (resolving.has(profileId))
        throw new Error(`Profile composition cycle: ${profileId}`);
    const profile = profilesById.get(profileId);
    if (!profile) throw new Error(`Unknown composed profile: ${profileId}`);
    resolving.add(profileId);
    const targets = new Set(profile.directTargetIds);
    for (const dependency of profile.composes)
        for (const targetId of resolveProfileTargets(
            dependency,
            profilesById,
            cache,
            resolving,
        ))
            targets.add(targetId);
    resolving.delete(profileId);
    const resolved = [...targets].sort(compareOrdinal);
    cache.set(profileId, resolved);
    return resolved;
}

function renderCapability(capability) {
    const sectionSuffix = ` — ${capability.id}`;
    const lines = [
        `### ${capability.semanticName}`,
        "",
        `- **ID:** \`${capability.id}\``,
        `- **Audience:** ${capability.audience}`,
        `- **Lifecycle:** ${capability.lifecycle}`,
        `- **Approval:** ${capability.approvalState}`,
        `- **Runtime eligible:** ${capability.runtimeEligible ? "yes" : "no"}`,
        "",
        `#### Purpose${sectionSuffix}`,
        "",
        markdownText(capability.purpose),
        "",
        `#### When to use${sectionSuffix}`,
        "",
        markdownText(capability.whenToUse),
        "",
        `#### When not to use${sectionSuffix}`,
        "",
        ...renderList(capability.whenNotToUse),
        "",
        `#### Invocation${sectionSuffix}`,
        "",
        `- Capability kind: ${capability.capabilityKind}`,
        `- Invocation: ${capability.invocation}`,
        "",
        `#### Applicability${sectionSuffix}`,
        "",
        `- Products: ${capability.products.join(", ")}`,
        `- Languages: ${capability.languages.join(", ")}`,
        `- Architectures: ${applicabilityText(capability.architectures)}`,
        `- Personas: ${applicabilityText(capability.personas)}`,
        `- Surfaces: ${applicabilityText(capability.surfaces)}`,
        `- Repository profiles: ${applicabilityText(capability.repositoryProfiles)}`,
        "",
        `#### Dependencies${sectionSuffix}`,
        "",
        ...renderList(
            capability.dependencies.map(
                (edge) =>
                    `${edge.category}:${edge.dependencyId} (${edge.strength}; missing → ${edge.missingBehavior.action})`,
            ),
            "Unclassified",
        ),
        "",
        `#### Trust and effects${sectionSuffix}`,
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
        `#### Evidence and support${sectionSuffix}`,
        "",
        ...renderList(
            capability.authoringContractIds.map(
                (id) => `Authoring contract: ${id}`,
            ),
            "Authoring contract unclassified",
        ),
        ...renderList(capability.evidenceIds.map((id) => `Evidence: ${id}`)),
        "",
        `#### Related capabilities${sectionSuffix}`,
        "",
        ...renderList(capability.relatedTargetIds),
        "",
        `#### Bundle membership${sectionSuffix}`,
        "",
        ...renderList(capability.bundleIds),
        "",
        `#### Profile membership${sectionSuffix}`,
        "",
        ...renderList(capability.profileIds),
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
        dataClassifications: [...effect.dataClassifications].sort(
            compareOrdinal,
        ),
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
    const componentsCatalog = catalogs.get("catalog/v2/components.json");
    const componentProjections = catalogs.get(
        "catalog/v2/component-projections.json",
    );
    const support = catalogs.get("catalog/v2/support.json");
    const supportByBindingId = new Map(
        support.bindings.map((record) => [record.bindingId, record]),
    );
    const generatedCoverage = catalogs.get(
        "catalog/v2/ecosystem-artifact-coverage.json",
    );
    const generatedCoverageByBindingId = new Map(
        generatedCoverage.coverage.map((record) => [record.bindingId, record]),
    );
    const hostAdapters = catalogs.get("catalog/host-adapters.json").hosts;
    const bundles = catalogs.get("catalog/v2/bundles.json").bundles;
    const profileCatalog = catalogs.get("distribution/profile-catalog.json");
    const presentedProfiles = [
        ...profileCatalog.publicProfiles.map((profile) =>
            presentProfile(profile, "public"),
        ),
        ...profileCatalog.engineeringProfiles.map((profile) =>
            presentProfile(profile, "cratis-engineering"),
        ),
    ];
    const profilesById = new Map(
        presentedProfiles.map((profile) => [profile.id, profile]),
    );
    const profileTargetCache = new Map();
    const profiles = presentedProfiles
        .map((profile) => ({
            ...profile,
            targetIds: resolveProfileTargets(
                profile.id,
                profilesById,
                profileTargetCache,
                new Set(),
            ),
        }))
        .sort(compareAudienceThenId);
    const profileIdsByTarget = new Map();
    for (const profile of profiles)
        for (const targetId of profile.targetIds) {
            const profileIds = profileIdsByTarget.get(targetId) ?? [];
            profileIds.push(profile.id);
            profileIdsByTarget.set(targetId, profileIds);
        }
    const includedTargetIds = new Set(
        targets
            .filter((target) =>
                humanContract.includeAudiences.includes(target.audience),
            )
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
                .filter((targetId) => includedTargetIds.has(targetId))
                .sort(compareOrdinal),
            bundleIds: [...(bundleIdsByTarget.get(target.id) ?? [])].sort(
                compareOrdinal,
            ),
            profileIds: [...(profileIdsByTarget.get(target.id) ?? [])].sort(
                compareOrdinal,
            ),
        }))
        .sort(compareAudienceThenId);
    const hostCoverage = hostAdapters
        .map((host) => ({
            ecosystemId: host.ecosystemId,
            hostAdapterId: host.id,
            productName: host.product.name,
            productStatus: host.product.status,
            coverage: host.supportDisposition.coverage,
            strategy: host.strategy,
            servingArtifactBindingId: host.serving.artifactBindingId,
            targetId: host.serving.targetId,
            outputRoot: host.serving.outputRoot,
            generationState:
                generatedCoverageByBindingId.get(host.serving.artifactBindingId)
                    ?.generationState ?? "unmapped",
            technicalTier:
                supportByBindingId.get(host.serving.artifactBindingId)
                    ?.effectiveTier ?? "unsupported",
            supportClaim: host.supportDisposition.supportClaim,
        }))
        .sort((left, right) =>
            compareOrdinal(left.ecosystemId, right.ecosystemId),
        );
    const countBy = (values, keys, selector) =>
        Object.fromEntries(
            keys.map((key) => [
                key,
                values.filter((value) => selector(value) === key).length,
            ]),
        );
    const componentSummary = {
        disclaimer:
            "Modeled or planned components and projections are catalog metadata only; they are not emitted, supported, installable, published, promoted, or runtime eligible.",
        total: componentsCatalog.components.length,
        byKind: countBy(
            componentsCatalog.components,
            [
                "skill",
                "agent",
                "subagent",
                "command",
                "prompt",
                "rule",
                "instruction",
                "hook",
                "mcp",
                "lsp",
                "executable-host-extension",
                "static-asset",
            ],
            (component) => component.kind,
        ),
        byTrust: countBy(
            componentsCatalog.components,
            ["passive", "executable"],
            (component) => component.classification.trust,
        ),
        byAudience: countBy(
            componentsCatalog.components,
            ["public", "cratis-engineering", "repository-only"],
            (component) => component.audience,
        ),
        byLifecycle: countBy(
            componentsCatalog.components,
            ["active", "legacy-retained"],
            (component) => component.lifecycle,
        ),
        projections: {
            total: componentProjections.projections.length,
            byState: countBy(
                componentProjections.projections,
                ["planned", "blocked", "existing", "generated-static"],
                (projection) => projection.state,
            ),
            byActivation: countBy(
                componentProjections.projections,
                ["active", "inert", "none"],
                (projection) => projection.hostActivation,
            ),
            byApproval: countBy(
                componentProjections.projections,
                ["modeled", "approved", "blocked"],
                (projection) => projection.approval,
            ),
        },
        declaredEmptyKinds: [...componentsCatalog.declaredEmptyKinds].sort(
            compareOrdinal,
        ),
    };
    const data = {
        schemaVersion: 2,
        contractVersion: humanContract.contractVersion,
        disclaimer: humanContract.disclaimer,
        inputDigest: digest,
        componentSummary,
        profiles,
        capabilities,
        hostCoverage,
    };
    const dataErrors = validateAgainstSchema(
        data,
        schema.$defs.generatedHumanCatalog,
        schema,
    );
    if (dataErrors.length > 0)
        throw new Error(
            `Generated human catalog is invalid: ${dataErrors.join("; ")}`,
        );

    const markdownLines = [
        "# Cratis AI package and capability catalog",
        "",
        `> ${markdownText(humanContract.disclaimer)}`,
        "",
        "This catalog is generated from reviewed catalog metadata. Use it to find",
        "the right package and understand its skills. It is not source authority",
        "and does not make a planned package installable.",
        "",
        `- Profiles: ${profiles.length}`,
        `- Capabilities: ${capabilities.length}`,
        `- Installable profiles: ${profiles.filter((profile) => profile.installable).length}`,
        `- Ecosystem bindings with support claims: ${support.summary.supportClaimCount}`,
        "",
        "## Component contract summary",
        "",
        componentSummary.disclaimer,
        "",
        `- Components: ${componentSummary.total}`,
        `- Passive: ${componentSummary.byTrust.passive}`,
        `- Executable: ${componentSummary.byTrust.executable}`,
        `- Legacy-retained: ${componentSummary.byLifecycle["legacy-retained"]}`,
        `- Existing adapter records: ${componentSummary.projections.byState.existing}`,
        `- Generated static fixture projections: ${componentSummary.projections.byState["generated-static"]}`,
        `- Active host projections: ${componentSummary.projections.byActivation.active}`,
        `- Inert path references: ${componentSummary.projections.byActivation.inert}`,
        `- Planned projections: ${componentSummary.projections.byState.planned}`,
        `- Non-existing blocked projections: ${componentSummary.projections.byState.blocked}`,
        `- Blocked projection approvals: ${componentSummary.projections.byApproval.blocked}`,
        `- Explicitly empty kinds: ${componentSummary.declaredEmptyKinds.join(", ")}`,
        "",
        "### Components by kind",
        "",
        ...Object.entries(componentSummary.byKind).map(
            ([kind, count]) => `- ${kind}: ${count}`,
        ),
        "",
        "## Computed ecosystem support",
        "",
        `As of ${support.asOf}, technical tiers are computed from active normalized evidence; expired and future evidence cannot satisfy gates. Marketplace listing is orthogonal.`,
        "",
        ...support.tierOrder.map(
            (tier) => `- ${tier}: ${support.summary.byTier[tier]}`,
        ),
        "",
        "No technical tier grants runtime, publication, or promotion eligibility.",
        "",
        "## Researched host coverage",
        "",
        "This matrix reports research and serving disposition only. It is not support, publication readiness, or a promise to generate a host-native adapter.",
        "",
        "| Ecosystem | Product status | Coverage | Strategy | Serving target | Generation | Technical tier | Support |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
        ...hostCoverage.map(
            (host) =>
                `| ${markdownText(host.ecosystemId)} | ${markdownText(host.productStatus)} | ${markdownText(host.coverage)} | ${markdownText(host.strategy)} | ${markdownText(host.targetId ?? "no output")} | ${markdownText(host.generationState)} | ${markdownText(host.technicalTier)} | no |`,
        ),
        "",
        "## Packages and profiles",
        "",
        "Profiles are the product and maintainer bundles people subscribe to.",
        "Only profiles marked installable have completed approval.",
        "",
        ...renderProfiles(profiles),
        "",
        "## Capabilities",
        "",
        "Capabilities are the focused skills included by one or more profiles.",
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
        throw new Error(
            `Generated manifest is invalid: ${manifestErrors.join("; ")}`,
        );
    contents.set(
        humanContract.generatedFiles.manifest,
        Buffer.from(json(manifest)),
    );
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
            else
                throw new Error(
                    "Generated human catalog contains a non-regular path",
                );
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
        renameSync(partialPaths.get(manifestPath), join(root, manifestPath));
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
