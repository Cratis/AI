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
const workflowPath = join(
    repositoryRoot,
    ".github/workflows/distribution-generated-update.yml",
);
const contractPath = join(
    repositoryRoot,
    "distribution/update-bot-contract.json",
);

function workflowText() {
    return readFileSync(workflowPath, "utf8");
}

test("generated update bot contract remains credential and release gated", () => {
    const contract = JSON.parse(readFileSync(contractPath, "utf8"));
    assert.equal(contract.state, "WORKFLOW_READY_CREDENTIALS_MISSING");
    assert.equal(contract.githubApp.configured, false);
    assert.deepEqual(contract.githubApp.installationScope, [
        "Cratis/AI",
        "Cratis/AI.Distribution",
    ]);
    assert.deepEqual(contract.githubApp.requiredPermissions, {
        metadata: "read",
        contents: "write",
        pullRequests: "write",
    });
    assert.equal(contract.workflow.directPushToBaseAllowed, false);
    assert.equal(
        contract.workflow.productionPullRequestEnabledAfterCredentialSetup,
        true,
    );
    assert.equal(contract.workflow.releaseOnMerge, true);
    assert.equal(contract.workflow.generatedIndexAutoMergeRequired, true);
    assert.equal(contract.publicationEligible, false);
    assert.equal(contract.promotionEligible, false);
    assert.equal(contract.legacyRetirementEligible, false);
});

test("generated update workflow scopes the GitHub App token to one repository", () => {
    const workflow = workflowText();
    assert.match(
        workflow,
        /actions\/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1/,
    );
    assert.match(workflow, /repositories: AI\.Distribution/);
    assert.match(workflow, /permission-contents: write/);
    assert.match(workflow, /permission-pull-requests: write/);
    assert.match(workflow, /AI_DISTRIBUTION_APP_ID/);
    assert.match(workflow, /AI_DISTRIBUTION_APP_PRIVATE_KEY/);
    assert.match(workflow, /environment: distribution-canary/);
    assert.match(workflow, /version_slug="\$\{VERSION\/\/\.\/-\}"/);
    assert.match(workflow, /gh pr create/);
    assert.match(workflow, /--repo Cratis\/AI\.Distribution/);
    assert.match(workflow, /--base main/);
});

test("generated update workflow cannot publish or bypass protected main", () => {
    const workflow = workflowText();
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /create-fixture-pr/);
    assert(workflow.includes('[[ "$VERSION" =~ ^0\\.0\\.[0-9]+-fixture$ ]]'));
    assert.equal(
        workflow.match(/"\$RUNNER_TEMP\/generated-distribution" "\$VERSION"/g)
            ?.length,
        2,
    );
    for (const forbidden of [
        "push origin main",
        "push --force",
        "push -f",
        "gh release create",
        "npm publish",
        "npm stage publish",
        "git tag",
        "pull_request:",
    ])
        assert.equal(workflow.includes(forbidden), false, forbidden);
});
