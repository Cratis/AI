// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { driftTable, type DriftReport } from './product-drift.ts';
import type { Github } from './product-github.ts';

const title = 'AI corpus product drift';
const label = 'product-drift';

/** Workflow concurrency serializes this single-issue mutation; duplicates refuse rather than choosing a target. */
export function reconcileProductDrift(gh: Github, repository: string, report: DriftReport): void {
    if (!/^Cratis\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('A Cratis GITHUB_REPOSITORY is required.');
    if (report.products + report.notCovered.length + report.notChecked.length < 1 || report.products !== report.rows.length || report.drifted !== report.rows.filter(row => row.drift).length) throw new Error('Invalid product drift counts.');
    const body = `${driftTable(report)}\n\nRead each tracked product's releases since the recorded floor, update its covered skills with evidence, and move synced in the same change. Unknown counts are not evidence of zero drift.\n`;
    const issues: unknown = JSON.parse(gh(['issue', 'list', '--repo', repository, '--state', 'open', '--search', `"${title}" in:title`, '--limit', '100', '--json', 'number,title']));
    if (!Array.isArray(issues) || !issues.every(issue => typeof issue === 'object' && issue !== null && typeof issue.title === 'string' && Number.isSafeInteger(issue.number) && issue.number > 0)) throw new Error('Invalid product drift issue list.');
    if (issues.length === 100) throw new Error('Product drift issue search reached its limit; cannot prove a unique target.');
    const matches = issues.filter(issue => issue.title === title);
    if (matches.length > 1) throw new Error('Multiple open AI corpus product drift issues; reconcile them before automation continues.');
    const issue = matches[0];
    if (issue) {
        const current = JSON.parse(gh(['issue', 'view', String(issue.number), '--repo', repository, '--json', 'title,state']));
        if (current.title !== title || current.state !== 'OPEN') throw new Error('Product drift issue changed before reconciliation.');
    }
    if (report.drifted === 0 && report.notChecked.length === 0) {
        if (issue) {
            gh(['issue', 'edit', String(issue.number), '--repo', repository, '--body-file', '-'], body);
            gh(['issue', 'close', String(issue.number), '--repo', repository, '--reason', 'completed', '--comment', `Product drift is clear: ${report.products} tracked products compared, zero drift; ${report.notCovered.length} not covered by decision.`]);
        }
        return;
    }
    const labels: unknown = JSON.parse(gh(['label', 'list', '--repo', repository, '--search', label, '--limit', '100', '--json', 'name']).trim() || '[]');
    if (!Array.isArray(labels) || !labels.every(item => typeof item === 'object' && item !== null && typeof item.name === 'string')) throw new Error('Invalid GitHub label list.');
    if (!labels.some(item => item.name === label)) gh(['label', 'create', label, '--repo', repository, '--color', '5319e7', '--description', 'AI corpus product release drift']);
    if (issue) gh(['issue', 'edit', String(issue.number), '--repo', repository, '--title', title, '--add-label', label, '--body-file', '-'], body);
    else gh(['issue', 'create', '--repo', repository, '--title', title, '--label', label, '--body-file', '-'], body);
}
