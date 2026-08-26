// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
} from "../catalog-validation.mjs";
import { generateApprovedProfileRelease } from "../generate-approved-profile-release.mjs";
import {
    computeReleaseReadiness,
    s10ReleasePaths,
} from "../generate-release-readiness.mjs";
import {
    validateReleaseLifecycleEvidence,
    validateReleaseLifecycleReport,
} from "../release-lifecycle-validation.mjs";
import { validateMarketplacePublications } from "../marketplace-publication-validation.mjs";
import { validateS10ReleaseGate } from "../s10-release-gate-validation.mjs";
import { computeEvidenceIdentityAnchors } from "../support-validation.mjs";

function clone(value) {
    return structuredClone(value);
}

test("S10 readiness is deterministically blocked with every authority false", () => {
    assert.deepEqual(validateS10ReleaseGate(), []);
    assert.deepEqual(validateReleaseLifecycleEvidence(), []);
    assert.deepEqual(validateMarketplacePublications(), []);
    const readiness = readCatalog(
        join(defaultRepositoryRoot, s10ReleasePaths.readiness),
    );
    assert.deepEqual(readiness, computeReleaseReadiness());
    assert.equal(readiness.state, "BLOCKED");
    assert.equal(readiness.blockers.length, 12);
    for (const field of [
        "releaseRequestEligible",
        "installationEligible",
        "runtimeEligible",
        "publicationEligible",
        "promotionEligible",
        "supportGranted",
        "marketplaceAvailabilityClaim",
    ])
        assert.equal(readiness[field], false);
});

test("S10 authority schemas are closed and all authority collections are empty", () => {
    for (const [valuePath, schemaPath] of [
        [s10ReleasePaths.policy, s10ReleasePaths.policySchema],
        [s10ReleasePaths.readiness, s10ReleasePaths.readinessSchema],
        [s10ReleasePaths.approvals, s10ReleasePaths.approvalSchema],
        [s10ReleasePaths.controls, s10ReleasePaths.controlsSchema],
        [s10ReleasePaths.marketplaces, s10ReleasePaths.marketplacesSchema],
    ]) {
        const value = clone(
            readCatalog(join(defaultRepositoryRoot, valuePath)),
        );
        const schema = readCatalog(join(defaultRepositoryRoot, schemaPath));
        value.unexpected = true;
        assert(
            validateAgainstSchema(value, schema, schema).some((error) =>
                error.includes("unknown property unexpected"),
            ),
        );
    }
    assert.deepEqual(
        readCatalog(join(defaultRepositoryRoot, s10ReleasePaths.approvals)),
        {
            schemaVersion: "1.0.0",
            defaultPolicy: "deny",
            profileApprovals: [],
            targetApprovals: [],
            sourceContractApprovals: [],
        },
    );
    assert.deepEqual(
        readCatalog(join(defaultRepositoryRoot, s10ReleasePaths.controls))
            .attestations,
        [],
    );
    assert.deepEqual(
        readCatalog(join(defaultRepositoryRoot, s10ReleasePaths.marketplaces))
            .publications,
        [],
    );
});

test("evidence baseline preserves all existing identities while allowing append-only growth", () => {
    const evidence = readCatalog(
        join(defaultRepositoryRoot, "catalog/evidence.json"),
    );
    const baseline = readCatalog(
        join(defaultRepositoryRoot, s10ReleasePaths.evidenceBaseline),
    );
    const protectedEvidence = {
        ...evidence,
        observations: evidence.observations.filter((observation) =>
            baseline.observationIds.includes(observation.id),
        ),
        sources: evidence.sources.filter((source) =>
            baseline.sourceIds.includes(source.id),
        ),
    };
    const anchors = computeEvidenceIdentityAnchors(protectedEvidence);
    for (const key of [
        "observationIdentityAnchor",
        "sourceIdentityAnchor",
        "factIdentityAnchor",
        "gapIdentityAnchor",
    ])
        assert.equal(anchors[key], baseline[key]);
    assert.equal(baseline.correctionPolicy.reuseIdentityAllowed, false);
    assert.equal(baseline.correctionPolicy.requiresSupersedes, true);
});

test("synthetic and future S9 reports remain inventory-only and cannot authorize S10", () => {
    const evidence = readCatalog(
        join(defaultRepositoryRoot, "catalog/evidence.json"),
    );
    for (const path of [
        "distribution/evidence/s9-pi-attempt-1-blocked-2026-08-25.json",
        "distribution/evidence/s9-pi-attempt-2-superseded-2026-08-26.json",
        "distribution/evidence/s9-pi-attempt-3-current-2026-08-26.json",
    ]) {
        const record = evidence.distributionEvidenceFiles.find(
            (candidate) => candidate.repositoryPath === path,
        );
        assert.equal(record.role, "inventory-only");
        assert.deepEqual(record.observationIds, []);
    }
    const support = readCatalog(
        join(defaultRepositoryRoot, "catalog/v2/support.json"),
    );
    assert.equal(support.summary.byTier["install-tested"], 0);
    assert.equal(support.summary.byTier["lifecycle-tested"], 0);
    assert.equal(support.summary.byTier["release-tested"], 0);
    assert.equal(support.summary.supportClaimCount, 0);
});

test("production lifecycle requires complete non-synthetic A-to-B-to-A evidence", () => {
    const schema = readCatalog(
        join(defaultRepositoryRoot, s10ReleasePaths.lifecycleSchema),
    );
    const digestA = "a".repeat(64);
    const digestB = "b".repeat(64);
    const phaseIds = [
        "preflight",
        "artifact-validation",
        "negative-baseline",
        "collision-negative",
        "install",
        "discovery",
        "behavior-positive",
        "behavior-negative",
        "update",
        "rollback",
        "uninstall",
        "project-context-preservation",
        "cleanup",
    ];
    const report = {
        schemaVersion: 1,
        state: "COMPLETE",
        synthetic: false,
        sourceRevision: "c".repeat(40),
        artifactId: "release-artifact",
        artifactDigest: digestA,
        packageName: "@cratis/ai-fundamentals",
        versionA: "1.0.0",
        versionB: "1.1.0",
        profileId: "public-fundamentals",
        targetId: "cratis-fundamentals-concept",
        bindingId: "pi-packages-artifact-binding",
        harnessId: "pi",
        hostVersion: "0.84.3",
        executableDigest: "d".repeat(64),
        environmentDigest: "e".repeat(64),
        phases: phaseIds.map((id) => ({
            id,
            status: "PASS",
            argv: ["host", id],
            exitCode: 0,
            transcriptDigest: "f".repeat(64),
            selectedPath: "/isolated/skill/SKILL.md",
            selectedDigest: id === "update" ? digestB : digestA,
        })),
        evidenceIds: ["release-evidence"],
    };
    assert.deepEqual(validateReleaseLifecycleReport(report, schema), []);
    const mismatchedArtifact = clone(report);
    mismatchedArtifact.artifactDigest = "0".repeat(64);
    assert(
        validateReleaseLifecycleReport(mismatchedArtifact, schema).some(
            (error) => error.includes("does not match installed"),
        ),
    );
    report.synthetic = true;
    report.versionB = report.versionA;
    report.phases.find((phase) => phase.id === "rollback").selectedDigest =
        digestB;
    const errors = validateReleaseLifecycleReport(report, schema);
    assert(errors.some((error) => error.includes("expected constant false")));
    assert(errors.some((error) => error.includes("distinct versions")));
    assert(errors.some((error) => error.includes("A-to-B-to-A")));
});

test("candidate generation cannot accept release authority as an argument", () => {
    assert.throws(
        () =>
            generateApprovedProfileRelease({
                outputRoot: "/unused",
                profileId: "public-fundamentals",
                version: "1.0.0",
                releaseMode: true,
            }),
        /S10 readiness owns release authority/u,
    );
});

test("every credentialed or publication workflow job is unreachable in blocked mode", () => {
    const workflow = readFileSync(
        join(
            defaultRepositoryRoot,
            ".github/workflows/release-approved-ai-profiles.yml",
        ),
        "utf8",
    );
    assert.match(workflow, /^  s10_preflight:/mu);
    assert.match(workflow, /release_allowed=false/u);
    assert.match(workflow, /release-merge-topology-validation\.mjs/u);
    for (const job of [
        "canary",
        "distribute",
        "publish-npm",
        "cleanup-failed-publication",
        "promote-and-follow-up",
        "record-promotion-failure",
    ]) {
        const start = workflow.indexOf(`  ${job}:`);
        const remaining = workflow.slice(start + job.length + 3);
        const next = remaining.match(/\n  [a-zA-Z0-9_-]+:\n/u);
        const block = workflow.slice(
            start,
            next ? start + job.length + 3 + next.index : undefined,
        );
        assert.match(block, /s10_preflight/u);
        assert.match(block, /release_allowed == 'true'/u);
    }
    const distributionWorkflow = readFileSync(
        join(
            defaultRepositoryRoot,
            ".github/workflows/distribution-approved-profile-release.yml",
        ),
        "utf8",
    );
    assert.doesNotMatch(
        distributionWorkflow,
        /          - create-generated-pr/u,
    );
    assert.match(distributionWorkflow, /if: \$\{\{ false \}\}/u);
    assert.doesNotMatch(
        readFileSync(
            join(
                defaultRepositoryRoot,
                "tooling/generate-approved-profile-release.mjs",
            ),
            "utf8",
        ),
        /publicationEligible: releaseMode|mode === "release"/u,
    );
});
