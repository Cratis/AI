// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Github } from './Github.ts';
import type { verifyContract } from './index.ts';

export function issueBody(version: string, report: Awaited<ReturnType<typeof verifyContract>>): string {
    return [
        `Screenplay ${version}'s published contract differs from the AI corpus. Update the skills and the standalone contract pin together after checking the examples.`,
        '', '## Findings', ...report.problems.map(problem => `- ${problem}`),
        '', '## Subjects checked', ...Object.entries(report.counts).map(([kind, count]) => `- ${kind}: ${count}`),
        '', '## Coverage gaps (mentions only, advisory)',
        ...Object.entries(report.coverage).map(([kind, values]) => `- ${kind}: ${values.length ? values.join(', ') : 'none'}`),
        '', `Contract: https://github.com/Cratis/Screenplay/releases/tag/${version}`,
        'Historical exceptions are exact-text matches with reasons; remove obsolete entries when bumping the pin.',
    ].join('\n');
}

/** Serial workflow concurrency prevents two release notifications from both creating an issue. */
export async function syncIssue(github: Github, repository: string, version: string, report: Awaited<ReturnType<typeof verifyContract>>): Promise<void> {
    if (!/^v?\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) throw new Error('Invalid Screenplay release version.');
    const label = 'screenplay-sync';
    const labels: unknown = JSON.parse(await github(['label', 'list', '--repo', repository, '--search', label, '--limit', '100', '--json', 'name']));
    if (!Array.isArray(labels) || !labels.every(item => typeof item === 'object' && item !== null && typeof item.name === 'string')) throw new Error('Invalid GitHub label list.');
    if (!labels.some(item => item.name === label)) await github(['label', 'create', label, '--repo', repository, '--color', '5319e7', '--description', 'Screenplay published-contract drift']);
    const issues: unknown = JSON.parse(await github(['issue', 'list', '--repo', repository, '--label', label, '--state', 'open', '--limit', '100', '--json', 'number']));
    if (!Array.isArray(issues) || !issues.every(item => typeof item === 'object' && item !== null && Number.isSafeInteger(item.number) && item.number > 0)) throw new Error('Invalid GitHub issue list.');
    if (issues.length > 1) throw new Error('Multiple open screenplay-sync issues; reconcile them before automation continues.');
    const issue = issues[0];
    if (report.problems.length === 0) {
        if (issue) await github(['issue', 'close', String(issue.number), '--repo', repository, '--reason', 'completed', '--comment', `Screenplay ${version} contract comparison is clean. Coverage gaps remain advisory in the workflow report.`]);
        return;
    }
    const title = `Sync the AI corpus with Screenplay ${version}`;
    const body = issueBody(version, report);
    if (issue) await github(['issue', 'edit', String(issue.number), '--repo', repository, '--title', title, '--body-file', '-'], body);
    else await github(['issue', 'create', '--repo', repository, '--title', title, '--label', label, '--assignee', 'woksin', '--body-file', '-'], body);
}
