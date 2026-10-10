// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { spawn } from 'node:child_process';
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

try {
    const { values } = parseArgs({ options: { root: { type: 'string' }, contract: { type: 'string' }, version: { type: 'string' } } });
    const repository = process.env.GITHUB_REPOSITORY;
    if (!values.root || !values.contract || !values.version || !repository) throw new Error('--root, --contract, --version and GITHUB_REPOSITORY are required.');
    // Re-run the same offline checker, not a caller-provided passed flag or a stale report file.
    const result = await verifyContract(values.root, values.contract);
    console.log(summary(result));
    console.log(JSON.stringify(result, null, 2));
    await syncIssue(github, repository, values.version, result);
    process.exitCode = result.problems.length ? 1 : 0;
} catch (error) {
    console.error(`Screenplay sync could not run: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
}
