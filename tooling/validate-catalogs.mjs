#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { validateCatalogs } from "./catalog-validation.mjs";
import { validateV2Catalogs } from "./catalog-v2-validation.mjs";
import { validateSourceEvidenceContract } from "./source-evidence-contract-validation.mjs";
import { validateCodeReviewPilot } from "./code-review-pilot-validation.mjs";
import { validateDomainExpertEventModelingPilot } from "./domain-expert-event-modeling-pilot-validation.mjs";

const errors = [
    ...validateCatalogs(),
    ...validateV2Catalogs(),
    ...validateSourceEvidenceContract(),
    ...validateCodeReviewPilot(),
    ...validateDomainExpertEventModelingPilot(),
];
if (errors.length > 0) {
    process.stderr.write(
        `Catalog validation failed with ${errors.length} error(s):\n`,
    );
    for (const error of errors) process.stderr.write(`- ${error}\n`);
    process.exitCode = 1;
} else {
    process.stdout.write(
        "Catalog validation passed: 3 legacy catalogs, 13 v2 catalogs, and 4 schemas are valid.\n",
    );
}
