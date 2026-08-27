// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { validateMarketplacePublications } from "../marketplace-publication-validation.mjs";
import { validateReleaseApprovals } from "../release-approval-validation.mjs";
import { validateSupportCatalogs } from "../support-validation.mjs";

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

test("basic lane rejects support release and marketplace claims", () => {
    assert.deepEqual(validateSupportCatalogs(), []);
    assert.deepEqual(validateReleaseApprovals(), []);
    assert.deepEqual(validateMarketplacePublications(), []);
    const support = readJson("catalog/v2/support.json");
    assert.equal(support.summary.supportClaimCount, 0);
    assert.equal(support.summary.byTier.supported, 0);
    for (const binding of support.bindings) {
        assert.equal(binding.supportClaim, false);
        assert.equal(binding.marketplace.availabilityClaim, false);
        assert.equal(binding.marketplace.status, "not-claimed");
    }
    const approvals = readJson("distribution/release-approvals.json");
    assert.deepEqual(approvals.profileApprovals, []);
    assert.deepEqual(approvals.targetApprovals, []);
    assert.deepEqual(approvals.sourceContractApprovals, []);
    const marketplaces = readJson("distribution/marketplace-publications.json");
    assert.deepEqual(marketplaces.publications, []);
});

test("basic lane required workflow regenerates support before validation", () => {
    const workflow = readFileSync(
        ".github/workflows/verify-ai-corpus.yml",
        "utf8",
    );
    assert(workflow.includes("generate-support.mjs"));
    assert(workflow.includes("catalog/v2/support.json"));
    assert(workflow.includes("validate-catalogs.mjs --basic"));
    assert(workflow.includes("run-spec-suite.mjs --basic"));
});
