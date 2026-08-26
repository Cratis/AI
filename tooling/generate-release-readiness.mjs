#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultRepositoryRoot, readCatalog } from "./catalog-validation.mjs";

export const s10ReleasePaths = Object.freeze({
    policy: "distribution/s10-release-policy.json",
    policySchema: "distribution/s10-release-policy.schema.json",
    readiness: "catalog/v2/release-readiness.json",
    readinessSchema: "catalog/schemas/release-readiness.schema.json",
    approvals: "distribution/release-approvals.json",
    approvalSchema: "distribution/release-approvals.schema.json",
    controls: "distribution/release-control-attestations.json",
    controlsSchema: "distribution/release-control-attestations.schema.json",
    marketplaces: "distribution/marketplace-publications.json",
    marketplacesSchema: "distribution/marketplace-publications.schema.json",
    lifecycleSchema: "distribution/release-lifecycle-report.schema.json",
    releaseRecordSchema: "distribution/release-record.schema.json",
    support: "catalog/v2/support.json",
    evidenceBaseline: "catalog/evidence-baseline.json",
    evidenceBaselineSchema: "catalog/evidence-baseline.schema.json",
    releases: "distribution/releases",
    releaseRecords: "distribution/release-records",
});

function jsonFiles(root, path) {
    const directory = join(root, path);
    if (!existsSync(directory)) return [];
    return readdirSync(directory)
        .filter((name) => name.endsWith(".json"))
        .sort();
}

export function computeReleaseReadiness(root = defaultRepositoryRoot) {
    const policy = readCatalog(join(root, s10ReleasePaths.policy));
    const support = readCatalog(join(root, s10ReleasePaths.support));
    const approvals = readCatalog(join(root, s10ReleasePaths.approvals));
    const controls = readCatalog(join(root, s10ReleasePaths.controls));
    const marketplaces = readCatalog(join(root, s10ReleasePaths.marketplaces));
    const releaseRequests = jsonFiles(root, s10ReleasePaths.releases);
    const releaseRecords = jsonFiles(root, s10ReleasePaths.releaseRecords);
    const blockers = [];
    const add = (code, reason) => blockers.push({ code, reason });
    if (policy.mode === "BLOCKED")
        add("policy-blocked", "S10 release policy is explicitly blocked.");
    if ((support.summary.byTier["release-tested"] ?? 0) === 0)
        add(
            "no-release-tested-binding",
            "No binding has complete released-artifact and canary evidence.",
        );
    if ((support.summary.byTier["lifecycle-tested"] ?? 0) === 0)
        add(
            "no-lifecycle-tested-binding",
            "No binding has complete install, behavior, update, rollback, uninstall, and preservation evidence.",
        );
    if (approvals.profileApprovals.length === 0)
        add("no-profile-approvals", "No exact profile prerequisite approval exists.");
    if (approvals.targetApprovals.length === 0)
        add("no-target-approvals", "No exact target prerequisite approval exists.");
    if (approvals.sourceContractApprovals.length === 0)
        add(
            "no-source-contract-approvals",
            "No exact source-contract prerequisite approval exists.",
        );
    if (controls.attestations.length === 0) {
        add(
            "no-control-attestations",
            "No active branch, workflow, environment, package, or credential-scope attestation exists.",
        );
        add(
            "no-exact-package-ownership-attestation",
            "No ownership evidence exists for the exact production package name.",
        );
        add(
            "no-trusted-publisher-attestation",
            "No exact repository, workflow, environment, and package OIDC publisher attestation exists.",
        );
    }
    if (releaseRequests.length === 0)
        add("no-release-request", "No append-only release request exists.");
    if (releaseRecords.length === 0)
        add("no-release-records", "No append-only release record exists.");
    if (marketplaces.publications.length === 0)
        add(
            "no-marketplace-publications",
            "No approved or disabled marketplace publication disposition exists.",
        );
    return {
        schemaVersion: 1,
        generatedBy: "tooling/generate-release-readiness.mjs",
        state: "BLOCKED",
        policyMode: policy.mode,
        blockers,
        releaseRequestEligible: false,
        installationEligible: false,
        runtimeEligible: false,
        publicationEligible: false,
        promotionEligible: false,
        supportGranted: false,
        marketplaceAvailabilityClaim: false,
    };
}

export function generateReleaseReadiness(root = defaultRepositoryRoot) {
    const readiness = computeReleaseReadiness(root);
    writeFileSync(
        join(root, s10ReleasePaths.readiness),
        `${JSON.stringify(readiness, null, 2)}\n`,
    );
    return readiness;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const readiness = generateReleaseReadiness(
        resolve(fileURLToPath(new URL("..", import.meta.url))),
    );
    process.stdout.write(
        `Generated S10 release readiness: ${readiness.state} (${readiness.blockers.length} blockers).\n`,
    );
}
