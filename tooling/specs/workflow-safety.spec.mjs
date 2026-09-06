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

test("Fundamentals package uses the normal labeled Cratis release flow", () => {
    const workflow = readFileSync(
        ".github/workflows/release-passive-previews.yml",
        "utf8",
    );
    for (const required of [
        "name: Publish Fundamentals AI Package",
        'branches: ["main"]',
        "cratis/release-action@bdaded342eb31b52b48dca0611f0214794f8c655",
        "needs.release.outputs.publish == 'true'",
        "environment: npm-stage",
        "id-token: write",
        '[[ "$VERSION" =~ ^0\\.[0-9]+\\.[0-9]+$ ]]',
        "package-fundamentals-preview-npm.mjs",
        "smoke-fundamentals-preview-npm.mjs",
        "npm publish --provenance --access public --tag latest",
        "supportGranted",
    ])
        assert(workflow.includes(required), required);
    for (const forbidden of [
        "NPM_TOKEN",
        "NODE_AUTH_TOKEN",
        "secrets:",
        "workflow_dispatch:",
        "--tag preview",
        "distribution/preview-requests.json",
    ])
        assert.equal(workflow.includes(forbidden), false, forbidden);
});

test("AI delegates release-intent labels to the shared pinned workflow", () => {
    const workflow = readFileSync(
        ".github/workflows/verify-semver-label.yml",
        "utf8",
    );
    for (const required of [
        "pull_request:",
        "opened, reopened, synchronize, labeled, unlabeled",
        'branches: ["main"]',
        "release-intent:",
        "Cratis/Workflows/.github/workflows/verify-release-intent.yml@1e5319ff574ce61a771ec5199527b917204a13b5",
    ])
        assert(workflow.includes(required), required);
    assert.equal(workflow.includes("secrets: inherit"), false);
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

test("public marketplace publish takes its version from the Cratis release action", () => {
    const workflow = readFileSync(".github/workflows/publish.yml", "utf8");
    for (const required of [
        "name: Publish Public Marketplace Distribution",
        'branches: ["main"]',
        "permissions:\n  contents: read",
        "cratis/release-action@bdaded342eb31b52b48dca0611f0214794f8c655",
        'tag-prefix: "dist/v"',
        "publish: ${{ steps.release.outputs.should-publish }}",
        "version: ${{ steps.release.outputs.version }}",
        "needs.release.outputs.publish == 'true'",
        "needs: [release, stage]",
        "repository: ${{ github.repository }}",
        "ref: distribution",
        "CANDIDATE_VERSION: 0.0.${{ github.run_number }}-candidate.1",
        '[[ "$VERSION" =~ ^0\\.[0-9]+\\.[0-9]+$ ]]',
        '[[ "$CANDIDATE_VERSION" =~ ^0\\.0\\.[0-9]+-candidate\\.[0-9]+$ ]]',
        "stage-public-marketplace-repository.mjs",
        "package-public-marketplace-submissions.mjs",
        "generate-marketplace-pointer-manifests.mjs",
        '"$work" "$VERSION" "$DISTRIBUTION_SHA"',
        "vendor-portal-handoff",
        "exact-inventory",
        "canonical-byte-parity",
        "native-manifest-parse",
        "checksums",
        "fixture-provenance-record",
        "pack-install-smoke-uninstall",
        "canary-rollback-simulation",
        "include-hidden-files: true",
        "retention-days: 7",
        "environment: distribution-canary",
        "rsync -a --delete --exclude=.git",
        "push origin HEAD:refs/heads/distribution",
        'echo "sha=$(git -C "$work" rev-parse HEAD)" >> "$GITHUB_OUTPUT"',
        'gh release upload "dist/v$VERSION"',
        "--clobber",
        'gh release edit "dist/v$VERSION"',
        "--label no-release",
    ])
        assert(workflow.includes(required), required);
    for (const forbidden of [
        // The version is computed, never typed in, so there is no dispatch
        // input left to read.
        "workflow_dispatch:",
        "inputs.version",
        "inputs.candidate-version",
        // dist/vX.Y.Z is created on main by the release action. Applying it to
        // the generated branch too would make one tag name resolve to two trees.
        'git -C "$work" tag "dist/v$VERSION"',
        'gh release create "dist/v$VERSION"',
        "id-token: write",
        "secrets:",
        "npm publish",
        "AI_DISTRIBUTION_APP_ID",
        "AI_DISTRIBUTION_APP_PRIVATE_KEY",
        "create-github-app-token",
        "Cratis/AI.Distribution",
        "--force",
        "push -f",
    ])
        assert.equal(workflow.includes(forbidden), false, forbidden);
    const beforePublish = workflow.slice(0, workflow.indexOf("  publish:\n"));
    const [, publish] = workflow.split("  publish:\n");
    for (const scoped of ["contents: write", "pull-requests: write"])
        assert(publish.includes(scoped), scoped);
    // pull-requests: write belongs to publish alone. contents: write is scoped
    // to release (the tag and release on main) and publish (the protected
    // branch); the stage job that generates and verifies stays read-only, and
    // neither appears at workflow level.
    assert.equal(beforePublish.includes("pull-requests: write"), false);
    const [, stage] = beforePublish.split("  stage:\n");
    assert(stage.includes("permissions:\n      contents: read"));
    assert.equal(stage.includes("contents: write"), false);
});

test("the distribution branch has a live control plane inside Cratis/AI", () => {
    const workflow = readFileSync(
        ".github/workflows/verify-distribution-branch.yml",
        "utf8",
    );
    const contract = JSON.parse(
        readFileSync("distribution/generated-repository-contract.json", "utf8"),
    );
    for (const required of [
        'branches: ["distribution"]',
        "workflow_dispatch:",
        "permissions:\n  contents: read",
        "persist-credentials: false",
        "ref: distribution",
        "fail-fast: false",
        "distribution/repository-control-plane/.github/scripts/verify-generated-distribution.mjs",
    ])
        assert(workflow.includes(required), required);
    for (const check of contract.requiredChecks)
        assert(workflow.includes(`          - ${check}`), check);
    for (const forbidden of [
        "pull_request_target:",
        "contents: write",
        "id-token: write",
        "pull-requests: write",
        "secrets:",
        "npm publish",
        "gh release",
        "git push",
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
        readFileSync("distribution/generated-repository-contract.json", "utf8"),
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
        const workflow = readFileSync(`.github/workflows/${filename}`, "utf8");
        assert.equal(
            workflow.includes(
                ".github/scripts/propagate-copilot-instructions.sh",
            ),
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
        const workflow = readFileSync(`.github/workflows/${filename}`, "utf8");
        const references =
            workflow.match(/uses: Cratis\/Workflows\/[^\s]+@([^\s]+)/g) ?? [];
        for (const reference of references)
            assert.match(reference, /@[0-9a-f]{40}$/, filename);
    }
});
