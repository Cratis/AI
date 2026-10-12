// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { spawnSync } from 'node:child_process';
import { releaseVersion, type ProductLatest, type Release } from './product-drift.ts';
import { productVersion, type Product } from './product-sync.ts';

export type Github = (args: string[], input?: string) => string;
export const github: Github = (args, input) => {
    const result = spawnSync('gh', args, { input, encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`gh ${args[0]} failed (${result.status}): ${result.stderr.trim()}`);
    return result.stdout;
};
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
function release(value: unknown): value is Release {
    return record(value) && typeof value.tag_name === 'string' && typeof value.draft === 'boolean' && typeof value.prerelease === 'boolean';
}

/** --jq is never used: an empty response or a non-404 API failure must not look like an up-to-date product. */
export function latestProduct(product: Product, gh: Github): ProductLatest {
    let latest: unknown;
    try {
        latest = JSON.parse(gh(['api', `repos/${product.repository}/releases/latest`]));
    } catch (error) {
        if (!(error instanceof Error) || !/\(HTTP 404\)/.test(error.message)) throw error;
        // GitHub also returns 404 for an inaccessible repository. Verify access before accepting "no releases".
        const repository: unknown = JSON.parse(gh(['api', `repos/${product.repository}`]));
        if (!record(repository) || typeof repository.default_branch !== 'string') throw new Error(`Invalid repository response for ${product.repository}.`);
        const commit: unknown = JSON.parse(gh(['api', `repos/${product.repository}/commits/${encodeURIComponent(repository.default_branch)}`]));
        if (!record(commit) || typeof commit.sha !== 'string' || !/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error(`Invalid default-branch commit for ${product.repository}.`);
        return { version: `main@${commit.sha.slice(0, 7)}` };
    }
    if (!release(latest) || latest.draft || latest.prerelease || !productVersion.test(releaseVersion(latest.tag_name)) || latest.tag_name.startsWith('main@')) throw new Error(`Invalid latest release for ${product.repository}.`);
    if (!product.synced || product.synced.version === releaseVersion(latest.tag_name) || product.synced.version.startsWith('main@')) return { version: latest.tag_name };
    // One page is cheap; if the old tag is not in it, the count stays unknown. A failed request still fails the report.
    const releases: unknown = JSON.parse(gh(['api', `repos/${product.repository}/releases?per_page=100`]));
    if (!Array.isArray(releases) || !releases.every(release)) throw new Error(`Invalid release list for ${product.repository}.`);
    return { version: latest.tag_name, releases };
}
