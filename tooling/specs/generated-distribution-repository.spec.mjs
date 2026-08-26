// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
    mkdtempSync,
    mkdirSync,
    readFileSync,
    rmSync,
    symlinkSync,
    unlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
    bootstrapGeneratedDistributionRepository,
    buildApprovedDistributionPlan,
    verifyGeneratedDistributionRepository,
} from "../bootstrap-generated-distribution-repository.mjs";
import { generateDistributionFixture } from "../generate-distribution-fixture.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);
const contractPath = join(
    repositoryRoot,
    "distribution/generated-repository-contract.json",
);

function withTemporaryDirectory(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-generated-repository-"));
    try {
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function bootstrap(root, name = "generated") {
    return bootstrapGeneratedDistributionRepository({
        repositoryRoot,
        generatedRepositoryRoot: join(root, name),
        recordPath: join(root, `${name}.json`),
    });
}

test("generated repository contract keeps remote authority and production blocked", () => {
    const contract = JSON.parse(readFileSync(contractPath, "utf8"));
    const rolloutPolicy = JSON.parse(
        readFileSync(
            join(repositoryRoot, "distribution/rollout-policy.json"),
            "utf8",
        ),
    );
    const generalRules = readFileSync(
        join(repositoryRoot, ".ai/rules/general.md"),
        "utf8",
    );
    const remoteState = JSON.parse(
        readFileSync(
            join(repositoryRoot, "distribution/remote-repository-state.json"),
            "utf8",
        ),
    );
    const hostedEvidence = JSON.parse(
        readFileSync(
            join(
                repositoryRoot,
                "distribution/evidence/hosted-remote-initialization-2026-08-22.json",
            ),
            "utf8",
        ),
    );
    assert.equal(contract.repository.name, "Cratis/AI.Distribution");
    assert.equal(contract.repository.status, "INITIALIZED_PROTECTED_FIXTURE");
    assert.equal(contract.repository.manualAuthoringAllowed, false);
    assert.equal(contract.repository.botOnlyWrites, true);
    assert.deepEqual(contract.repositoryControlPlane, {
        sourceRepository: "Cratis/AI",
        sourceRoot: "distribution/repository-control-plane",
        allowedPaths: [
            ".github/scripts/verify-generated-distribution.mjs",
            ".github/workflows/verify-generated-distribution.yml",
        ],
        manifestedAsArtifact: false,
        preserveDuringPayloadReplacement: true,
        manualAuthoringAllowed: false,
    });
    assert.deepEqual(contract.requiredChecks, [
        ...rolloutPolicy.candidate.requiredChecks,
        "canary-rollback-simulation",
    ]);
    assert.equal(
        contract.repository.strategyIssue,
        "https://github.com/Cratis/Strategy/issues/126",
    );
    assert.equal(contract.repository.deployKeySecret, null);
    assert.equal(
        contract.repository.writeCredentialState,
        "ABSENT_PENDING_PR_RELEASE_BOT",
    );
    assert.equal(contract.productionMaterialization.enabled, true);
    assert.equal(
        contract.productionMaterialization.activation,
        "merged validated release request",
    );
    assert.equal(contract.releaseOnMerge.mergeToMainIsReleaseApproval, true);
    assert.equal(contract.releaseOnMerge.canaryRequiredBeforePublication, true);
    assert.equal(contract.releaseOnMerge.maxProfilesPerRelease, 1);
    assert.equal(contract.releaseOnMerge.automaticPromotion, true);
    assert.equal(contract.releaseOnMerge.failureCleanupBeforePublication, true);
    assert.equal(contract.releaseOnMerge.automaticRollback, false);
    assert.equal(contract.releaseOnMerge.subscriberUpdatePullRequests, false);
    assert.equal(contract.releaseOnMerge.marketplaces, "manual-handoff");
    assert.equal(
        contract.productionMaterialization.artifactTopology,
        "one-profile-one-harness-root-asset",
    );
    assert.equal(
        contract.productionMaterialization.profileCatalog,
        "distribution/profile-catalog.json",
    );
    assert.equal(
        contract.productionMaterialization.subscriptionFile,
        ".cratis/ai.json",
    );
    assert.equal(
        contract.productionMaterialization.requiresVerifiedSourceContracts,
        true,
    );
    assert.deepEqual(
        contract.productionMaterialization.requiredLifecycleEvidence,
        [
            "install",
            "update",
            "rollback",
            "uninstall",
            "project context preservation",
        ],
    );
    assert.equal(contract.publicationEligible, false);
    assert.equal(contract.promotionEligible, false);
    assert.equal(contract.legacyRetirementEligible, false);
    assert.match(generalRules, /## New Repository Strategy Intake/);
    assert.match(generalRules, /transient,\s*no-effect Strategy intake proposal/);
    assert.match(generalRules, /Do not create, comment on, assign, mention/);
    assert.match(generalRules, /Repository\s+creation does not require an issue URL/);
    assert.match(generalRules, /## Shared AI Distribution/);
    assert.match(generalRules, /Do not copy or synchronize shared/);
    assert.match(generalRules, /Never patch generated distribution bytes/);
    for (const requiredDetail of [
        "repository name, URL, visibility, and creation state",
        "accountable owner",
        "release, distribution, credential, security, privacy, compliance, and data",
        "requested Strategy identity, portfolio, metadata, ownership",
    ])
        assert(generalRules.includes(requiredDetail));
    assert.equal(remoteState.repository.state, "INITIALIZED_PROTECTED_FIXTURE");
    assert.equal(remoteState.repository.secretScanningEnabled, true);
    assert.equal(remoteState.repository.pushProtectionEnabled, true);
    assert.equal(
        remoteState.strategyRegistration.issue,
        "https://github.com/Cratis/Strategy/issues/126",
    );
    assert.equal(remoteState.credential.privateKeySecretName, null);
    assert.equal(
        remoteState.credential.state,
        "REMOVED_AFTER_ONE_TIME_INITIALIZATION",
    );
    assert.equal(
        remoteState.generatedState.generatedCommit,
        "dd58ae38a1cad0e0c82141a98be929a5a7094a0d",
    );
    assert.equal(remoteState.branchProtection.enforceAdmins, true);
    assert.equal(remoteState.branchProtection.allowForcePushes, false);
    assert.equal(remoteState.publicationEligible, false);
    assert.equal(hostedEvidence.status, "PASS");
    assert.equal(
        hostedEvidence.generatedCommit,
        remoteState.generatedState.generatedCommit,
    );
    assert.equal(
        hostedEvidence.credentialLifecycle.standingWriteCredential,
        false,
    );
});

test("production distribution plan remains blocked without approved targets", () => {
    const plan = buildApprovedDistributionPlan(repositoryRoot);
    assert.equal(plan.state, "BLOCKED_NO_APPROVED_TARGETS");
    assert.deepEqual(plan.approvedTargets, []);
    assert.equal(plan.materializationAllowed, false);
    assert.equal(plan.runtimeEligible, false);
    assert.equal(plan.publicationEligible, false);
    assert.equal(plan.promotionEligible, false);
});

test("local generated repository is deterministic and bot-authored", () => {
    withTemporaryDirectory((root) => {
        const first = bootstrap(root, "first");
        const second = bootstrap(root, "second");
        assert.equal(first.generatedCommit, second.generatedCommit);
        assert.equal(first.generatedTree, second.generatedTree);
        assert.equal(first.generatedFiles, second.generatedFiles);
        assert.deepEqual(first.author, {
            name: "cratis-distribution-fixture-bot",
            email: "fixture-bot@invalid.example",
        });
        assert.equal(first.fixtureOnly, true);
        assert.equal(first.publicationEligible, false);
        assert.equal(first.promotionEligible, false);
    });
});

test("generated repository contains only manifested distribution files", () => {
    withTemporaryDirectory((root) => {
        bootstrap(root);
        const generatedRoot = join(root, "generated");
        const verification = verifyGeneratedDistributionRepository(
            generatedRoot,
            contractPath,
        );
        assert(verification.files.includes("distribution-manifest.json"));
        assert(verification.files.includes("SHA256SUMS"));
        assert(verification.files.includes("provenance.json"));
        assert(
            verification.files.every(
                (path) =>
                    !path.startsWith("tooling/") &&
                    !path.startsWith("evals/") &&
                    !path.startsWith("agents/") &&
                    !path.startsWith("hooks/") &&
                    !path.startsWith("prompts/"),
            ),
        );
    });
});

test("generated repository verification rejects worktree tampering", () => {
    withTemporaryDirectory((root) => {
        bootstrap(root);
        const generatedRoot = join(root, "generated");
        writeFileSync(
            join(
                generatedRoot,
                "canonical/skills/cratis-fundamentals-concept/SKILL.md",
            ),
            "tampered\n",
        );
        assert.throws(
            () =>
                verifyGeneratedDistributionRepository(
                    generatedRoot,
                    contractPath,
                ),
            /worktree is not clean/,
        );
    });
});

test("generated repository verification rejects human follow-up commits", () => {
    withTemporaryDirectory((root) => {
        bootstrap(root);
        const generatedRoot = join(root, "generated");
        const path = join(
            generatedRoot,
            "canonical/skills/cratis-fundamentals-concept/LICENSE",
        );
        writeFileSync(path, `${readFileSync(path, "utf8")}human edit\n`);
        execFileSync(
            "git",
            [
                "add",
                "--",
                "canonical/skills/cratis-fundamentals-concept/LICENSE",
            ],
            {
                cwd: generatedRoot,
            },
        );
        execFileSync(
            "git",
            [
                "-c",
                "user.name=human-author",
                "-c",
                "user.email=human@example.invalid",
                "commit",
                "--message",
                "Manual edit",
            ],
            {
                cwd: generatedRoot,
                env: {
                    ...process.env,
                    GIT_AUTHOR_DATE: "2000-01-02T00:00:00+00:00",
                    GIT_COMMITTER_DATE: "2000-01-02T00:00:00+00:00",
                },
                stdio: "pipe",
            },
        );
        assert.throws(
            () =>
                verifyGeneratedDistributionRepository(
                    generatedRoot,
                    contractPath,
                ),
            /one root commit|commit identity changed/,
        );
    });
});

test("generated repository verification reads only regular committed blobs", () => {
    withTemporaryDirectory((root) => {
        const generatedRoot = join(root, "generated");
        generateDistributionFixture({
            repositoryRoot,
            outputRoot: generatedRoot,
        });
        const manifest = JSON.parse(
            readFileSync(
                join(generatedRoot, "distribution-manifest.json"),
                "utf8",
            ),
        );
        const linkedPath = join(generatedRoot, manifest.files[0].path);
        const outsidePath = join(root, "outside.txt");
        writeFileSync(outsidePath, "outside repository\n");
        unlinkSync(linkedPath);
        symlinkSync(outsidePath, linkedPath);
        execFileSync("git", ["init", "--initial-branch", "main"], {
            cwd: generatedRoot,
            stdio: "pipe",
        });
        execFileSync("git", ["config", "user.name", "cratis-distribution-fixture-bot"], {
            cwd: generatedRoot,
        });
        execFileSync("git", ["config", "user.email", "fixture-bot@invalid.example"], {
            cwd: generatedRoot,
        });
        execFileSync("git", ["add", "--all"], { cwd: generatedRoot });
        execFileSync("git", ["commit", "--message", "Generate fixture distribution"], {
            cwd: generatedRoot,
            env: {
                ...process.env,
                GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
                GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
            },
            stdio: "pipe",
        });
        assert.throws(
            () =>
                verifyGeneratedDistributionRepository(
                    generatedRoot,
                    contractPath,
                ),
            /non-file entry/,
        );
    });
});

test("generated repository bootstrap refuses existing destinations and records", () => {
    withTemporaryDirectory((root) => {
        const generatedRoot = join(root, "generated");
        mkdirSync(generatedRoot);
        assert.throws(
            () =>
                bootstrapGeneratedDistributionRepository({
                    repositoryRoot,
                    generatedRepositoryRoot: generatedRoot,
                    recordPath: join(root, "record.json"),
                }),
            /destination must not exist/,
        );
    });
});
