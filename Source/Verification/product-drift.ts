// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Product } from './product-sync.ts';

export interface Release { tag_name: string; draft: boolean; prerelease: boolean }
export interface ProductLatest { version: string; releases?: Release[] }
export interface DriftRow {
    id: string;
    product: string;
    repository: string;
    synced: string | null;
    latest: string;
    releasesBehind: number | null;
    skills: string[];
    drift: boolean;
}
export interface NotCoveredProduct { id: string; product: string; repository: string; reason: string }
export interface NotCheckedProduct { id: string; product: string; repository: string }
export interface DriftReport { products: number; drifted: number; rows: DriftRow[]; notCovered: NotCoveredProduct[]; notChecked: NotCheckedProduct[] }
export const releaseVersion = (tag: string) => tag.replace(/^v/, '');

/** A bounded release page proves a count only if it contains both endpoints. No semver arithmetic guesses. */
export function compareProduct(product: Product, latest: ProductLatest): DriftRow {
    if (product.coverage === 'not-covered') throw new Error(`Not-covered product '${product.id}' must not be compared.`);
    const synced = product.synced?.version ?? null;
    const version = releaseVersion(latest.version);
    const drift = synced !== version;
    let releasesBehind: number | null = drift ? null : 0;
    const releases = latest.releases?.filter(release => !release.draft && (product.track === 'prerelease' || !release.prerelease)).map(release => releaseVersion(release.tag_name));
    if (releases && synced) {
        const from = releases.indexOf(synced);
        const to = releases.indexOf(version);
        if (from >= 0 && to >= 0 && from >= to) releasesBehind = from - to;
    }
    return { id: product.id, product: product.name, repository: product.repository, synced, latest: version, releasesBehind, skills: product.covers.skills, drift };
}
export function driftReport(rows: DriftRow[], notCovered: NotCoveredProduct[] = [], notChecked: NotCheckedProduct[] = []): DriftReport {
    if (rows.length + notCovered.length + notChecked.length === 0) throw new Error('Zero products were considered; the report would pass vacuously.');
    return { products: rows.length, drifted: rows.filter(row => row.drift).length, rows, notCovered, notChecked };
}

/** Decided exclusions never reach the release lookup, including when every product is excluded. */
export function reportProducts(products: Product[], latestFor: (product: Product) => ProductLatest): DriftReport {
    const rows: DriftRow[] = [];
    const notCovered: NotCoveredProduct[] = [];
    const notChecked: NotCheckedProduct[] = [];
    for (const product of products) {
        if (product.coverage === 'not-covered') {
            if (!product.notes?.trim()) throw new Error(`Not-covered product '${product.id}' needs a reason.`);
            notCovered.push({ id: product.id, product: product.name, repository: product.repository, reason: product.notes });
        } else {
            try {
                rows.push(compareProduct(product, latestFor(product)));
            } catch (error) {
                if (product.visibility !== 'private' || !(error instanceof Error) || !/\(HTTP (?:403|404)\)/.test(error.message)) throw error;
                notChecked.push({ id: product.id, product: product.name, repository: product.repository });
            }
        }
    }
    return driftReport(rows, notCovered, notChecked);
}
export function driftExitCode(report: DriftReport): 0 | 1 { return report.drifted > 0 ? 1 : 0; }
const cell = (value: string) => value.replaceAll('|', '\\|').replace(/[\r\n]/g, ' ');
export function driftTable(report: DriftReport): string {
    return [
        `Compared ${report.products} products; ${report.drifted} have drifted.`, '',
        '| Product | Synced | Latest | Releases behind | Covered skills |',
        '| --- | --- | --- | --- | --- |',
        ...report.rows.map(row => `| ${cell(row.product)} | ${row.synced ?? 'never synced'} | ${cell(row.latest)} | ${row.releasesBehind ?? 'unknown'} | ${row.skills.map(cell).join(', ') || 'none'} |`),
        ...(report.notChecked.length ? ['', '## Not checked (private repository, no access)', '', ...report.notChecked.map(product => `- ${cell(product.product)} (${cell(product.repository)})`)] : []),
        ...(report.notCovered.length ? ['', '## Not covered (by decision)', '', ...report.notCovered.map(product => `- ${cell(product.product)}: ${cell(product.reason)}`)] : []),
    ].join('\n');
}
