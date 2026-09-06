#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareOrdinal } from "./catalog-ordering.mjs";
import {
    readCatalog,
    validateAgainstSchema,
    validateSchemaVocabulary,
} from "./catalog-validation.mjs";
import { subscriptionHarnessIds } from "./harness-registry.mjs";
import {
    loadMcpDeclarations,
    mcpDeclarationRoot,
    readProfileCatalog,
} from "./resolve-profiles.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

export const mcpDeclarationSchemaPath = `${mcpDeclarationRoot}/mcp-server-declaration.schema.json`;

/**
 * Key names that may legitimately talk *about* credentials. Any other
 * credential-shaped key is a defect: a declaration never carries one.
 */
const credentialVocabularyKeys = new Set([
    "credentialHandling",
    "credentialsEmittedByCratisAi",
]);

const credentialKeyPattern = /secret|token|password|api[_-]?key|credential/i;
const credentialValuePatterns = [
    /^\$\{.+\}$/,
    /^<.+>$/,
    /\bBearer\s+\S/,
    /\b(?:sk|ghp|gho|github_pat)_[A-Za-z0-9]{8,}/,
];

function scanForCredentials(value, path, errors) {
    if (typeof value === "string") {
        for (const pattern of credentialValuePatterns)
            if (pattern.test(value))
                errors.push(
                    `${path}: MCP declaration must not contain a credential or credential-shaped placeholder`,
                );
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((item, index) =>
            scanForCredentials(item, `${path}[${index}]`, errors),
        );
        return;
    }
    if (value && typeof value === "object")
        for (const [key, child] of Object.entries(value)) {
            if (
                credentialKeyPattern.test(key) &&
                !credentialVocabularyKeys.has(key)
            )
                errors.push(
                    `${path}.${key}: MCP declaration must not declare a credential-bearing field`,
                );
            scanForCredentials(child, `${path}.${key}`, errors);
        }
}

function declarationFiles(root) {
    const directory = join(root, mcpDeclarationRoot);
    if (!existsSync(directory)) return [];
    return readdirSync(directory)
        .filter(
            (name) => name.endsWith(".json") && !name.endsWith(".schema.json"),
        )
        .sort(compareOrdinal);
}

export function validateMcpDeclarations(repositoryRoot = defaultRepositoryRoot) {
    const root = resolve(repositoryRoot);
    const errors = [];
    let schema;
    let declarations;
    let profileCatalog;
    try {
        schema = readCatalog(join(root, mcpDeclarationSchemaPath));
        declarations = loadMcpDeclarations(root);
        profileCatalog = readProfileCatalog(root);
    } catch (error) {
        return [`MCP declarations cannot be loaded: ${error.message}`];
    }
    errors.push(
        ...validateSchemaVocabulary(schema, "mcp-server-declaration.schema.json"),
    );
    const knownHarnesses = new Set(subscriptionHarnessIds);
    const knownProfiles = new Map(
        [
            ...profileCatalog.publicProfiles,
            ...profileCatalog.engineeringProfiles,
        ].map((profile) => [profile.id, profile]),
    );
    const files = declarationFiles(root);
    const declaredIds = new Set();
    for (const [index, declaration] of declarations.entries()) {
        const path = declaration.declarationPath;
        const { declarationPath, ...document } = declaration;
        errors.push(...validateAgainstSchema(document, schema, schema, path));
        scanForCredentials(document, path, errors);
        if (`${document.id}.json` !== files[index])
            errors.push(`${path}: declaration id must match the file name`);
        if (declaredIds.has(document.id))
            errors.push(`${path}: duplicate MCP declaration id ${document.id}`);
        declaredIds.add(document.id);
        if (
            document.resolvable !==
            (document.status === "declared-not-published")
        )
            errors.push(
                `${path}: resolvable must be true only for a declared-not-published server`,
            );
        for (const profileId of document.requires?.profileIds ?? [])
            if (!knownProfiles.has(profileId))
                errors.push(`${path}: unknown required profile ${profileId}`);
        for (const mapping of document.hostConfigurationMapping ?? [])
            if (!knownHarnesses.has(mapping.host))
                errors.push(
                    `${path}: unknown host ${mapping.host} in the configuration mapping`,
                );
        if (
            document.resolvable === false &&
            (document.requires?.profileIds ?? []).length > 0
        )
            errors.push(
                `${path}: an unpublished extension point must not be required by a profile`,
            );
    }
    for (const [profileId, profile] of knownProfiles)
        for (const serverId of profile.mcpServers ?? []) {
            if (!declaredIds.has(serverId)) {
                errors.push(
                    `${profileId}: requires undeclared MCP server ${serverId}`,
                );
                continue;
            }
            const declaration = declarations.find(
                (candidate) => candidate.id === serverId,
            );
            if (declaration.resolvable !== true)
                errors.push(
                    `${profileId}: requires ${serverId}, which is an unpublished extension point`,
                );
            if (!(declaration.requires?.profileIds ?? []).includes(profileId))
                errors.push(
                    `${profileId}: is not listed in the required profiles of ${serverId}`,
                );
        }
    return [...new Set(errors)].sort(compareOrdinal);
}

function main() {
    const errors = validateMcpDeclarations();
    if (errors.length > 0) {
        process.stderr.write(
            `MCP declaration validation failed with ${errors.length} error(s):\n`,
        );
        for (const error of errors) process.stderr.write(`- ${error}\n`);
        process.exitCode = 1;
        return;
    }
    const count = declarationFiles(defaultRepositoryRoot).length;
    process.stdout.write(
        `MCP declaration validation passed: ${count} declarations.\n`,
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
