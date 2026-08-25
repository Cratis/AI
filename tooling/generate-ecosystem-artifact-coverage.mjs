#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareOrdinal, sortedOrdinal } from "./catalog-ordering.mjs";

export const ecosystemArtifactCoveragePath =
    "catalog/v2/ecosystem-artifact-coverage.json";
export const ecosystemArtifactBindingsPath =
    "distribution/ecosystem-artifact-bindings.json";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
export const defaultRepositoryRoot = resolve(moduleDirectory, "..");

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

export function generateEcosystemArtifactCoverage(
    root = defaultRepositoryRoot,
) {
    const bindingsCatalog = readJson(join(root, ecosystemArtifactBindingsPath));
    const hostCatalog = readJson(join(root, "catalog/host-adapters.json"));
    const hostByEcosystem = new Map(
        hostCatalog.hosts.map((record) => [record.ecosystemId, record]),
    );
    const supportCatalog = readJson(join(root, "catalog/v2/support.json"));
    const supportByBinding = new Map(
        supportCatalog.bindings.map((record) => [record.bindingId, record]),
    );
    const coverage = bindingsCatalog.bindings
        .map((binding) => {
            const support = supportByBinding.get(binding.id);
            if (!support)
                throw new Error(`Missing computed support for ${binding.id}`);
            const host = hostByEcosystem.get(binding.ecosystemId);
            return {
                bindingId: binding.id,
                ecosystemId: binding.ecosystemId,
                hostAdapterId: host?.id ?? null,
                hostDisposition:
                    host?.supportDisposition.coverage ?? "not-applicable",
                interfaceId: binding.interfaceId,
                requirementId: binding.requirementId,
                targetId: binding.targetId,
                harnessId: binding.harnessId,
                outputRoot: binding.outputRoot,
                artifactClass: binding.artifactClass,
                strategy: binding.strategy,
                assuranceProfileId: binding.assuranceProfileId,
                evidenceIds: sortedOrdinal(binding.evidenceIds),
                generationState: binding.generationState,
                technicalTier: support.effectiveTier,
                technicalTierRank: support.rank,
                activeEvidenceIds: support.activeEvidenceIds,
                expiredEvidenceIds: support.expiredEvidenceIds,
                missingAssurances: support.missingAssurances,
                marketplaceStatus: support.marketplace.status,
                supportClaim: support.supportClaim,
            };
        })
        .sort((left, right) => compareOrdinal(left.bindingId, right.bindingId));

    return {
        schemaVersion: 1,
        generatedBy: "tooling/generate-ecosystem-artifact-coverage.mjs",
        state: bindingsCatalog.state,
        publicationEligible: false,
        promotionEligible: false,
        supportPolicy:
            "Generated coverage records cataloged compatibility and generation state; they are not support claims.",
        coverage,
    };
}

export function writeEcosystemArtifactCoverage(root = defaultRepositoryRoot) {
    const catalog = generateEcosystemArtifactCoverage(root);
    writeFileSync(
        join(root, ecosystemArtifactCoveragePath),
        `${JSON.stringify(catalog, null, 2)}\n`,
    );
    return catalog;
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    const catalog = writeEcosystemArtifactCoverage();
    process.stdout.write(
        `Generated ecosystem artifact coverage: ${catalog.coverage.length} bindings (coverage is not support).\n`,
    );
}
