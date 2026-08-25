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
import { validateReleaseRequests } from "./release-request-validation.mjs";
import { validateReleaseApprovals } from "./release-approval-validation.mjs";
import { validateEcosystemArtifactContracts } from "./ecosystem-artifact-validation.mjs";
import { validateSupportCatalogs } from "./support-validation.mjs";
import { validateReleaseAssurancePolicy } from "./release-assurance-validation.mjs";
import { validateChronicleMcpGuidance } from "./chronicle-mcp-guidance-validation.mjs";
import { validateMcpGuidanceProducts } from "./mcp-guidance-validation.mjs";
import {
    formatComplianceDiagnostics,
    validateSpecificationLock,
} from "./portable-compliance-validation.mjs";

const errors = [
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
    ...validateReleaseRequests().errors,
    ...validateReleaseApprovals(),
    ...validateEcosystemArtifactContracts(),
    ...validateSupportCatalogs(),
    ...validateReleaseAssurancePolicy(),
    ...validateChronicleMcpGuidance(),
    ...validateMcpGuidanceProducts(),
    ...validateSpecificationLock().map((diagnostic) =>
        formatComplianceDiagnostics([diagnostic]),
    ),
];
if (errors.length > 0) {
    process.stderr.write(
        `Catalog validation failed with ${errors.length} error(s):\n`,
    );
    for (const error of errors) process.stderr.write(`- ${error}\n`);
    process.exitCode = 1;
} else {
    process.stdout.write(
        "Catalog validation passed: legacy, v2, normalized evidence, computed support, source-evidence, multi-product MCP guidance, offline portable specifications, distribution-profile, and evaluation contracts are valid.\n",
    );
}
