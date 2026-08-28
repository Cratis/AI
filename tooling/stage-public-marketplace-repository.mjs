#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import {
    cpSync,
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generatePublicMarketplaceDistribution } from "./generate-public-marketplace-distribution.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(`Unable to read JSON: ${path}`, { cause: error });
    }
}

const generatedRepositoryContract = readJson(
    new URL("../distribution/generated-repository-contract.json", import.meta.url),
);

export function stagePublicMarketplaceRepository({
    repositoryRoot = defaultRepositoryRoot,
    currentDistributionRoot,
    outputRoot,
    version,
} = {}) {
    if (!currentDistributionRoot || !existsSync(currentDistributionRoot))
        throw new Error("currentDistributionRoot must exist");
    if (!outputRoot) throw new Error("outputRoot is required");
    const currentRoot = resolve(currentDistributionRoot);
    const root = resolve(outputRoot);
    if (existsSync(root)) throw new Error(`Staged repository already exists: ${root}`);
    try {
        const generated = generatePublicMarketplaceDistribution({
            repositoryRoot,
            outputRoot: root,
            version,
        });
        const candidates = join(currentRoot, "candidates");
        if (existsSync(candidates))
            cpSync(candidates, join(root, "candidates"), {
                recursive: true,
                errorOnExist: true,
            });
        for (const path of generatedRepositoryContract.repositoryControlPlane.allowedPaths) {
            const source = join(
                repositoryRoot,
                generatedRepositoryContract.repositoryControlPlane.sourceRoot,
                path,
            );
            const destination = join(root, path);
            mkdirSync(dirname(destination), { recursive: true });
            cpSync(source, destination, { errorOnExist: true });
        }
        return generated;
    } catch (error) {
        rmSync(root, { recursive: true, force: true });
        throw error;
    }
}

async function main() {
    const [currentDistributionRoot, outputRoot, version] = process.argv.slice(2);
    try {
        const result = await stagePublicMarketplaceRepository({
            currentDistributionRoot,
            outputRoot,
            version,
        });
        process.stdout.write(
            `Staged ${result.release.profileId}@${result.release.version} as a complete Distribution repository.\n`,
        );
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "Marketplace repository staging failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
