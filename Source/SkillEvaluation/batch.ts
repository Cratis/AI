// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Options } from './Options.ts';
import type { Manifest } from './Manifest.ts';
import type { Result } from './Result.ts';
import { harnessCommand, harnessEnvironment } from './commands.ts';
import { execute } from './process.ts';
import { appendLine, concurrent, pendingTasks, readLines } from './storage.ts';
import { tasks } from './tasks.ts';
import { isolateBatch } from './isolation.ts';

export function runPath(root: string, directory: string): string {
    const parent = join(root, '.ai-work/skill-evaluations');
    const path = resolve(directory);
    const child = relative(parent, path);
    if (!child || child.startsWith('..') || child.includes('..') || child.startsWith('/')) throw new Error(`Run directory must be inside ${parent}`);
    return path;
}

export async function runBatch(root: string, options: Options): Promise<string> {
    const selected = await tasks(root, options);
    const isolated = await isolateBatch(join(root, '.cratis/ai/skills'), options.harness);
    try { return await runIsolatedBatch(root, options, selected, isolated); }
    finally { await isolated.remove(); }
}

async function runIsolatedBatch(root: string, options: Options, selected: Manifest['tasks'], isolated: Awaited<ReturnType<typeof isolateBatch>>): Promise<string> {
    const manifest: Manifest = { version: 1, options: { ...options, runDirectory: undefined },
        tasks: selected, corpusDigest: isolated.digest };
    const directory = options.runDirectory ? runPath(root, options.runDirectory) : join(root, '.ai-work/skill-evaluations',
        `${new Date().toISOString().replaceAll(':', '-')}-${options.command}-${randomUUID().slice(0, 8)}`);
    await mkdir(directory, { recursive: true });
    const lock = join(directory, '.lock');
    await writeFile(lock, String(process.pid), { flag: 'wx' });
    try {
        const manifestPath = join(directory, 'manifest.json');
        if (options.runDirectory) {
            const existing = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
            if (JSON.stringify(existing) !== JSON.stringify(manifest)) throw new Error('Resume options, evaluations or corpus revision differ; use a new run directory.');
        } else await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
        await mkdir(join(directory, 'raw'), { recursive: true });
        const resultsPath = join(directory, 'results.jsonl');
        const pending = pendingTasks(manifest.tasks, await readLines<Result>(resultsPath));
        console.log(`Run: ${directory}\n${pending.length}/${manifest.tasks.length} calls pending; ${options.harness}/${options.model}, concurrency ${options.concurrency}`);
        await concurrent(pending, options.concurrency, async task => {
            const transcriptPath = join(directory, 'raw', `${task.key}.jsonl`);
            try {
                const result = await execute(harnessCommand(options, task.prompt, task.withSkills ? isolated.skillsDirectory : undefined),
                    options.harness, task.withSkills ? isolated.withWorkspace : isolated.withoutWorkspace,
                    harnessEnvironment(process.env, options.listingBudget, isolated.agentDirectory), transcriptPath,
                    options.timeout, options.command === 'trigger' ? 6 : undefined,
                    { target: task.skill, corpusSkills: isolated.corpusSkills, withSkills: task.withSkills });
                if (options.command === 'outputs' && !result.transcript.text.trim()) throw new Error(`No answer text: ${transcriptPath}`);
                appendLine(resultsPath, { ...task, skillsRead: [...result.transcript.skillsRead], listedSkills: result.transcript.listedSkills,
                    text: result.transcript.text, usage: result.transcript.usage, durationSeconds: result.durationSeconds,
                    stopped: result.stopped, transcript: relative(directory, transcriptPath) } satisfies Result);
                console.log(`${task.key}: ${result.stopped ?? 'complete'}; skills: ${[...result.transcript.skillsRead].join(', ') || 'none'}`);
            } catch (error) {
                appendLine(join(directory, 'errors.jsonl'), { key: task.key, error: String(error), transcript: relative(directory, transcriptPath) });
                throw error;
            }
        });
        return directory;
    } finally { await unlink(lock); }
}
