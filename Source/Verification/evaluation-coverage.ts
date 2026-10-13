// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { AuthoringFinding } from './AuthoringFinding.ts';

/** A JSON object of skill names to one-line reasons. The comparison baseline comes from the base ref. */
export function evaluationCoverageFindings(skills: string[], evaluated: string[], exemptions: unknown, baseline: unknown): AuthoringFinding[] {
    const file = 'Evaluations/unevaluated.json';
    const findings: AuthoringFinding[] = [];
    const add = (matchedText: string) => findings.push({ file, line: 1, rule: 'eval-coverage-ratchet', matchedText });
    const valid = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
    if (!valid(exemptions) || !valid(baseline)) { add('Exemptions and baseline must be objects of skill names to reasons.'); return findings; }
    if (skills.length === 0) add('Expected a nonempty corpus skill population.');
    for (const [name, reason] of Object.entries(exemptions)) {
        if (!Object.hasOwn(baseline, name)) add(`'${name}' is a new exemption; the baseline may only shrink.`);
        if (typeof reason !== 'string' || !reason.trim() || /[\r\n]/.test(reason)) add(`'${name}' requires a nonempty one-line reason.`);
        if (!skills.includes(name) || evaluated.includes(name)) add(`Remove stale exemption '${name}'.`);
    }
    for (const skill of skills) {
        if (!evaluated.includes(skill) && !Object.hasOwn(exemptions, skill)) add(`'${skill}' needs trigger.json and evals.json, or its existing baseline exemption.`);
    }
    return findings;
}

/** CI checks the immutable event base, including shallow checkouts that have no origin/main ref. */
export function evaluationBaseRevision(eventName: string, event: unknown): string | undefined {
    if (!['pull_request', 'push'].includes(eventName)) return undefined;
    const document = event as { pull_request?: { base?: { sha?: unknown } }; before?: unknown } | null;
    const revision = eventName === 'push' ? document?.before : document?.pull_request?.base?.sha;
    if (typeof revision !== 'string' || !/^[a-f0-9]{40}$/.test(revision) || /^0+$/.test(revision)) throw new Error('Evaluation ratchet requires a nonzero event base commit SHA.');
    return revision;
}

/** Read Git's base, not the working copy: editing the JSON cannot enlarge its permitted population. */
export function evaluationCoverageBaseline(root: string): Record<string, unknown> {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 30_000 }).trim();
    const eventBase = process.env.GITHUB_EVENT_PATH
        ? evaluationBaseRevision(process.env.GITHUB_EVENT_NAME ?? '', JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')))
        : undefined;
    const base = eventBase ?? git('merge-base', 'HEAD', 'origin/main');
    if (eventBase) {
        // actions/checkout defaults to one commit. Fetch only the event's exact base when absent.
        try { execFileSync('git', ['cat-file', '-e', `${base}^{commit}`], { cwd: root, stdio: 'pipe', timeout: 10_000 }); }
        catch { git('fetch', '--no-tags', '--depth=1', 'origin', base); }
    }
    const paths = git('ls-tree', '-r', '--name-only', base, '--', 'Evaluations', '.cratis/ai/skills').split('\n');
    if (paths.includes('Evaluations/unevaluated.json')) return JSON.parse(git('show', `${base}:Evaluations/unevaluated.json`)) as Record<string, unknown>;
    // First rollout: only pre-existing, unevaluated base skills may enter the baseline.
    const skills = paths.flatMap(path => /^\.cratis\/ai\/skills\/([^/]+)\/SKILL\.md$/.exec(path)?.[1] ?? []);
    return Object.fromEntries(skills.filter(name => !paths.includes(`Evaluations/skills/${name}/trigger.json`) || !paths.includes(`Evaluations/skills/${name}/evals.json`))
        .map(name => [name, 'Existing skill without evaluation inputs at the base revision.']));
}
