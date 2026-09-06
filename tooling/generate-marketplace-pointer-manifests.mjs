#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    publicMarketplaceDistributionTag,
    publicMarketplaceIdentity,
} from "./generate-public-marketplace-distribution.mjs";

// The Cratis/AI default branch carries only these four thin marketplace
// manifests. Every one of them resolves its plugin from an immutable ref on the
// protected distribution branch, so adding Cratis/AI as a marketplace never
// exposes the authored root skills/ tree.
//
// The publish workflow passes the exact distribution-branch commit SHA it just
// pushed as `ref`, because the canonical dist/vX.Y.Z tag is created on main by
// cratis/release-action and is never applied to the distribution branch. When
// `ref` is omitted the tag-derived value is used, which keeps every caller that
// only knows a version working and documents the intended shape.
//
// gemini-extension.json, a root plugin.json, and a root package.json are
// deliberately absent: those hosts read a repository root directly rather than
// following a marketplace source, so they must install from the tag or a release
// archive instead.
export const marketplacePointerManifestPaths = Object.freeze([
    ".agents/plugins/marketplace.json",
    ".claude-plugin/marketplace.json",
    ".cursor-plugin/marketplace.json",
    ".github/plugin/marketplace.json",
]);

function pinnedSource(ref) {
    return {
        source: "github",
        repo: publicMarketplaceIdentity.distributionRepository,
        ref,
        path: publicMarketplaceIdentity.pluginRoot,
    };
}

export function createMarketplacePointerManifests(version, ref) {
    // Derive the tag unconditionally: it is what validates that the version is
    // an exact 0.x.y, and that cap must hold whether or not a ref overrides the
    // install pointer.
    const tag = publicMarketplaceDistributionTag(version);
    const resolved = ref ?? tag;
    const { profileId, description } = publicMarketplaceIdentity;
    const source = pinnedSource(resolved);
    const portable = (extra) => ({
        name: "cratis",
        owner: { name: "Cratis" },
        metadata: { description, version },
        plugins: [
            {
                name: profileId,
                description,
                version,
                source,
                ...extra,
            },
        ],
    });
    return new Map([
        [
            ".agents/plugins/marketplace.json",
            {
                name: "cratis",
                interface: { displayName: "Cratis" },
                plugins: [
                    {
                        name: profileId,
                        source,
                        policy: {
                            installation: "AVAILABLE",
                            authentication: "ON_INSTALL",
                        },
                        category: "Developer Tools",
                    },
                ],
            },
        ],
        [".claude-plugin/marketplace.json", portable({ strict: true })],
        [".cursor-plugin/marketplace.json", portable({})],
        [".github/plugin/marketplace.json", portable({ strict: true })],
    ]);
}

export function generateMarketplacePointerManifests({
    outputRoot,
    version,
    ref,
} = {}) {
    if (!outputRoot) throw new Error("outputRoot is required");
    const root = resolve(outputRoot);
    const manifests = createMarketplacePointerManifests(version, ref);
    const paths = [...manifests.keys()].sort();
    if (
        JSON.stringify(paths) !==
        JSON.stringify([...marketplacePointerManifestPaths])
    )
        throw new Error("Marketplace pointer manifest inventory changed");
    for (const path of paths) {
        const destination = join(root, path);
        mkdirSync(dirname(destination), { recursive: true });
        writeFileSync(
            destination,
            `${JSON.stringify(manifests.get(path), null, 2)}\n`,
        );
    }
    const tag = publicMarketplaceDistributionTag(version);
    return {
        version,
        tag,
        ref: ref ?? tag,
        repository: publicMarketplaceIdentity.distributionRepository,
        paths,
    };
}

function main() {
    const [outputRoot, version, ref] = process.argv.slice(2);
    try {
        if (!outputRoot || !existsSync(outputRoot))
            throw new Error("An existing output root is required");
        const result = generateMarketplacePointerManifests({
            outputRoot,
            version,
            ref,
        });
        process.stdout.write(
            `Generated ${result.paths.length} marketplace pointer manifests for ${result.repository}@${result.ref} (release ${result.tag}).\n`,
        );
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "Marketplace pointer manifest generation failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
