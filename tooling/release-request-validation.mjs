#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
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

function canonicalJson(value) {
    if (Array.isArray(value))
        return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
    if (value && typeof value === "object")
        return `{${Object.keys(value)
            .sort()
            .map(
                (key) =>
                    `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
            )
            .join(",")}}`;
    return JSON.stringify(value);
}

export function releasePreflightDigest(record) {
    const { preflightDigest: _digest, ...payload } = record;
    return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

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
    const read = (path) => parseJson(join(repositoryRoot, path), errors);
    const profileCatalog = read("distribution/profile-catalog.json");
    const targets = read("catalog/v2/targets.json")?.targets;
    const sources = read("catalog/v2/sources.json")?.sources;
    const sourceContracts = read("catalog/v2/source-contracts.json")?.contracts;
    const authoringContracts = read(
        "catalog/v2/authoring-contracts.json",
    )?.contracts;
    const artifacts = read("catalog/v2/artifacts.json")?.artifacts;
    const releaseAutomationCapabilities = read(
        "distribution/release-automation-capabilities.json",
    );
    const releaseReadiness = read("catalog/v2/release-readiness.json");
    const releaseRecordSchema = read("distribution/release-record.schema.json");
    const evidenceIds = read("catalog/v2/evidence.json")?.evidence?.map(
        (evidence) => evidence.id,
    );
    const releaseRecordsRoot = join(
        repositoryRoot,
        "distribution/release-records",
    );
    const releaseRecords = existsSync(releaseRecordsRoot)
        ? readdirSync(releaseRecordsRoot)
              .filter((name) => name.endsWith(".json"))
              .sort()
              .map((name) => read(`distribution/release-records/${name}`))
              .filter(Boolean)
        : [];
    if (releaseRecordSchema)
        for (const record of releaseRecords) {
            errors.push(
                ...validateAgainstSchema(
                    record,
                    releaseRecordSchema,
                    releaseRecordSchema,
                    "release-record",
                ),
            );
            if (
                record.stage === "preflight-snapshot" &&
                record.preflightDigest !== releasePreflightDigest(record)
            )
                errors.push(
                    `${record.recordId}: preflight record digest is stale`,
                );
        }
    if (
        !profileCatalog ||
        !targets ||
        !sources ||
        !sourceContracts ||
        !authoringContracts ||
        !artifacts ||
        !releaseAutomationCapabilities ||
        !releaseReadiness ||
        !releaseRecordSchema ||
        !evidenceIds
    )
        return null;
    return {
        profileCatalog,
        targets,
        sources,
        sourceContracts,
        authoringContracts,
        artifacts,
        releaseAutomationCapabilities,
        releaseReadiness,
        evidenceIds,
        releaseRecords,
    };
}

export function validateReleaseRequest(request, relativePath, inputs, schema) {
    const errors = validateAgainstSchema(request, schema, schema, relativePath);
    if (!request || typeof request !== "object") return { errors, plans: [] };
    if (basename(relativePath) !== `v${request.version}.json`)
        errors.push(
            `${relativePath}: filename must be v${request.version}.json`,
        );
    const automationCapabilities = inputs?.releaseAutomationCapabilities;
    if (inputs?.releaseReadiness.releaseRequestEligible !== true)
        errors.push(
            `${relativePath}: S10 release readiness blocks every request`,
        );
    const evidenceIds = new Set(inputs?.evidenceIds ?? []);
    for (const evidenceId of request.prerequisiteEvidenceIds ?? [])
        if (!evidenceIds.has(evidenceId))
            errors.push(
                `${relativePath}: unknown prerequisite evidence ${evidenceId}`,
            );
    const preflight = inputs?.releaseRecords?.find(
        (record) =>
            record.stage === "preflight-snapshot" &&
            record.preflightDigest === request.preflightDigest,
    );
    if (
        !preflight ||
        preflight.preflightDigest !== releasePreflightDigest(preflight) ||
        preflight.releaseVersion !== request.version ||
        preflight.artifactDigest !== request.artifactDigest ||
        preflight.sourceRevision !== request.sourceRevision ||
        JSON.stringify([...(preflight.evidenceIds ?? [])].sort()) !==
            JSON.stringify([...(request.prerequisiteEvidenceIds ?? [])].sort())
    )
        errors.push(
            `${relativePath}: request is not bound to an existing exact preflight snapshot`,
        );
    if (
        automationCapabilities &&
        (request.profiles?.length ?? 0) >
            automationCapabilities.maxProfilesPerRelease
    )
        errors.push(
            `${relativePath}: release exceeds the implemented profile publication limit`,
        );
    if (automationCapabilities) {
        const implemented = automationCapabilities.automation;
        const requested = request.automation ?? {};
        for (const [capability, value] of Object.entries(implemented))
            if (requested[capability] !== value)
                errors.push(
                    `${relativePath}: automation ${capability} must match implemented value ${JSON.stringify(value)}`,
                );
        for (const capability of Object.keys(requested))
            if (!Object.hasOwn(implemented, capability))
                errors.push(
                    `${relativePath}: automation ${capability} is not implemented`,
                );
    }
    const knownCanaries = new Set(["samples-chronicle-backend"]);
    const canaryProfiles =
        request.canaries?.map((canary) => canary.profileId) ?? [];
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
            errors.push(`${relativePath}: unknown canary ${canary.canaryId}`);
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
    let relativePaths = [];
    if (onlyPath) relativePaths = [onlyPath];
    else if (existsSync(releasesRoot))
        relativePaths = readdirSync(releasesRoot)
            .filter((name) => name.endsWith(".json"))
            .sort()
            .map((name) => `distribution/releases/${name}`);
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
    const versions = requests.map((entry) => entry.request.version);
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
