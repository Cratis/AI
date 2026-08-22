// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
    mkdtempSync,
    mkdirSync,
    readFileSync,
    rmSync,
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
    assert.equal(contract.repository.name, "Cratis/AI.Distribution");
    assert.equal(
        contract.repository.status,
        "CREATED_EMPTY_DEPLOY_KEY_CONFIGURED",
    );
    assert.equal(contract.repository.manualAuthoringAllowed, false);
    assert.equal(contract.repository.botOnlyWrites, true);
    assert.equal(
        contract.repository.strategyIssue,
        "https://github.com/Cratis/Strategy/issues/126",
    );
    assert.equal(
        contract.repository.deployKeySecret,
        "AI_DISTRIBUTION_DEPLOY_KEY",
    );
    assert.equal(contract.productionMaterialization.enabled, false);
    assert.equal(contract.publicationEligible, false);
    assert.equal(contract.promotionEligible, false);
    assert.equal(contract.legacyRetirementEligible, false);
    assert.match(generalRules, /## New Repository Registration/);
    assert.match(generalRules, /Cratis\/Strategy/);
    for (const requiredDetail of [
        "repository name, URL, visibility, and creation state",
        "accountable owner",
        "release, distribution, credential, security, privacy, compliance, and data",
        "repository metadata, topics, ownership records",
    ])
        assert(generalRules.includes(requiredDetail));
    assert.equal(remoteState.repository.state, "CREATED_EMPTY");
    assert.equal(remoteState.repository.secretScanningEnabled, true);
    assert.equal(remoteState.repository.pushProtectionEnabled, true);
    assert.equal(
        remoteState.strategyRegistration.issue,
        "https://github.com/Cratis/Strategy/issues/126",
    );
    assert.equal(remoteState.credential.privateKeySecretName, "AI_DISTRIBUTION_DEPLOY_KEY");
    assert.equal(remoteState.publicationEligible, false);
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
            join(generatedRoot, "canonical/skills/cratis-example/SKILL.md"),
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
            "canonical/skills/cratis-example/LICENSE",
        );
        writeFileSync(path, `${readFileSync(path, "utf8")}human edit\n`);
        execFileSync(
            "git",
            ["add", "--", "canonical/skills/cratis-example/LICENSE"],
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
