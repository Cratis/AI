// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);
const contract = JSON.parse(
    readFileSync(
        join(repositoryRoot, "distribution/npm-stage-contract.json"),
        "utf8",
    ),
);
const workflow = readFileSync(
    join(repositoryRoot, ".github/workflows/distribution-npm-stage.yml"),
    "utf8",
);

test("npm stage contract records owner setup while bootstrap deprecation remains", () => {
    assert.equal(
        contract.state,
        "OWNER_CONFIGURED_BOOTSTRAP_DEPRECATION_REQUIRED",
    );
    assert.equal(contract.package.fixtureName, "@cratis/ai");
    assert.equal(contract.package.productionName, "@cratis/ai-fundamentals");
    assert.equal(contract.package.fixturePrivate, true);
    assert.equal(contract.package.publicOwnershipConfirmed, true);
    assert.equal(contract.package.bootstrapVersion, "0.0.0-bootstrap.0");
    assert.equal(contract.package.bootstrapDeprecationRequired, true);
    assert.equal(contract.package.bootstrapDeprecationConfirmed, false);
    assert.equal(
        contract.package.latestTagPolicy,
        "stable-or-deprecated-bootstrap-never-preview",
    );
    assert.equal(contract.package.latestTagSafe, false);
    assert.deepEqual(contract.package.ownerSetupEvidence, {
        confirmedBy: "woksin.sindre",
        confirmedOn: "2026-08-27",
        publicRegistryStatusVerified: true,
        writeCollaboratorVerified: true,
        trustedPublisherConfiguration: "owner-attested",
    });
    assert.equal(contract.workflow.trustedPublisherConfigured, true);
    assert.deepEqual(contract.workflow.trustedPublisher, {
        provider: "github-actions",
        organization: "Cratis",
        repository: "AI",
        workflowFilename: "release-passive-previews.yml",
        environment: "npm-stage",
        allowedOperation: "npm publish",
    });
    assert.equal(contract.workflow.oidcEnabled, true);
    assert.equal(contract.workflow.stagePublishEnabled, false);
    assert.equal(contract.workflow.publicPublishEnabled, true);
    assert.equal(
        contract.workflow.currentOperation,
        "DEPRECATE_BOOTSTRAP_LATEST_VERSION",
    );
    assert.equal(
        contract.workflow.passivePreviewPath,
        ".github/workflows/release-passive-previews.yml",
    );
    assert.equal(
        contract.workflow
            .publishAutomaticallyAfterMergedReleaseRequestAndCanary,
        true,
    );
    assert.equal(
        contract.workflow.productionPath,
        ".github/workflows/release-approved-ai-profiles.yml",
    );
    assert.equal(contract.previewRequestEligible, false);
    assert.equal(contract.publicationEligible, false);
    assert.equal(contract.promotionEligible, false);
});

test("npm fixture workflow verifies a private scriptless package", () => {
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /package-manager-cache: false/);
    assert.match(workflow, /require\('\$package'\)\.private/);
    assert(workflow.includes('= "@cratis/ai"'));
    assert.match(workflow, /scripts === undefined/);
    assert.match(workflow, /dependencies === undefined/);
    assert.match(workflow, /distribution-fixture\.spec\.mjs/);
    assert.match(
        workflow,
        /"\$RUNNER_TEMP\/generated-distribution" "\$VERSION"/,
    );
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
