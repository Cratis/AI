// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const contract = JSON.parse(
    readFileSync(join(repositoryRoot, "distribution/npm-stage-contract.json"), "utf8"),
);
const workflow = readFileSync(
    join(repositoryRoot, ".github/workflows/distribution-npm-stage.yml"),
    "utf8",
);

test("npm stage contract keeps ownership OIDC and publication blocked", () => {
    assert.equal(contract.state, "PACK_VERIFY_READY_OWNER_AND_TRUST_MISSING");
    assert.equal(contract.package.name, "@cratis/ai");
    assert.equal(contract.package.fixturePrivate, true);
    assert.equal(contract.package.publicOwnershipConfirmed, false);
    assert.equal(contract.workflow.trustedPublisherConfigured, false);
    assert.equal(contract.workflow.oidcEnabled, false);
    assert.equal(contract.workflow.stagePublishEnabled, false);
    assert.equal(contract.workflow.publicPublishEnabled, false);
    assert.equal(
        contract.workflow.publishAutomaticallyAfterMergedReleaseRequestAndCanary,
        true,
    );
    assert.equal(
        contract.workflow.productionPath,
        ".github/workflows/release-approved-ai-profiles.yml",
    );
    assert.equal(contract.publicationEligible, false);
    assert.equal(contract.promotionEligible, false);
});

test("npm fixture workflow verifies a private scriptless package", () => {
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /package-manager-cache: false/);
    assert.match(workflow, /require\('\$package'\)\.private/);
    assert.match(workflow, /scripts === undefined/);
    assert.match(workflow, /dependencies === undefined/);
    assert.match(workflow, /distribution-fixture\.spec\.mjs/);
    assert.match(workflow, /"\$RUNNER_TEMP\/generated-distribution" "\$VERSION"/);
});

test("npm fixture workflow cannot mint OIDC or publish", () => {
    for (const forbidden of [
        "id-token: write",
        "npm publish",
        "npm stage publish",
        "NODE_AUTH_TOKEN",
        "NPM_TOKEN",
        "pull_request:",
        "release:",
    ])
        assert.equal(workflow.includes(forbidden), false, forbidden);
});
