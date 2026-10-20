// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { comparisonGit, verificationBase } from './git-base.ts';
export { evaluationBaseRevision } from './git-base.ts';
import type { AuthoringFinding } from './AuthoringFinding.ts';

/** A JSON object of skill names to one-line reasons. The comparison baseline comes from the base ref. */
export function evaluationCoverageFindings(skills: string[], evaluated: string[], exemptions: unknown, baseline: unknown): AuthoringFinding[] {
    const file = 'Evaluations/unevaluated.json';
    const findings: AuthoringFinding[] = [];
    const add = (matchedText: string) => findings.push({ file, line: 1, rule: 'eval-coverage-ratchet', matchedText });
    const valid = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
    if (!valid(exemptions) || (baseline !== undefined && !valid(baseline))) { add('Exemptions and baseline must be objects of skill names to reasons.'); return findings; }
    if (skills.length === 0) add('Expected a nonempty corpus skill population.');
    for (const [name, reason] of Object.entries(exemptions)) {
        if (baseline !== undefined && !Object.hasOwn(baseline, name)) add(`'${name}' is a new exemption; the baseline may only shrink.`);
        if (typeof reason !== 'string' || !reason.trim() || /[\r\n]/.test(reason)) add(`'${name}' requires a nonempty one-line reason.`);
        if (!skills.includes(name) || evaluated.includes(name)) add(`Remove stale exemption '${name}'.`);
    }
    for (const skill of skills) {
        if (!evaluated.includes(skill) && !Object.hasOwn(exemptions, skill)) add(`'${skill}' needs trigger.json and evals.json, or its existing baseline exemption.`);
    }
    return findings;
}

/** Read Git's base when available; CI requires it, but installed copies still run static coverage checks. */
export function evaluationCoverageBaseline(root: string): Record<string, unknown> | undefined {
    const git = (...args: string[]) => comparisonGit(root, ...args);
    let base: string;
    try {
        base = verificationBase(root);
    } catch (error) {
        if (process.env.GITHUB_ACTIONS === 'true' || process.env.CI === 'true') {
            throw new Error(`Evaluation coverage base could not resolve in CI: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
        }
        return undefined;
    }
    const paths = git('ls-tree', '-r', '--name-only', base, '--', 'Evaluations', '.cratis/ai/skills').split('\n');
    if (paths.includes('Evaluations/unevaluated.json')) return JSON.parse(git('show', `${base}:Evaluations/unevaluated.json`)) as Record<string, unknown>;
    // First rollout: only pre-existing, unevaluated base skills may enter the baseline.
    const skills = paths.flatMap(path => /^\.cratis\/ai\/skills\/([^/]+)\/SKILL\.md$/.exec(path)?.[1] ?? []);
    return Object.fromEntries(skills.filter(name => !paths.includes(`Evaluations/skills/${name}/trigger.json`) || !paths.includes(`Evaluations/skills/${name}/evals.json`))
        .map(name => [name, 'Existing skill without evaluation inputs at the base revision.']));
}
