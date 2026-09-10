// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareOrdinal } from "./catalog-ordering.mjs";
import {
    assertComponentInventorySeals,
    componentInventoryCounts,
} from "./component-inventory-counts.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

function readCatalog(root, path) {
    try {
        return JSON.parse(readFileSync(join(root, path), "utf8"));
    } catch (error) {
        throw new Error(`Unable to read component coverage input: ${path}`, {
            cause: error,
        });
    }
}

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

// `assertSeals` exists for exactly one caller: `component-inventory-counts.mjs --print`, which has
// to be able to report the real counts after a migration precisely because the seal is stale. Every
// other caller takes the default and stays fail-closed.
export function buildCandidateComponentCoverage(
    repositoryRoot = defaultRepositoryRoot,
    { assertSeals = true } = {},
) {
    const root = resolve(repositoryRoot);
    const paths = {
        components: "catalog/v2/components.json",
        projections: "catalog/v2/component-projections.json",
        artifacts: "catalog/v2/artifacts.json",
    };
    const componentsCatalog = readCatalog(root, paths.components);
    const projectionsCatalog = readCatalog(root, paths.projections);
    const artifactsCatalog = readCatalog(root, paths.artifacts);
    if (
        !Array.isArray(componentsCatalog.components) ||
        !Array.isArray(projectionsCatalog.projections) ||
        !Array.isArray(artifactsCatalog.artifacts)
    ) {
        throw new Error("Candidate component coverage inputs are malformed");
    }
    const components = componentsCatalog.components;
    const projectionsByComponent = new Map();
    for (const projection of projectionsCatalog.projections) {
        const records =
            projectionsByComponent.get(projection.componentId) ?? [];
        records.push(projection);
        projectionsByComponent.set(projection.componentId, records);
    }
    const candidateArtifacts = [
        "candidate-passive-public-package",
        "candidate-passive-engineering-package",
    ].map((id) => {
        const artifact = artifactsCatalog.artifacts.find(
            (candidate) => candidate.id === id,
        );
        if (
            !artifact ||
            artifact.materializationClass !== "review-candidate" ||
            artifact.materializationAllowed !== true ||
            artifact.runtimeEligible !== false ||
            artifact.requiresApprovedTargets !== false
        ) {
            throw new Error(`${id}: review-candidate authority changed`);
        }
        return artifact;
    });
    const packagedSkills = new Set(
        candidateArtifacts.flatMap(
            (artifact) => artifact.componentInventory.skills,
        ),
    );
    const blockedSkills = new Map(
        candidateArtifacts.flatMap((artifact) =>
            artifact.targetExclusions.map((exclusion) => [
                exclusion.targetId,
                exclusion.reason,
            ]),
        ),
    );
    const records = components.map((component) => {
        const projections = projectionsByComponent.get(component.id) ?? [];
        const existingProjectionCount = projections.filter(
            (projection) => projection.state === "existing",
        ).length;
        const generatedStaticProjectionCount = projections.filter(
            (projection) => projection.state === "generated-static",
        ).length;
        let disposition;
        let reason;
        if (component.kind === "skill") {
            if (packagedSkills.has(component.id)) {
                disposition = "skill-packaged-candidate";
                reason = "included-in-passive-review-candidate";
            } else if (blockedSkills.has(component.id)) {
                disposition = "skill-blocked-candidate";
                reason = blockedSkills.get(component.id);
            } else if (
                component.releaseBoundary === "repository-only" &&
                component.lifecycle === "legacy-retained"
            ) {
                disposition = "skill-legacy-repository-only";
                reason = "legacy-retained-repository-only";
            } else {
                throw new Error(
                    `${component.id}: skill has no candidate disposition`,
                );
            }
        } else if (["rule", "instruction"].includes(component.kind)) {
            if (generatedStaticProjectionCount > 0) {
                disposition = "native-static-review-projected";
                reason = "generated-static-repository-fixture";
            } else {
                disposition = "native-static-unprojected";
                reason = "no-generated-static-contract";
            }
        } else if (
            ["agent", "command", "prompt"].includes(component.kind) &&
            component.classification.executable === false &&
            existingProjectionCount > 0
        ) {
            disposition = "repository-host-adapter-only";
            reason = "repository-native-kind-no-package-contract";
        } else if (
            ["hook", "executable-host-extension"].includes(component.kind) &&
            component.classification.executable === true
        ) {
            disposition = "executable-blocked";
            reason = "executable-component-blocked";
        } else {
            throw new Error(
                `${component.id}: component has no candidate disposition`,
            );
        }
        return {
            componentId: component.id,
            kind: component.kind,
            audience: component.audience,
            lifecycle: component.lifecycle,
            releaseBoundary: component.releaseBoundary,
            disposition,
            reason,
            existingProjectionCount,
            generatedStaticProjectionCount,
            approvalState: component.approval.state,
            runtimeEligible: false,
            publicationEligible: false,
            supportGranted: false,
        };
    });
    records.sort((left, right) =>
        compareOrdinal(left.componentId, right.componentId),
    );
    const componentIds = records.map((record) => record.componentId);
    // Uniqueness is an invariant of the derivation, not a reviewed size, so it stays here.
    if (new Set(componentIds).size !== records.length)
        throw new Error(
            "Candidate component coverage derived duplicate component ids",
        );
    const counts = componentInventoryCounts(records);
    // The reviewed sizes live in distribution/candidate-component-coverage.seals.json, once.
    if (assertSeals) assertComponentInventorySeals(counts, root);
    const schemaPath = "distribution/candidate-component-coverage.schema.json";
    return {
        schemaVersion: "1.0.0",
        schemaPath,
        schemaSha256: sha256(readFileSync(join(root, schemaPath))),
        state: "CANDIDATE_COMPONENT_COVERAGE_REVIEW_ONLY",
        inputDigests: Object.fromEntries(
            Object.entries(paths).map(([name, path]) => [
                name,
                sha256(readFileSync(join(root, path))),
            ]),
        ),
        componentCount: counts.componentCount,
        byKind: counts.byKind,
        byDisposition: counts.byDisposition,
        records,
        approvalGranted: false,
        installationSupported: false,
        publicationEligible: false,
        runtimeEligible: false,
        supportGranted: false,
        promotionEligible: false,
    };
}
