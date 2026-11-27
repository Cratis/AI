// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import type { Options } from './Options.ts';
import type { Manifest } from './Manifest.ts';
import type { Result } from './Result.ts';
import type { Grade } from './Grade.ts';
import type { Task } from './Task.ts';
import { executeTrial } from './batch-trial.ts';
import type { TrialExecution } from './batch-trial.ts';
import { corpusPaths } from './corpus.ts';
import { report } from './report.ts';
import { docker } from './suite-sandbox.ts';
import { workspace } from './workspace.ts';
import { appendLine, concurrent, pendingTasks, readLines } from './storage.ts';
import { tasks } from './tasks.ts';
import { isolateBatch } from './isolation.ts';
import { withRunLock } from './locking.ts';

export function invocationDirectory(root: string, environment = process.env, cwd = process.cwd()): string {
    const original = environment.INIT_CWD ?? cwd;
    // Yarn 4's workspace dispatcher replaces INIT_CWD with the workspace cwd. PROJECT_CWD
    // identifies that case; run directories remain repository-root-relative, not package-relative.
    if (environment.PROJECT_CWD && original === cwd && cwd === join(root, 'Source/SkillEvaluation')) return root;
    return original;
}

export function runPath(root: string, directory: string, originalDirectory = invocationDirectory(root)): string {
    const parent = join(root, '.ai-work/skill-evaluations');
    let path = resolve(originalDirectory, directory);
    try { path = realpathSync(path); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const child = relative(parent, path);
    if (!child || child.startsWith('..') || child.includes('..') || child.startsWith('/')) throw new Error(`Run directory ${path} (resolved from ${originalDirectory}) must be inside ${parent}`);
    return path;
}

type Isolated = Awaited<ReturnType<typeof isolateBatch>>;

export async function runBatch(root: string, options: Options, print = console.log): Promise<string | undefined> {
    const selected = await tasks(root, options);
    if (options.dryRun) {
        print(plannedMatrix(options, selected));
        return;
    }
    const image = options.corpus === 'v2' ? await fixtureImage() : undefined;
    const isolate = (version: Options['corpus']) => isolateBatch(corpusPaths(root, version).skills, options.harness, process.env, image !== undefined);
    const isolated = await isolate(options.corpus);
    let comparison: Isolated | undefined;
    try {
        if (options.compare) comparison = await isolate(options.compare);
        const execution = { root, options, isolated, image };
        const manifest = batchManifest(execution, selected, comparison);
        return await runIsolatedBatch(execution, manifest, comparison);
    } finally {
        try { await comparison?.remove(); } finally { await isolated.remove(); }
    }
}

async function fixtureImage(): Promise<string> {
    const image = await docker(['image', 'inspect', '--format', '{{.Id}}', 'cratis-corpus-v2:fixture']);
    if (!/^sha256:[a-f0-9]{64}$/.test(image)) throw new Error('The corpus fixture image has no usable digest.');
    return image;
}

function armOf(task: Task): string { return task.arm ?? (task.withSkills ? 'v1' : 'none'); }

function plannedMatrix(options: Options, tasks: Task[]): string {
    const models = options.models ?? [options.model];
    const conditions = [...new Set(tasks.map(armOf))];
    const rows = models.map(model => {
        const selected = tasks.filter(task => (task.model ?? options.model) === model);
        const cells = conditions.map(condition => selected.filter(task => armOf(task) === condition).length);
        return `| ${model.replaceAll('|', '\\|')} | ${cells.join(' | ')} | ${selected.length} |`;
    });
    return [`Dry run: ${options.command}; ${new Set(tasks.map(task => task.skill)).size} skills; ${tasks.length} planned trials (0 model calls).`, '',
        `| Model | ${conditions.join(' | ')} | Total |`, `|---|${conditions.map(() => '---|').join('')}---|`, ...rows].join('\n');
}

function batchManifest({ options, isolated, image }: TrialExecution, selected: Task[], comparison?: Isolated): Manifest {
    return { version: 1, options: { ...options, runDirectory: undefined, corpus: options.corpus === 'v2' ? 'v2' : undefined },
        tasks: selected, corpusDigest: isolated.digest, corpusCondition: 'skills-with-dependencies',
        comparisonDigest: comparison?.digest, sandboxImage: image };
}

async function runIsolatedBatch(execution: TrialExecution, manifest: Manifest, comparison?: Isolated): Promise<string> {
    const { root, options, isolated } = execution;
    const directory = options.runDirectory ? runPath(root, options.runDirectory) : join(root, '.ai-work/skill-evaluations',
        `${new Date().toISOString().replaceAll(':', '-')}-${options.command}-${randomUUID().slice(0, 8)}`);
    await mkdir(directory, { recursive: true });
    return withRunLock(directory, async () => {
        const manifestPath = join(directory, 'manifest.json');
        if (options.runDirectory) {
            const existing = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
            if (JSON.stringify(existing) !== JSON.stringify(manifest)) throw new Error('Resume options, evaluations or corpus revision differ; use a new run directory.');
        } else await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
        await mkdir(join(directory, 'raw'), { recursive: true });
        const resultsPath = join(directory, 'results.jsonl');
        const pending = pendingTasks(manifest.tasks, await readLines<Result>(resultsPath));
        console.log(`Run: ${directory}\n${pending.length}/${manifest.tasks.length} calls pending; ${options.harness}/${options.models?.join(',') ?? options.model}, concurrency ${options.concurrency}`);
        try {
            await concurrent(pending, options.concurrency, task => {
                const corpus = task.arm === 'v1' ? comparison ?? isolated : isolated;
                return recordTrial({ ...execution, isolated: corpus }, directory, manifest, task);
            });
        } finally { await writeSummary(directory, manifest); }
        return directory;
    });
}

async function recordTrial(execution: TrialExecution, directory: string, manifest: Manifest, task: Task): Promise<void> {
    const transcriptPath = join(directory, 'raw', `${task.key}.jsonl`);
    try {
        const result = await executeTrial(execution, task, transcriptPath);
        const transcript = result.transcript;
        if (manifest.options.command === 'outputs' && !transcript.text.trim()) throw new Error(`No answer text: ${transcriptPath}`);
        appendLine(join(directory, 'results.jsonl'), { ...task, corpusCondition: task.withSkills ? manifest.corpusCondition : 'none',
            skillsRead: [...transcript.skillsRead], listedSkills: transcript.listedSkills,
            confirmedSkills: [...transcript.skillsRead], attemptedSkills: [...transcript.attemptedSkills],
            text: transcript.text, usage: transcript.usage, toolCalls: transcript.seenCalls.size, durationSeconds: result.durationSeconds,
            stopped: result.stopped, transcript: relative(directory, transcriptPath) } satisfies Result);
        console.log(`${task.key}: ${result.stopped ?? 'complete'}; skills: ${[...transcript.skillsRead].join(', ') || 'none'}`);
    } catch (error) {
        appendLine(join(directory, 'errors.jsonl'), { key: task.key, error: String(error), transcript: relative(directory, transcriptPath) });
        throw error;
    }
}

export async function writeSummary(directory: string, manifest: Manifest): Promise<string> {
    const results = await readLines<Result>(join(directory, 'results.jsonl'));
    const grades = await readLines<Grade>(join(directory, 'grades.jsonl'));
    const summary = report(manifest, results, grades);
    await writeFile(join(directory, 'summary.md'), summary);
    return summary;
}
