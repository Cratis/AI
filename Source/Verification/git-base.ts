// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Run bounded Git reads without presentation filters or external diff drivers. */
export function comparisonGit(root: string, ...args: string[]): string {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe', timeout: 30_000, maxBuffer: 16 * 1024 * 1024 }).trimEnd();
}

/** CI checks the immutable event base, including shallow checkouts without origin/main. */
export function evaluationBaseRevision(eventName: string, event: unknown): string | undefined {
    if (!['pull_request', 'push'].includes(eventName)) return undefined;
    const document = event as { pull_request?: { base?: { sha?: unknown } }; before?: unknown } | null;
    const revision = eventName === 'push' ? document?.before : document?.pull_request?.base?.sha;
    if (typeof revision !== 'string' || !/^[a-f0-9]{40}$/.test(revision) || /^0+$/.test(revision)) throw new Error('Evaluation ratchet requires a nonzero event base commit SHA.');
    return revision;
}

/** Shared base selection for diff checks and the evaluation-coverage ratchet; callers choose skip/failure policy. */
export function verificationBase(root: string): string {
    const git = (...args: string[]) => comparisonGit(root, ...args);
    const eventBase = process.env.GITHUB_EVENT_PATH
        ? evaluationBaseRevision(process.env.GITHUB_EVENT_NAME ?? '', JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')))
        : undefined;
    if (!eventBase) return git('merge-base', 'HEAD', 'origin/main');
    // actions/checkout defaults to one commit. Fetch only the event's exact base when absent.
    try { git('cat-file', '-e', `${eventBase}^{commit}`); }
    catch { git('fetch', '--no-tags', '--depth=1', 'origin', eventBase); }
    return eventBase;
}

/** Diff against the merge base, recovering a bounded amount of history for shallow CI checkouts. */
export function instructionMergeBase(root: string): string {
    const base = verificationBase(root);
    try { return comparisonGit(root, 'merge-base', 'HEAD', base); }
    catch (error) {
        if (comparisonGit(root, 'rev-parse', '--is-shallow-repository') !== 'true') throw error;
        const head = comparisonGit(root, 'rev-parse', 'HEAD');
        comparisonGit(root, 'fetch', '--no-tags', '--depth=200', 'origin', head, base);
        return comparisonGit(root, 'merge-base', 'HEAD', base);
    }
}
