#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";
import { loadPreviewAuthority } from "./package-fundamentals-preview-assets.mjs";
import { buildPreviewReadiness } from "./preview-readiness.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

function readJson(root, path) {
    try {
        return JSON.parse(readFileSync(join(root, path), "utf8"));
    } catch (error) {
        throw new Error(`Unable to read preview request input: ${path}`, {
            cause: error,
        });
    }
}

function git(root, arguments_) {
    try {
        return execFileSync("git", arguments_, {
            cwd: root,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        }).trim();
    } catch (error) {
        throw new Error(`Preview request git check failed: ${arguments_.join(" ")}`, {
            cause: error,
        });
    }
}

function requestsAtRevision(root, revision) {
    if (!revision) return null;
    try {
        return JSON.parse(
            git(root, [
                "show",
                `${revision}:distribution/preview-requests.json`,
            ]),
        );
    } catch (error) {
        try {
            git(root, ["cat-file", "-e", `${revision}^{commit}`]);
            const path = git(root, [
                "ls-tree",
                "--name-only",
                revision,
                "--",
                "distribution/preview-requests.json",
            ]);
            if (path === "")
                return {
                    schemaVersion: 1,
                    defaultPolicy: "deny",
                    requests: [],
                };
        } catch {
            // The bounded error below retains the original failed read as cause.
        }
        throw new Error(
            `Unable to read prior preview requests at ${revision}`,
            { cause: error },
        );
    }
}

export function validatePreviewRequests(
    repositoryRoot = defaultRepositoryRoot,
    { requireRequest = false, baseRevision = null } = {},
) {
    const root = resolve(repositoryRoot);
    const requests = readJson(root, "distribution/preview-requests.json");
    const schema = readJson(
        root,
        "distribution/preview-requests.schema.json",
    );
    const errors = [
        ...validateSchemaVocabulary(schema),
        ...validateAgainstSchema(requests, schema, schema),
    ];
    const authority = loadPreviewAuthority(root);
    const ids = new Set();
    const versions = new Set();
    for (const [index, request] of (requests.requests ?? []).entries()) {
        const path = `$.requests[${index}]`;
        if (ids.has(request.id)) errors.push(`${path}.id: duplicate request`);
        ids.add(request.id);
        if (versions.has(request.version))
            errors.push(`${path}.version: duplicate preview version`);
        versions.add(request.version);
        if (!/^0\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)-preview\.(?:0|[1-9][0-9]*)$/.test(request.version))
            errors.push(`${path}.version: expected 0.MINOR.PATCH-preview.N`);
        if (
            request.sourceRevision !== authority.source.sourceRevision ||
            request.sourceContentDigest !== authority.source.contentDigest
        )
            errors.push(
                `${path}: source revision and digest must match the selected immutable preview source`,
            );
        if (/^[a-f0-9]{40}$/.test(request.sourceRevision)) {
            try {
                git(root, ["cat-file", "-e", `${request.sourceRevision}^{commit}`]);
                git(root, ["merge-base", "--is-ancestor", request.sourceRevision, "HEAD"]);
            } catch (error) {
                errors.push(`${path}.sourceRevision: must be an ancestor commit`);
            }
        }
        const expectedId = `${request.profileId}-${request.version.replaceAll(".", "-")}`;
        if (request.id !== expectedId)
            errors.push(`${path}.id: must equal ${expectedId}`);
    }
    if (requireRequest && requests.requests.length === 0)
        errors.push("At least one passive preview request is required");
    const previous = requestsAtRevision(root, baseRevision);
    if (previous) {
        const previousRequests = previous.requests ?? [];
        const unchanged =
            JSON.stringify(requests.requests) ===
            JSON.stringify(previousRequests);
        if (
            !unchanged &&
            requests.requests.length !== previousRequests.length + 1
        )
            errors.push("Preview requests must append exactly one record");
        if (!unchanged)
            for (const [index, previousRequest] of previousRequests.entries())
                if (
                    JSON.stringify(requests.requests[index]) !==
                    JSON.stringify(previousRequest)
                )
                    errors.push(
                        `Preview request ${previousRequest.id} is not append-only`,
                    );
        if (requireRequest && unchanged)
            errors.push("A new passive preview request must be appended");
    }
    if ((requests.requests?.length ?? 0) > 0) {
        const readiness = buildPreviewReadiness(root);
        if (readiness.state !== "READY_FOR_PREVIEW_REQUEST")
            errors.push(
                `Preview request is blocked: ${readiness.blockers
                    .map((blocker) => blocker.code)
                    .join(", ")}`,
            );
    }
    return [...new Set(errors)];
}

function main() {
    const arguments_ = process.argv.slice(2);
    const requireRequest = arguments_.includes("--require-request");
    const baseIndex = arguments_.indexOf("--base");
    const baseRevision = baseIndex >= 0 ? arguments_[baseIndex + 1] : null;
    if (baseIndex >= 0 && !baseRevision) {
        process.stderr.write("--base requires a revision\n");
        process.exitCode = 1;
        return;
    }
    const errors = validatePreviewRequests(defaultRepositoryRoot, {
        requireRequest,
        baseRevision,
    });
    if (errors.length > 0) {
        process.stderr.write(
            `Preview request validation failed:\n${errors
                .map((error) => `- ${error}`)
                .join("\n")}\n`,
        );
        process.exitCode = 1;
        return;
    }
    process.stdout.write("Preview requests are valid.\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
