#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { validateCatalogs } from "./catalog-validation.mjs";
import { validateV2Catalogs } from "./catalog-v2-validation.mjs";
import { validateSourceEvidenceContract } from "./source-evidence-contract-validation.mjs";
import { validateCodeReviewPilot } from "./code-review-pilot-validation.mjs";
import { validateDomainExpertEventModelingPilot } from "./domain-expert-event-modeling-pilot-validation.mjs";
import { validateDistributionConfiguration } from "./generate-distribution-fixture.mjs";
import { validateEngineeringDocsAuthoring } from "./engineering-docs-authoring-validation.mjs";
import { validateEngineeringDistributionConfiguration } from "./generate-engineering-distribution-fixture.mjs";
import { validateEngineeringDocsCompanions } from "./engineering-docs-companions-validation.mjs";
import { validateProfileSubscriptions } from "./profile-subscription-validation.mjs";
import { validatePreviewReadiness } from "./preview-readiness.mjs";
import { validatePreviewRequests } from "./preview-request-validation.mjs";
import { validateReleaseRequests } from "./release-request-validation.mjs";
import { validateReleaseApprovals } from "./release-approval-validation.mjs";
import { validateEcosystemArtifactContracts } from "./ecosystem-artifact-validation.mjs";
import { validateSupportCatalogs } from "./support-validation.mjs";
import { validateReleaseAssurancePolicy } from "./release-assurance-validation.mjs";
import { validateChronicleMcpGuidance } from "./chronicle-mcp-guidance-validation.mjs";
import { validateMcpGuidanceProducts } from "./mcp-guidance-validation.mjs";
import { validateNativeNonSkillProjectionContract } from "./native-non-skill-projections.mjs";
import {
    loadRealHostCanaryContracts,
    validateRealHostCanaryMatrix,
} from "./real-host-canary-contract.mjs";
import { validateCheckedInRealHostCanaryReports } from "./validate-real-host-canary-report.mjs";
import { validateS10ReleaseGate } from "./s10-release-gate-validation.mjs";
import { validateReleaseLifecycleEvidence } from "./release-lifecycle-validation.mjs";
import { validateMarketplacePublications } from "./marketplace-publication-validation.mjs";
import {
    formatComplianceDiagnostics,
    validateSpecificationLock,
} from "./portable-compliance-validation.mjs";

const basicMode = process.argv.includes("--basic");
const basicErrors = [
    ...validateCatalogs(),
    ...validateV2Catalogs(),
    ...validateSourceEvidenceContract(),
    ...validateCodeReviewPilot(),
    ...validateDomainExpertEventModelingPilot(),
    ...validateDistributionConfiguration(),
    ...validateEngineeringDocsAuthoring(),
    ...validateEngineeringDistributionConfiguration(),
    ...validateEngineeringDocsCompanions(),
    ...validateProfileSubscriptions(),
    ...validatePreviewReadiness(),
    ...validatePreviewRequests(),
    ...validateReleaseApprovals(),
    ...validateEcosystemArtifactContracts(),
    ...validateSupportCatalogs(),
    ...validateMarketplacePublications(),
    ...validateReleaseAssurancePolicy(),
    ...validateChronicleMcpGuidance(),
    ...validateMcpGuidanceProducts(),
    ...validateNativeNonSkillProjectionContract(),
    ...validateSpecificationLock().map((diagnostic) =>
        formatComplianceDiagnostics([diagnostic]),
    ),
];
const governedErrors = basicMode
    ? []
    : [
          ...validateReleaseRequests().errors,
          ...validateRealHostCanaryMatrix(loadRealHostCanaryContracts()),
          ...validateCheckedInRealHostCanaryReports(),
          ...validateS10ReleaseGate(),
          ...validateReleaseLifecycleEvidence(),
      ];
const errors = [...basicErrors, ...governedErrors];
if (errors.length > 0) {
    process.stderr.write(
        `Catalog validation failed with ${errors.length} error(s):\n`,
    );
    for (const error of errors) process.stderr.write(`- ${error}\n`);
    process.exitCode = 1;
} else {
    process.stdout.write(
        basicMode
            ? "Basic catalog validation passed: packaging, passive preview lanes, portable standards, MCP deny rules, native projections, and distribution profiles are valid.\n"
            : "Governed catalog validation passed: basic packaging plus normalized evidence, computed support, source evidence, real-host canaries, blocked S10 readiness, lifecycle, and marketplace contracts are valid.\n",
    );
}
