#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    computeSupport,
    loadSupportCatalogs,
    supportPaths,
} from "./support-validation.mjs";
import {
    checkModeRequested,
    runGeneratorCheck,
    serializeJson,
} from "./generator-check.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

export function generateSupport(root = repositoryRoot) {
    return computeSupport(loadSupportCatalogs(root));
}

export function supportOutputs(root = repositoryRoot) {
    return new Map([[supportPaths.support, serializeJson(generateSupport(root))]]);
}

export function writeSupport(root = repositoryRoot) {
    const support = generateSupport(root);
    writeFileSync(join(root, supportPaths.support), serializeJson(support));
    return support;
}

function main() {
    if (checkModeRequested()) {
        process.exitCode = runGeneratorCheck({
            name: "generate-support",
            root: repositoryRoot,
            build: () => supportOutputs(),
        });
        return;
    }
    const support = writeSupport();
    process.stdout.write(
        `Generated support: ${support.summary.bindingCount} bindings; ${Object.entries(
            support.summary.byTier,
        )
            .map(([tier, count]) => `${tier}=${count}`)
            .join(", ")}; support=${support.summary.supportClaimCount}.\n`,
    );
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    main();
}
