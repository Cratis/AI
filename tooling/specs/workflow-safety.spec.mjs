// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const verification = readFileSync(
    ".github/workflows/verify-ai-corpus.yml",
    "utf8",
);

test("verification workflow covers every release-relevant source", () => {
    for (const path of [
        ".ai/**",
        ".agents/**",
        ".github/ISSUE_TEMPLATE/**",
        ".github/workflows/**",
        "AGENTS.md",
        "README.md",
        "Documentation/**",
        "catalog/**",
        "distribution/**",
        "engineering/**",
        "evals/**",
        "evidence/**",
        "pilots/**",
        "skills/**",
        "tooling/**",
    ]) {
        const occurrences = verification.split(`- "${path}"`).length - 1;
        assert.equal(occurrences, 2, path);
    }
});

test("strict JSON verification excludes generated Distribution workflow YAML", () => {
    assert(verification.includes("path.startsWith('catalog/')"));
    assert.equal(
        verification.includes(
            "path.endsWith('.json') || path.endsWith('.yml')",
        ),
        false,
    );
});

test("required verification uses the basic lane while governed assurance stays separate", () => {
    for (const required of [
        "generate-support.mjs",
        "catalog/v2/support.json",
        "preview-readiness.mjs",
        "validate-catalogs.mjs --basic",
        "run-spec-suite.mjs --basic",
        "distribution/preview-readiness.json",
    ])
        assert(verification.includes(required), required);
    for (const governedOnly of [
        "generate-release-readiness.mjs",
        "run-spec-suite.mjs --governed",
    ])
        assert.equal(verification.includes(governedOnly), false, governedOnly);
});

test("advanced assurance audit is manual scheduled and read-only", () => {
    const workflow = readFileSync(
        ".github/workflows/advanced-assurance-audit.yml",
        "utf8",
    );
    for (const required of [
        "workflow_dispatch:",
        "schedule:",
        "permissions:\n  contents: read",
        "persist-credentials: false",
        "generate-support.mjs",
        "generate-release-readiness.mjs",
        "run-spec-suite.mjs --governed",
    ])
        assert(workflow.includes(required), required);
    for (const forbidden of [
        "contents: write",
        "id-token: write",
        "secrets:",
        "npm publish",
        "gh release",
        "git push",
    ])
        assert.equal(workflow.includes(forbidden), false, forbidden);
});

test("release candidates remain readable while every side-effect job is S10-blocked", () => {
    const workflow = readFileSync(
        ".github/workflows/release-approved-ai-profiles.yml",
        "utf8",
    );
    for (const required of [
        "pull_request:",
        'push:\n    branches: ["main"]',
        "distribution/releases/*.json",
        "release-request-validation.mjs",
        "generate-approved-profile-release.mjs",
        "s10_preflight:",
        "generate-release-readiness.mjs",
        "s10-release-gate-validation.mjs",
        "release_allowed=false",
        "release_allowed == 'true'",
        "release-instructions.md",
        "support-matrix.json",
        "sha256sum -c SHA256SUMS",
        "needs: [discover, verify]",
        "needs: [discover, verify, s10_preflight]",
        "needs: [discover, verify, s10_preflight, canary]",
        "needs: [discover, verify, s10_preflight, canary, distribute]",
        "needs: [discover, s10_preflight, distribute, publish-npm]",
        "samples-chronicle-backend",
        "trap cleanup EXIT",
        'gh release delete "v$VERSION"',
        "cleanup-failed-publication:",
        "record-promotion-failure:",
        "gh release create",
        "--notes-file",
        "--draft",
        'gh release edit "v$VERSION"',
        "--draft=false",
        "npm_version=$(npm --version)",
        "--package=@earendil-works/pi-coding-agent@0.84.2",
        'test "${#artifacts[@]}" -eq 1',
        "npm publish",
        "--provenance",
        "id-token: write",
        'gh pr merge "$PR_NUMBER"',
        "--repo Cratis/AI.Distribution --auto --merge",
        'test "$state" = "MERGED"',
        "Subscriber updates remain disabled until Workflows#73",
        "npm version is immutable and was not rolled back",
    ])
        assert(workflow.includes(required), required);
    for (const forbidden of [
        'if [ "$EVENT_NAME" = "push" ]; then mode=(release); fi',
        "workflow_dispatch:",
        "INPUT_REQUEST",
        "NPM_TOKEN",
        "npm install --global",
        "! -name SHA256SUMS",
        "--auto --squash",
        "push --force",
        "push -f",
        "direct push to main",
        "secrets: inherit",
    ])
        assert.equal(workflow.includes(forbidden), false, forbidden);
});

test("passive preview publication is request readiness and environment gated", () => {
    const workflow = readFileSync(
        ".github/workflows/release-passive-previews.yml",
        "utf8",
    );
    for (const required of [
        "name: preview / verify",
        "distribution/preview-requests.json",
        "preview_allowed",
        "git diff --quiet",
        "--require-request",
        "--base",
        "request_present",
        "requests.at(-1).version",
        "artifact_sha256",
        "EXPECTED_SHA256",
        "smoke-fundamentals-preview-npm.mjs",
        "github.event_name == 'push'",
        "needs.verify.outputs.preview_allowed == 'true'",
        "environment: npm-stage",
        "id-token: write",
        "npm_version=$(npm --version)",
        "major < 11",
        "npm publish --provenance --access public --tag preview",
        "package-fundamentals-preview-npm.mjs",
        "supportGranted",
    ])
        assert(workflow.includes(required), required);
    for (const check of [
        "deterministic-generation",
        "static-contract-validation",
        "secret-and-path-scanning",
        "schema-validation",
        "checksums",
        "owner-review",
        "basic-pack-install-discovery-uninstall-smoke",
        "exact-version-rollback",
    ])
        assert(workflow.includes(check), check);
    for (const forbidden of [
        "NPM_TOKEN",
        "NODE_AUTH_TOKEN",
        "secrets:",
        "contents: write",
        "pull-requests: write",
        "supportGranted: true",
        "workflow_dispatch:",
        "0.1.0-preview.1');",
    ])
        assert.equal(workflow.includes(forbidden), false, forbidden);
});

test("Fundamentals preview workflow is read-only short-lived and non-publishing", () => {
    const workflow = readFileSync(
        ".github/workflows/distribution-fundamentals-preview-assets.yml",
        "utf8",
    );
    for (const required of [
        "permissions:\n  contents: read",
        "fetch-depth: 0",
        "preview-readiness.mjs",
        "validate-catalogs.mjs --basic",
        "governedAssurance.requiredForPreview",
        "package-fundamentals-preview-assets.mjs",
        "PREVIEW_ASSETS_APPROVAL_PENDING",
        "preview-assets.json').approvalEligible",
        "preview-assets.json').publicationEligible",
        "preview-assets.json').promotionEligible",
        "retention-days: 7",
        "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    ])
        assert(workflow.includes(required), required);
    for (const forbidden of [
        "id-token: write",
        "contents: write",
        "pull-requests: write",
        "npm publish",
        "gh release create",
        "git push",
        "secrets:",
    ])
        assert.equal(workflow.includes(forbidden), false, forbidden);
});

test("approved profile workflow is bot-scoped and keeps publication separate", () => {
    const workflow = readFileSync(
        ".github/workflows/distribution-approved-profile-release.yml",
        "utf8",
    );
    for (const required of [
        "generate-approved-profile-release.mjs",
        "fetch-depth: 0",
        "environment: distribution-canary",
        "repositories: AI.Distribution",
        "permission-contents: write",
        "permission-pull-requests: write",
        'test ! -e "$destination"',
        "Publication and promotion remain separate protected gates",
    ])
        assert(workflow.includes(required), required);
    for (const forbidden of [
        "force push",
        "--force",
        "npm publish",
        "gh release create",
        "git tag",
        "secrets: inherit",
    ])
        assert.equal(workflow.includes(forbidden), false, forbidden);
});

test("generated Distribution updates preserve the reviewed control plane", () => {
    const workflow = readFileSync(
        ".github/workflows/distribution-generated-update.yml",
        "utf8",
    );
    const contract = JSON.parse(
        readFileSync(
            "distribution/generated-repository-contract.json",
            "utf8",
        ),
    );
    assert(
        workflow.includes(
            "rsync -a --delete --exclude=.git --exclude=.github --exclude=candidates",
        ),
    );
    assert.deepEqual(contract.repositoryControlPlane.allowedPaths, [
        ".github/scripts/verify-generated-distribution.mjs",
        ".github/workflows/verify-generated-distribution.yml",
    ]);
    assert.equal(
        contract.repositoryControlPlane.preserveDuringPayloadReplacement,
        true,
    );
    assert.equal(contract.repositoryControlPlane.manifestedAsArtifact, false);
    assert.equal(contract.repositoryControlPlane.manualAuthoringAllowed, false);
    assert.equal(
        contract.repositoryReviewCandidates.preserveDuringPayloadReplacement,
        true,
    );
    assert.equal(contract.repositoryReviewCandidates.releaseEligible, false);
});

test("legacy propagation entry points are removed", () => {
    for (const path of [
        ".github/scripts/copilot-sync-ignore-filter.sh",
        ".github/scripts/propagate-copilot-instructions.sh",
        ".github/workflows/propagate-copilot-instructions.yml",
        ".github/workflows/sync-copilot-instructions.yml",
    ])
        assert.equal(existsSync(path), false, path);
    for (const filename of readdirSync(".github/workflows")) {
        const workflow = readFileSync(
            `.github/workflows/${filename}`,
            "utf8",
        );
        assert.equal(
            workflow.includes(".github/scripts/propagate-copilot-instructions.sh"),
            false,
            filename,
        );
    }
});

test("merge-reachable reusable workflows are pinned and do not inherit secrets", () => {
    const cleanup = readFileSync(
        ".github/workflows/cleanup-pr-artifacts.yml",
        "utf8",
    );
    assert.equal(cleanup.includes("secrets: inherit"), false);
    assert(cleanup.includes("PAT_WORKFLOWS: ${{ secrets.PAT_WORKFLOWS }}"));
    for (const filename of readdirSync(".github/workflows")) {
        const workflow = readFileSync(
            `.github/workflows/${filename}`,
            "utf8",
        );
        const references = workflow.match(
            /uses: Cratis\/Workflows\/[^\s]+@([^\s]+)/g,
        ) ?? [];
        for (const reference of references)
            assert.match(reference, /@[0-9a-f]{40}$/, filename);
    }
});
