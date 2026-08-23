#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    generateDistributionFixture,
    validateDistributionFixture,
} from "./generate-distribution-fixture.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(`Unable to parse generated-repository input: ${path}`, {
            cause: error,
        });
    }
}

function runGit(repositoryRoot, arguments_, options = {}) {
    try {
        return execFileSync("git", arguments_, {
            cwd: repositoryRoot,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
            ...options,
        }).trim();
    } catch (error) {
        throw new Error(
            `Generated repository git command failed: git ${arguments_.join(" ")}`,
            {
                cause: error,
            },
        );
    }
}

function trackedFiles(repositoryRoot) {
    const output = execFileSync("git", ["ls-files", "-z"], {
        cwd: repositoryRoot,
    });
    return output.toString("utf8").split("\0").filter(Boolean).sort();
}

export function buildApprovedDistributionPlan(
    repositoryRoot = defaultRepositoryRoot,
) {
    const targets = readJson(join(repositoryRoot, "catalog/v2/targets.json"));
    const artifacts = readJson(
        join(repositoryRoot, "catalog/v2/artifacts.json"),
    );
    const approvedTargets = targets.targets
        .filter(
            (target) =>
                target.includeInRuntime === true &&
                target.approval?.state === "approved",
        )
        .map((target) => target.id)
        .sort();
    const publicArtifact = artifacts.artifacts.find(
        (artifact) => artifact.id === "planned-passive-public-release",
    );
    const ready =
        approvedTargets.length > 0 &&
        publicArtifact?.materializationAllowed === true &&
        publicArtifact?.runtimeEligible === true;
    return {
        schemaVersion: "1.0.0",
        state: ready
            ? "READY_FOR_BOT_MATERIALIZATION"
            : "BLOCKED_NO_APPROVED_TARGETS",
        sourceCommit: runGit(repositoryRoot, ["rev-parse", "HEAD"]),
        artifactId: publicArtifact?.id ?? null,
        approvedTargets,
        materializationAllowed: publicArtifact?.materializationAllowed === true,
        runtimeEligible: publicArtifact?.runtimeEligible === true,
        publicationEligible: false,
        promotionEligible: false,
    };
}

export function verifyGeneratedDistributionRepository(
    generatedRepositoryRoot,
    contractPath = join(
        defaultRepositoryRoot,
        "distribution/generated-repository-contract.json",
    ),
) {
    const root = resolve(generatedRepositoryRoot);
    const contract = readJson(contractPath);
    const branch = runGit(root, ["branch", "--show-current"]);
    if (branch !== contract.repository.defaultBranch)
        throw new Error(`Generated repository branch changed: ${branch}`);
    if (runGit(root, ["status", "--porcelain"]) !== "")
        throw new Error("Generated repository worktree is not clean");
    if (runGit(root, ["rev-list", "--count", "HEAD"]) !== "1")
        throw new Error(
            "Generated fixture repository must have one root commit",
        );
    const identity = runGit(root, [
        "show",
        "-s",
        "--format=%an%x00%ae%x00%aI%x00%cI%x00%s",
        "HEAD",
    ]).split("\0");
    const expectedIdentity = contract.localSimulation.identity;
    if (
        identity[0] !== expectedIdentity.name ||
        identity[1] !== expectedIdentity.email ||
        identity[2] !== contract.localSimulation.fixedCommitDate ||
        identity[3] !== contract.localSimulation.fixedCommitDate ||
        identity[4] !== contract.localSimulation.commitMessage
    ) {
        throw new Error("Generated repository commit identity changed");
    }
    const manifest = readJson(join(root, "distribution-manifest.json"));
    const expectedFiles = [
        ...manifest.files.map((file) => file.path),
        "distribution-manifest.json",
    ].sort();
    if (JSON.stringify(trackedFiles(root)) !== JSON.stringify(expectedFiles))
        throw new Error("Generated repository tracked inventory changed");
    for (const file of manifest.files) {
        const content = readFileSync(join(root, file.path));
        if (content.length !== file.size || sha256(content) !== file.sha256)
            throw new Error(
                `Generated repository digest mismatch: ${file.path}`,
            );
    }
    const forbiddenSegments = new Set([
        "agents",
        "evals",
        "hooks",
        "prompts",
        "tooling",
    ]);
    if (
        expectedFiles.some((path) =>
            path.split("/").some((segment) => forbiddenSegments.has(segment)),
        )
    ) {
        throw new Error("Generated repository contains authoring content");
    }
    return {
        commit: runGit(root, ["rev-parse", "HEAD"]),
        tree: runGit(root, ["rev-parse", "HEAD^{tree}"]),
        files: expectedFiles,
        author: expectedIdentity,
        fixtureOnly: true,
        publicationEligible: false,
        promotionEligible: false,
    };
}

export function bootstrapGeneratedDistributionRepository({
    repositoryRoot = defaultRepositoryRoot,
    generatedRepositoryRoot,
    recordPath,
    version = "0.0.0-fixture",
} = {}) {
    if (!generatedRepositoryRoot || !recordPath)
        throw new Error("generatedRepositoryRoot and recordPath are required");
    if (existsSync(generatedRepositoryRoot))
        throw new Error(
            `Generated repository destination must not exist: ${generatedRepositoryRoot}`,
        );
    if (existsSync(recordPath))
        throw new Error(
            `Generated repository record must not exist: ${recordPath}`,
        );
    const contractPath = join(
        repositoryRoot,
        "distribution/generated-repository-contract.json",
    );
    const contract = readJson(contractPath);
    if (
        contract.repository.status !== "INITIALIZED_PROTECTED_FIXTURE" ||
        contract.repository.manualAuthoringAllowed !== false ||
        contract.productionMaterialization.enabled !== true ||
        contract.productionMaterialization.activation !==
            "merged validated release request" ||
        contract.releaseOnMerge?.mergeToMainIsReleaseApproval !== true
    ) {
        throw new Error("Generated repository authority gate changed");
    }
    generateDistributionFixture({
        repositoryRoot,
        outputRoot: generatedRepositoryRoot,
        version,
    });
    validateDistributionFixture(generatedRepositoryRoot);
    runGit(generatedRepositoryRoot, [
        "init",
        "--initial-branch",
        contract.repository.defaultBranch,
    ]);
    runGit(generatedRepositoryRoot, [
        "config",
        "user.name",
        contract.localSimulation.identity.name,
    ]);
    runGit(generatedRepositoryRoot, [
        "config",
        "user.email",
        contract.localSimulation.identity.email,
    ]);
    const manifest = readJson(
        join(generatedRepositoryRoot, "distribution-manifest.json"),
    );
    const files = [
        ...manifest.files.map((file) => file.path),
        "distribution-manifest.json",
    ];
    runGit(generatedRepositoryRoot, ["add", "--", ...files]);
    const environment = {
        ...process.env,
        GIT_AUTHOR_DATE: contract.localSimulation.fixedCommitDate,
        GIT_COMMITTER_DATE: contract.localSimulation.fixedCommitDate,
    };
    runGit(
        generatedRepositoryRoot,
        ["commit", "--message", contract.localSimulation.commitMessage],
        { env: environment },
    );
    const verification = verifyGeneratedDistributionRepository(
        generatedRepositoryRoot,
        contractPath,
    );
    const record = {
        schemaVersion: "1.0.0",
        state: "LOCAL_GENERATED_REPOSITORY_FIXTURE",
        repositoryName: contract.repository.name,
        remoteRepositoryStatus: contract.repository.status,
        sourceCommit: runGit(repositoryRoot, ["rev-parse", "HEAD"]),
        generatedCommit: verification.commit,
        generatedTree: verification.tree,
        generatedFiles: verification.files.length,
        author: verification.author,
        fixtureOnly: true,
        publicationEligible: false,
        promotionEligible: false,
    };
    writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, {
        flag: "wx",
    });
    return record;
}

function parseArguments(arguments_) {
    const values = new Map();
    for (let index = 0; index < arguments_.length; index += 2) {
        const name = arguments_[index];
        const value = arguments_[index + 1];
        if (!name?.startsWith("--") || value === undefined)
            throw new Error("Arguments must be --name value pairs");
        values.set(name.slice(2), value);
    }
    return values;
}

function main() {
    try {
        const arguments_ = parseArguments(process.argv.slice(2));
        if (arguments_.has("plan")) {
            process.stdout.write(
                `${JSON.stringify(buildApprovedDistributionPlan(), null, 2)}\n`,
            );
            return;
        }
        const record = bootstrapGeneratedDistributionRepository({
            generatedRepositoryRoot: arguments_.get("output"),
            recordPath: arguments_.get("record"),
            version: arguments_.get("version") ?? "0.0.0-fixture",
        });
        process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "Generated repository bootstrap failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
