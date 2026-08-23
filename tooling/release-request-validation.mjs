#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";
import { buildApprovedProfileReleasePlan } from "./generate-approved-profile-release.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

function parseJson(path, errors) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        errors.push(
            `${path}: ${error instanceof Error ? error.message : "invalid JSON"}`,
        );
        return null;
    }
}

function repositoryInputs(repositoryRoot, errors) {
    const read = path => parseJson(join(repositoryRoot, path), errors);
    const profileCatalog = read("distribution/profile-catalog.json");
    const targets = read("catalog/v2/targets.json")?.targets;
    const sources = read("catalog/v2/sources.json")?.sources;
    const sourceContracts = read("catalog/v2/source-contracts.json")?.contracts;
    const authoringContracts = read("catalog/v2/authoring-contracts.json")
        ?.contracts;
    const artifacts = read("catalog/v2/artifacts.json")?.artifacts;
    if (
        !profileCatalog ||
        !targets ||
        !sources ||
        !sourceContracts ||
        !authoringContracts ||
        !artifacts
    )
        return null;
    return {
        profileCatalog,
        targets,
        sources,
        sourceContracts,
        authoringContracts,
        artifacts,
    };
}

export function validateReleaseRequest(
    request,
    relativePath,
    inputs,
    schema,
) {
    const errors = validateAgainstSchema(
        request,
        schema,
        schema,
        relativePath,
    );
    if (!request || typeof request !== "object") return { errors, plans: [] };
    if (basename(relativePath) !== `v${request.version}.json`)
        errors.push(
            `${relativePath}: filename must be v${request.version}.json`,
        );
    const knownCanaries = new Set(["samples-chronicle-backend"]);
    const canaryProfiles = request.canaries?.map(canary => canary.profileId) ?? [];
    if (
        new Set(canaryProfiles).size !== canaryProfiles.length ||
        JSON.stringify([...new Set(canaryProfiles)].sort()) !==
            JSON.stringify([...(request.profiles ?? [])].sort())
    )
        errors.push(
            `${relativePath}: every profile needs exactly one named canary`,
        );
    for (const canary of request.canaries ?? [])
        if (!knownCanaries.has(canary.canaryId))
            errors.push(
                `${relativePath}: unknown canary ${canary.canaryId}`,
            );
    const plans = [];
    if (!inputs) return { errors, plans };
    for (const profileId of request.profiles ?? []) {
        const plan = buildApprovedProfileReleasePlan({
            profileId,
            version: request.version,
            ...inputs,
        });
        plans.push(plan);
        if (plan.state !== "READY_FOR_BOT_MATERIALIZATION")
            errors.push(
                `${relativePath}: ${profileId} release is blocked: ${plan.blockers.join(", ")}`,
            );
    }
    return { errors, plans };
}

export function validateReleaseRequests(
    repositoryRoot = defaultRepositoryRoot,
    onlyPath,
) {
    const errors = [];
    const schema = parseJson(
        join(repositoryRoot, "distribution/release-request.schema.json"),
        errors,
    );
    if (!schema) return { errors, requests: [] };
    errors.push(
        ...validateSchemaVocabulary(schema, "release-request.schema.json"),
    );
    const inputs = repositoryInputs(repositoryRoot, errors);
    const releasesRoot = join(repositoryRoot, "distribution/releases");
    const relativePaths = onlyPath
        ? [onlyPath]
        : existsSync(releasesRoot)
          ? readdirSync(releasesRoot)
                .filter(name => name.endsWith(".json"))
                .sort()
                .map(name => `distribution/releases/${name}`)
          : [];
    const requests = [];
    for (const relativePath of relativePaths) {
        if (!/^distribution\/releases\/v[^/]+\.json$/.test(relativePath)) {
            errors.push(`${relativePath}: release request path is invalid`);
            continue;
        }
        const request = parseJson(join(repositoryRoot, relativePath), errors);
        if (!request) continue;
        const result = validateReleaseRequest(
            request,
            relativePath,
            inputs,
            schema,
        );
        errors.push(...result.errors);
        requests.push({ relativePath, request, plans: result.plans });
    }
    const versions = requests.map(entry => entry.request.version);
    if (new Set(versions).size !== versions.length)
        errors.push("Release request versions must be unique");
    return { errors: [...new Set(errors)].sort(), requests };
}

function main() {
    const relativePath = process.argv[2];
    if (!relativePath) {
        process.stderr.write(
            "Usage: node tooling/release-request-validation.mjs distribution/releases/v<version>.json\n",
        );
        process.exitCode = 1;
        return;
    }
    const result = validateReleaseRequests(defaultRepositoryRoot, relativePath);
    if (result.errors.length) {
        for (const error of result.errors) process.stderr.write(`${error}\n`);
        process.exitCode = 1;
        return;
    }
    const entry = result.requests[0];
    process.stdout.write(
        `${JSON.stringify(
            {
                request: entry.relativePath,
                version: entry.request.version,
                profiles: entry.request.profiles,
                canaries: entry.request.canaries,
            },
            null,
            2,
        )}\n`,
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
