// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    defaultRepositoryRoot,
    readCatalog,
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";
import {
    computeReleaseReadiness,
    s10ReleasePaths,
} from "./generate-release-readiness.mjs";
import { computeEvidenceIdentityAnchors } from "./support-validation.mjs";

const expectedPolicyDigest =
    "02982ff7a36eb77025f7eda8e82d41ab671e695f7faa8dafc0d3dbcd665474ed";
const expectedEvidenceBaselineDigest =
    "bbd0b0148a8155aa3ffb4a73dfc4d2e49b5d767ed190acc5e47607c88b96bf78";
const sideEffectJobs = [
    "canary",
    "distribute",
    "publish-npm",
    "cleanup-failed-publication",
    "promote-and-follow-up",
    "record-promotion-failure",
];

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function jsonFiles(root, path) {
    const directory = join(root, path);
    if (!existsSync(directory)) return [];
    return readdirSync(directory).filter((name) => name.endsWith(".json"));
}

export function validateS10ReleaseGate(root = defaultRepositoryRoot) {
    const errors = [];
    const policyPath = join(root, s10ReleasePaths.policy);
    const policy = readCatalog(policyPath);
    const policySchema = readCatalog(join(root, s10ReleasePaths.policySchema));
    const readiness = readCatalog(join(root, s10ReleasePaths.readiness));
    const readinessSchema = readCatalog(
        join(root, s10ReleasePaths.readinessSchema),
    );
    const approvals = readCatalog(join(root, s10ReleasePaths.approvals));
    const approvalSchema = readCatalog(
        join(root, s10ReleasePaths.approvalSchema),
    );
    const controls = readCatalog(join(root, s10ReleasePaths.controls));
    const controlsSchema = readCatalog(
        join(root, s10ReleasePaths.controlsSchema),
    );
    const marketplaces = readCatalog(join(root, s10ReleasePaths.marketplaces));
    const marketplacesSchema = readCatalog(
        join(root, s10ReleasePaths.marketplacesSchema),
    );
    const lifecycleSchema = readCatalog(
        join(root, s10ReleasePaths.lifecycleSchema),
    );
    const releaseRecordSchema = readCatalog(
        join(root, s10ReleasePaths.releaseRecordSchema),
    );
    const evidenceBaselinePath = join(root, s10ReleasePaths.evidenceBaseline);
    const evidenceBaseline = readCatalog(evidenceBaselinePath);
    const evidenceBaselineSchema = readCatalog(
        join(root, s10ReleasePaths.evidenceBaselineSchema),
    );
    for (const schema of [
        policySchema,
        readinessSchema,
        approvalSchema,
        controlsSchema,
        marketplacesSchema,
        lifecycleSchema,
        releaseRecordSchema,
        evidenceBaselineSchema,
    ])
        errors.push(...validateSchemaVocabulary(schema));
    for (const [value, schema] of [
        [policy, policySchema],
        [readiness, readinessSchema],
        [approvals, approvalSchema],
        [controls, controlsSchema],
        [marketplaces, marketplacesSchema],
        [evidenceBaseline, evidenceBaselineSchema],
    ])
        errors.push(...validateAgainstSchema(value, schema, schema));
    if (sha256(readFileSync(policyPath)) !== expectedPolicyDigest)
        errors.push(
            "S10 release policy differs from the reviewed blocked anchor",
        );
    if (
        sha256(readFileSync(evidenceBaselinePath)) !==
        expectedEvidenceBaselineDigest
    )
        errors.push("S10 evidence baseline differs from the reviewed anchor");
    const expectedReadiness = computeReleaseReadiness(root);
    if (JSON.stringify(readiness) !== JSON.stringify(expectedReadiness))
        errors.push("generated S10 release readiness is stale");
    if (
        readiness.state !== "BLOCKED" ||
        readiness.releaseRequestEligible ||
        readiness.installationEligible ||
        readiness.runtimeEligible ||
        readiness.publicationEligible ||
        readiness.promotionEligible ||
        readiness.supportGranted ||
        readiness.marketplaceAvailabilityClaim
    )
        errors.push("S10 readiness must remain blocked with every grant false");
    if (
        approvals.profileApprovals.length > 0 ||
        approvals.targetApprovals.length > 0 ||
        approvals.sourceContractApprovals.length > 0 ||
        controls.attestations.length > 0 ||
        marketplaces.publications.length > 0
    )
        errors.push("S10 prerequisite authority collections must remain empty");
    if (
        jsonFiles(root, s10ReleasePaths.releases).length > 0 ||
        jsonFiles(root, s10ReleasePaths.releaseRecords).length > 0
    )
        errors.push("S10 cannot contain a release request or release record");
    const evidence = readCatalog(join(root, "catalog/evidence.json"));
    const observationIds = new Set(
        evidence.observations.map((observation) => observation.id),
    );
    const sourceIds = new Set(evidence.sources.map((source) => source.id));
    const factIds = new Set(evidence.legacyFacts.map((fact) => fact.id));
    const gapIds = new Set(evidence.legacyGaps.map((gap) => gap.id));
    const evidenceByPath = new Map(
        evidence.distributionEvidenceFiles.map((record) => [
            record.repositoryPath,
            record.digest,
        ]),
    );
    for (const id of evidenceBaseline.observationIds)
        if (!observationIds.has(id))
            errors.push(`evidence baseline lost observation ${id}`);
    for (const id of evidenceBaseline.sourceIds)
        if (!sourceIds.has(id))
            errors.push(`evidence baseline lost source ${id}`);
    for (const id of evidenceBaseline.factIds)
        if (!factIds.has(id)) errors.push(`evidence baseline lost fact ${id}`);
    for (const id of evidenceBaseline.gapIds)
        if (!gapIds.has(id)) errors.push(`evidence baseline lost gap ${id}`);
    for (const record of evidenceBaseline.distributionEvidence)
        if (evidenceByPath.get(record.repositoryPath) !== record.digest)
            errors.push(
                `evidence baseline lost or changed distribution report ${record.repositoryPath}`,
            );
    const anchors = computeEvidenceIdentityAnchors({
        ...evidence,
        observations: evidence.observations.filter((observation) =>
            evidenceBaseline.observationIds.includes(observation.id),
        ),
        sources: evidence.sources.filter((source) =>
            evidenceBaseline.sourceIds.includes(source.id),
        ),
        legacyFacts: evidence.legacyFacts.filter((fact) =>
            evidenceBaseline.factIds.includes(fact.id),
        ),
        legacyGaps: evidence.legacyGaps.filter((gap) =>
            evidenceBaseline.gapIds.includes(gap.id),
        ),
    });
    for (const key of [
        "observationIdentityAnchor",
        "sourceIdentityAnchor",
        "factIdentityAnchor",
        "gapIdentityAnchor",
    ])
        if (anchors[key] !== evidenceBaseline[key])
            errors.push(`evidence baseline identity changed: ${key}`);
    for (const reportPath of [
        "distribution/evidence/s9-pi-attempt-1-blocked-2026-08-25.json",
        "distribution/evidence/s9-pi-attempt-2-superseded-2026-08-26.json",
        "distribution/evidence/s9-pi-attempt-3-current-2026-08-26.json",
    ]) {
        const record = evidence.distributionEvidenceFiles.find(
            (candidate) => candidate.repositoryPath === reportPath,
        );
        if (
            !record ||
            record.role !== "inventory-only" ||
            record.observationIds.length
        )
            errors.push(
                `${reportPath}: S9 fixture report must remain inventory-only`,
            );
    }
    // The governed release lane's workflows have been removed along with the
    // rest of the cross-repository distribution machinery, so there is no
    // credentialed, publishing, or distribution job left to keep behind the
    // gate. Any workflow that reintroduces one has to reintroduce its own
    // reachability proof with it.
    for (const job of sideEffectJobs) {
        const owners = readdirSync(join(root, ".github/workflows")).filter(
            (filename) =>
                new RegExp(`^ {2}${job}:$`, "mu").test(
                    readFileSync(
                        join(root, ".github/workflows", filename),
                        "utf8",
                    ),
                ),
        );
        if (owners.length > 0)
            errors.push(
                `${job}: side-effect job is reachable while S10 is blocked`,
            );
    }
    const generator = readFileSync(
        join(root, "tooling/generate-approved-profile-release.mjs"),
        "utf8",
    );
    if (
        generator.includes("publicationEligible: releaseMode") ||
        generator.includes('mode === "release"') ||
        !generator.includes("S10 readiness owns release authority")
    )
        errors.push(
            "release generator still accepts event or argument authority",
        );
    return [...new Set(errors)].sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const errors = validateS10ReleaseGate();
    if (errors.length > 0) {
        for (const error of errors) process.stderr.write(`- ${error}\n`);
        process.exitCode = 1;
    } else
        process.stdout.write("S10 release gate validation passed: BLOCKED.\n");
}
