// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { open, readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

export interface EvaluationTarget {
    name: string;
    matcher: RegExp;
}

/**
 * The applications blind evaluations run on. Shipped corpus content must never name them or carry their answer data.
 * This list is verification-only: Pi.Plugin packs `.cratis/ai` and never `Source/`. Add an entry when a new blind-evaluation app is chosen.
 */
export const evaluationTargets: EvaluationTarget[] = [
    { name: 'SoloCrm', matcher: /solo[\s_-]?crm/i },
];

export interface ContaminationResult {
    files: number;
    targets: number;
    hits: string[];
}

const binaryProbeBytes = 8192;

async function allFiles(directory: string): Promise<string[]> {
    const discovered: string[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        const kind = entry.isSymbolicLink() ? await stat(path) : entry;
        if (kind.isDirectory()) discovered.push(...await allFiles(path));
        else if (kind.isFile()) discovered.push(path);
    }
    return discovered;
}

async function isBinary(path: string): Promise<boolean> {
    const handle = await open(path, 'r');
    try {
        const probe = Buffer.alloc(binaryProbeBytes);
        const { bytesRead } = await handle.read(probe, 0, binaryProbeBytes, 0);
        return probe.subarray(0, bytesRead).includes(0);
    } finally {
        await handle.close();
    }
}

/** Scans every file under the directory, whatever its extension: names and paths always, content unless the file is binary. */
export async function scanEvaluationContamination(directory: string, targets: EvaluationTarget[]): Promise<ContaminationResult> {
    const paths = await allFiles(directory);
    const hits: string[] = [];
    for (const path of paths) {
        const name = relative(directory, path).replaceAll('\\', '/');
        const text = await isBinary(path) ? '' : await readFile(path, 'utf8');
        for (const target of targets) {
            if (target.matcher.test(name)) hits.push(`${name}: file name names evaluation target ${target.name}.`);
            if (target.matcher.test(text)) hits.push(`${name}: content names evaluation target ${target.name}.`);
        }
    }
    return { files: paths.length, targets: targets.length, hits };
}

export function contaminationSummary(result: ContaminationResult): string {
    return `Evaluation contamination: checked ${result.files} files, ${result.targets} targets, ${result.hits.length} hits.`;
}

/** Fails when nothing was checked, nothing was looked for, or anything was found. */
export function contaminationProblems(result: ContaminationResult): string[] {
    const problems = [...result.hits];
    if (result.files === 0) problems.push('Evaluation contamination scan found no files to check.');
    if (result.targets === 0) problems.push('Evaluation contamination scan has no targets to look for.');
    return problems;
}
