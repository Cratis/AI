#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    generateDistributionFixture,
    validateDistributionConfiguration,
} from "./generate-distribution-fixture.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);
const fixtureArtifactId = "sanitized-public-materializer-fixture";

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(`Unable to parse candidate input: ${path}`, {
            cause: error,
        });
    }
}

export function stageDistributionCandidate({
    repositoryRoot = defaultRepositoryRoot,
    artifactId,
    outputRoot,
    candidateRecordPath,
    version = "0.0.0-fixture",
} = {}) {
    if (!artifactId || !outputRoot || !candidateRecordPath)
        throw new Error(
            "artifactId, outputRoot, and candidateRecordPath are required",
        );
    if (existsSync(outputRoot))
        throw new Error(`Candidate output must not exist: ${outputRoot}`);
    if (existsSync(candidateRecordPath))
        throw new Error(
            `Candidate record must not exist: ${candidateRecordPath}`,
        );
    const configurationErrors =
        validateDistributionConfiguration(repositoryRoot);
    if (configurationErrors.length > 0)
        throw new Error(configurationErrors.join("; "));
    const artifactCatalog = readJson(
        join(repositoryRoot, "catalog/v2/artifacts.json"),
    );
    const policy = readJson(
        join(repositoryRoot, "distribution/rollout-policy.json"),
    );
    const artifact = artifactCatalog.artifacts?.find(
        (candidate) => candidate.id === artifactId,
    );
    if (!artifact)
        throw new Error(`Unknown distribution artifact: ${artifactId}`);
    if (
        artifact.materializationAllowed !== true ||
        artifact.runtimeEligible !== false ||
        artifact.fixtureOnly !== true ||
        !policy.candidate.allowedArtifactIds.includes(artifactId)
    ) {
        throw new Error(
            `Distribution artifact is not authorized for fixture staging: ${artifactId}`,
        );
    }
    if (artifactId !== fixtureArtifactId)
        throw new Error(`No generator is bound to artifact: ${artifactId}`);
    const manifest = generateDistributionFixture({
        repositoryRoot,
        outputRoot,
        version,
    });
    const manifestPath = join(outputRoot, "distribution-manifest.json");
    const manifestBytes = readFileSync(manifestPath);
    const record = {
        schemaVersion: "1.0.0",
        state: "FIXTURE_CANDIDATE_ONLY",
        artifactId,
        version,
        manifestSha256: sha256(manifestBytes),
        manifestFiles: manifest.files.length,
        sourceCommit: null,
        generatedRepository: policy.generatedRepository.name,
        generatedRepositoryStatus: policy.generatedRepository.status,
        publicationEligible: false,
        promotionEligible: false,
    };
    writeFileSync(candidateRecordPath, `${JSON.stringify(record, null, 2)}\n`, {
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
        const record = stageDistributionCandidate({
            artifactId: arguments_.get("artifact"),
            outputRoot: arguments_.get("output"),
            candidateRecordPath: arguments_.get("record"),
            version: arguments_.get("version") ?? "0.0.0-fixture",
        });
        process.stdout.write(
            `Staged ${record.state} ${record.artifactId} at ${record.version}.\n`,
        );
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "Candidate staging failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
