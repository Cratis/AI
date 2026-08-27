#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";

const toolingRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const schemaPath = resolve(toolingRoot, "agent-mutation-manifest.schema.json");

function canonicalize(value) {
    if (Array.isArray(value))
        return `[${value.map((item) => canonicalize(item)).join(",")}]`;
    if (value && typeof value === "object")
        return `{${Object.keys(value)
            .sort()
            .map(
                (key) =>
                    `${JSON.stringify(key)}:${canonicalize(value[key])}`,
            )
            .join(",")}}`;
    return JSON.stringify(value);
}

function sha256(value) {
    return createHash("sha256").update(value).digest("hex");
}

function normalizedStrings(values) {
    return [...values].sort((left, right) => {
        if (left < right) return -1;
        if (left > right) return 1;
        return 0;
    });
}

function issueState(value = {}) {
    return {
        state: value.state,
        labels: normalizedStrings(value.labels ?? []),
        assignees: normalizedStrings(value.assignees ?? []),
    };
}

export function issuePreStateFingerprint(preState) {
    return sha256(
        canonicalize({
            ...issueState(preState),
            updatedAt: preState?.updatedAt,
        }),
    );
}

export function mutationManifestDigest(manifest) {
    return sha256(canonicalize(manifest));
}

function repositoryIsValid(repository) {
    return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository);
}

export function validateMutationManifest(manifest) {
    let schema;
    try {
        schema = JSON.parse(readFileSync(schemaPath, "utf8"));
    } catch (error) {
        throw new Error("Unable to load mutation manifest schema", {
            cause: error,
        });
    }
    const errors = [
        ...validateSchemaVocabulary(schema),
        ...validateAgainstSchema(manifest, schema, schema),
    ];
    if (!repositoryIsValid(manifest.repository))
        errors.push("$.repository: expected exact owner/repository identity");
    if (
        JSON.stringify(manifest.policy?.longLivedLabels) !==
        JSON.stringify(["idea", "investigate"])
    )
        errors.push("$.policy.longLivedLabels: expected idea and investigate");
    if (manifest.authorization?.state === "pending") {
        if (
            manifest.authorization.approvedBy !== "" ||
            manifest.authorization.approvedAt !== ""
        )
            errors.push("$.authorization: pending approval must be empty");
    } else if (manifest.authorization?.state === "approved") {
        if (
            !manifest.authorization.approvedBy ||
            !manifest.authorization.approvedAt
        )
            errors.push("$.authorization: approved mutation requires identity and time");
    }
    const issueNumbers = new Set();
    for (const [index, target] of (manifest.targets ?? []).entries()) {
        const path = `$.targets[${index}]`;
        if (issueNumbers.has(target.issueNumber))
            errors.push(`${path}.issueNumber: duplicate target`);
        issueNumbers.add(target.issueNumber);
        for (const field of ["labels", "assignees"])
            for (const stateName of ["preState", "forward", "inverse"]) {
                const values = target[stateName]?.[field] ?? [];
                if (
                    JSON.stringify(values) !==
                    JSON.stringify(normalizedStrings(values))
                )
                    errors.push(
                        `${path}.${stateName}.${field}: values must be sorted`,
                    );
            }
        if (
            target.preState?.fingerprintSha256 !==
            issuePreStateFingerprint(target.preState)
        )
            errors.push(`${path}.preState: fingerprint mismatch`);
        if (
            JSON.stringify(issueState(target.inverse)) !==
            JSON.stringify(issueState(target.preState))
        )
            errors.push(`${path}.inverse: must exactly restore pre-state`);
        if (
            target.forward?.state === "closed" &&
            target.preState?.labels?.some((label) =>
                manifest.policy?.longLivedLabels?.includes(label),
            )
        )
            errors.push(`${path}: long-lived issue cannot be closed`);
        if (
            JSON.stringify(issueState(target.forward)) ===
            JSON.stringify(issueState(target.preState))
        )
            errors.push(`${path}.forward: mutation has no effect`);
    }
    return [...new Set(errors)];
}

export function renderInversePayload(manifest) {
    const errors = validateMutationManifest(manifest);
    if (errors.length > 0)
        throw new Error(`Mutation manifest is invalid: ${errors.join("; ")}`);
    return {
        schemaVersion: 1,
        state: "REVERSAL_PAYLOAD_PREPARED",
        runId: manifest.runId,
        repository: manifest.repository,
        manifestSha256: mutationManifestDigest(manifest),
        authorizationState: manifest.authorization.state,
        operations: manifest.targets
            .map((target) => ({
                issueNumber: target.issueNumber,
                method: "PATCH",
                endpoint: `repos/${manifest.repository}/issues/${target.issueNumber}`,
                expectedPreStateFingerprint:
                    target.preState.fingerprintSha256,
                body: issueState(target.inverse),
            }))
            .sort(
                (left, right) => left.issueNumber - right.issueNumber,
            ),
        executionPerformed: false,
    };
}

function readManifest(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(`Unable to read mutation manifest: ${path}`, {
            cause: error,
        });
    }
}

function main() {
    const [operation, manifestPath] = process.argv.slice(2);
    if (!new Set(["validate", "digest", "render-inverse"]).has(operation) || !manifestPath) {
        process.stderr.write(
            "Usage: node tooling/agent-mutation-protocol.mjs validate|digest|render-inverse <manifest.json>\n",
        );
        process.exitCode = 1;
        return;
    }
    try {
        const manifest = readManifest(manifestPath);
        const errors = validateMutationManifest(manifest);
        if (errors.length > 0)
            throw new Error(errors.join("\n"));
        if (operation === "validate") {
            process.stdout.write("Mutation manifest is valid.\n");
            return;
        }
        if (operation === "digest") {
            process.stdout.write(`${mutationManifestDigest(manifest)}\n`);
            return;
        }
        process.stdout.write(
            `${JSON.stringify(renderInversePayload(manifest), null, 2)}\n`,
        );
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "Mutation protocol failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
