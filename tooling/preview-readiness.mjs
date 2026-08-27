#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

function readJson(root, path) {
    try {
        return JSON.parse(readFileSync(join(root, path), "utf8"));
    } catch (error) {
        throw new Error(`Unable to read preview readiness input: ${path}`, {
            cause: error,
        });
    }
}

function validateWithSchema(root, value, schemaPath) {
    const schema = readJson(root, schemaPath);
    const errors = [
        ...validateSchemaVocabulary(schema),
        ...validateAgainstSchema(value, schema, schema),
    ];
    if (errors.length > 0)
        throw new Error(`${schemaPath}: ${errors.join("; ")}`);
}

const expectedPreviewChecks = Object.freeze([
    "deterministic-generation",
    "static-contract-validation",
    "secret-and-path-scanning",
    "schema-validation",
    "checksums",
    "independent-review",
    "basic-pack-install-discovery-uninstall-smoke",
    "exact-version-rollback",
]);

function addBlocker(blockers, code, reason) {
    blockers.push({ code, reason });
}

export function buildPreviewReadiness(
    repositoryRoot = defaultRepositoryRoot,
) {
    const root = resolve(repositoryRoot);
    const lanes = readJson(root, "distribution/assurance-lanes.json");
    validateWithSchema(
        root,
        lanes,
        "distribution/assurance-lanes.schema.json",
    );
    const profileCatalog = readJson(root, "distribution/profile-catalog.json");
    const targets = readJson(root, "catalog/v2/targets.json").targets;
    const artifacts = readJson(root, "catalog/v2/artifacts.json").artifacts;
    const npmStage = readJson(root, "distribution/npm-stage-contract.json");
    const previewLane = lanes.lanes.find(
        (lane) => lane.id === "passive-preview",
    );
    if (
        !previewLane ||
        previewLane.assuranceMode !== "basic" ||
        previewLane.channel !== "preview" ||
        previewLane.passiveOnly !== true ||
        previewLane.publicationAllowed !== true ||
        previewLane.supportClaimAllowed !== false ||
        previewLane.governedReadinessRequired !== false ||
        JSON.stringify(previewLane.requiredChecks) !==
            JSON.stringify(expectedPreviewChecks)
    )
        throw new Error("Passive preview lane authority changed");
    const profile = profileCatalog.publicProfiles.find(
        (candidate) => candidate.id === lanes.selectedPreview.profileId,
    );
    if (
        !profile ||
        profile.state !== "preview-source-candidate" ||
        profile.packageName !== lanes.selectedPreview.packageName ||
        JSON.stringify(profile.availableTargets) !==
            JSON.stringify(["cratis-fundamentals-concept"])
    )
        throw new Error("Selected passive preview profile changed");
    const target = targets.find(
        (candidate) => candidate.id === "cratis-fundamentals-concept",
    );
    if (
        !target ||
        target.trust?.class !== "passive" ||
        target.security?.disposition !== "accepted" ||
        target.approval?.state !== "candidate" ||
        target.includeInRuntime !== false ||
        Object.values(target.evaluations ?? {}).some(
            (evaluation) => evaluation.status !== "passing",
        )
    )
        throw new Error("Fundamentals preview target is not statically ready");
    const artifact = artifacts.find(
        (candidate) => candidate.id === "cratis-fundamentals-concept-preview",
    );
    if (
        !artifact ||
        artifact.materializationClass !== "test-fixture" ||
        artifact.materializationAllowed !== true ||
        artifact.runtimeEligible !== false
    )
        throw new Error("Fundamentals preview artifact changed");
    const blockers = [];
    if (
        npmStage.package.productionName !==
        lanes.selectedPreview.packageName
    )
        throw new Error("Preview production package name is not reconciled");
    if (npmStage.package.publicOwnershipConfirmed !== true)
        addBlocker(
            blockers,
            "package-ownership-unconfirmed",
            "Exact npm package ownership is not confirmed.",
        );
    if (npmStage.workflow.trustedPublisherConfigured !== true)
        addBlocker(
            blockers,
            "trusted-publisher-not-configured",
            "The exact npm trusted publisher is not configured.",
        );
    if (npmStage.workflow.oidcEnabled !== true)
        addBlocker(
            blockers,
            "oidc-not-enabled",
            "OIDC publication is not enabled.",
        );
    if (npmStage.workflow.publicPublishEnabled !== true)
        addBlocker(
            blockers,
            "public-preview-publish-disabled",
            "Public preview publication remains disabled.",
        );
    const previewWorkflowPath = join(
        root,
        ".github/workflows/release-passive-previews.yml",
    );
    if (!existsSync(previewWorkflowPath)) {
        addBlocker(
            blockers,
            "preview-release-workflow-not-implemented",
            "The passive preview request and publication workflow is not implemented.",
        );
    } else {
        const previewWorkflow = readFileSync(previewWorkflowPath, "utf8");
        for (const requiredCheck of expectedPreviewChecks)
            if (!previewWorkflow.includes(requiredCheck))
                throw new Error(
                    `Preview release workflow omits required check ${requiredCheck}`,
                );
        for (const requiredControl of [
            `name: ${lanes.selectedPreview.requiredStatusContext}`,
            `environment: ${lanes.selectedPreview.protectedEnvironment}`,
        ])
            if (!previewWorkflow.includes(requiredControl))
                throw new Error(
                    `Preview release workflow omits ${requiredControl}`,
                );
    }
    const readiness = {
        schemaVersion: 1,
        generatedBy: "tooling/preview-readiness.mjs",
        state:
            blockers.length === 0
                ? "READY_FOR_PREVIEW_REQUEST"
                : "OWNER_SETUP_REQUIRED",
        lane: "passive-preview",
        assuranceMode: "basic",
        profileId: profile.id,
        packageName: profile.packageName,
        targetIds: [...profile.availableTargets],
        staticCandidateReady: true,
        blockers,
        governedAssurance: {
            requiredForPreview: false,
            availableForGraduation: true,
            readinessPath: lanes.advancedAssurance.readinessPath,
        },
        previewRequestEligible: blockers.length === 0,
        publicationEligible: false,
        supportGranted: false,
    };
    validateWithSchema(
        root,
        readiness,
        "distribution/preview-readiness.schema.json",
    );
    return readiness;
}

export function validatePreviewReadiness(
    repositoryRoot = defaultRepositoryRoot,
) {
    try {
        const expected = buildPreviewReadiness(repositoryRoot);
        const actual = readJson(
            resolve(repositoryRoot),
            "distribution/preview-readiness.json",
        );
        validateWithSchema(
            resolve(repositoryRoot),
            actual,
            "distribution/preview-readiness.schema.json",
        );
        return JSON.stringify(actual) === JSON.stringify(expected)
            ? []
            : ["Generated passive preview readiness is stale"];
    } catch (error) {
        return [
            error instanceof Error
                ? error.message
                : "Passive preview readiness validation failed",
        ];
    }
}

export function generatePreviewReadiness(
    repositoryRoot = defaultRepositoryRoot,
) {
    const readiness = buildPreviewReadiness(repositoryRoot);
    writeFileSync(
        join(repositoryRoot, "distribution/preview-readiness.json"),
        `${JSON.stringify(readiness, null, 2)}\n`,
    );
    return readiness;
}

function main() {
    try {
        const readiness = generatePreviewReadiness();
        process.stdout.write(
            `Generated ${readiness.lane} readiness: ${readiness.state} ` +
                `(${readiness.blockers.length} blockers).\n`,
        );
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "Preview readiness generation failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
