// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { spawn } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { Github } from './Github.ts';
import { summary, verifyContract } from './index.ts';
import { syncIssue } from './issue.ts';

const github: Github = (arguments_, input) => new Promise((resolve, reject) => {
    const child = spawn('gh', arguments_, { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    let errors = '';
    child.stdout.setEncoding('utf8').on('data', (data: string) => { output += data; });
    child.stderr.setEncoding('utf8').on('data', (data: string) => { errors += data; });
    child.on('error', reject);
    child.stdin.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output) : reject(new Error(`gh ${arguments_[0]} ${arguments_[1]} exited ${code}: ${errors}`)));
    child.stdin.end(input);
});

/** Drift is advisory; I/O and GitHub failures still reject and fail the sync command. */
export async function reportComparison(version: string, result: Awaited<ReturnType<typeof verifyContract>>, summaryFile = process.env.GITHUB_STEP_SUMMARY, report: (line: string) => void = console.log): Promise<number> {
    if (summaryFile) await appendFile(summaryFile, `${summary(result)}\n`);
    if (result.problems.length) report(`::warning::Screenplay ${version.replace(/[\r\n%]/g, '')} contract drift: ${result.problems.length} findings`);
    return 0;
}

async function main(): Promise<void> {
    const { values } = parseArgs({ options: { root: { type: 'string' }, contract: { type: 'string' }, version: { type: 'string' } } });
    const repository = process.env.GITHUB_REPOSITORY;
    if (!values.root || !values.contract || !values.version || !repository) throw new Error('--root, --contract, --version and GITHUB_REPOSITORY are required.');
    // Re-run the same offline checker, not a caller-provided passed flag or a stale report file.
    const result = await verifyContract(values.root, values.contract);
    console.log(summary(result));
    console.log(JSON.stringify(result, null, 2));
    await syncIssue(github, repository, values.version, result);
    process.exitCode = await reportComparison(values.version, result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        await main();
    } catch (error) {
        console.error(`Screenplay sync could not run: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 2;
    }
}
