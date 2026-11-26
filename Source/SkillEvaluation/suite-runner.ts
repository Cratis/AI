// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stageCorpus, stageNone, treeDigest } from '../Verification/corpus-staging.ts';
import { withRunLock } from './locking.ts';
import { appendLine, concurrent, pendingTasks, readLines } from './storage.ts';
import { inputDigest } from './suite-files.ts';
import { suiteOptions, schedule, validateSuite } from './suite-input.ts';
import { renderReport } from './suite-report.ts';
import { docker, phase, startSandbox } from './suite-sandbox.ts';
import { prepareFixture, runTrial } from './suite-trial.ts';
import type { TrialContext } from './suite-trial.ts';
import type { Arm, SuiteOptions, SuiteResult, Trial } from './Suite.ts';
import type { StageMarker } from '../Verification/corpus-staging.ts';

const root = resolve(import.meta.dirname, '../..');

export async function suiteMain(args: string[]): Promise<void> {
    const options = suiteOptions(args);
    const file = resolve(root, options.suite);
    const suite = validateSuite(JSON.parse(await readFile(file, 'utf8')));
    const trials = schedule(suite, options);
    const plan = { trials: trials.length, arms: options.arms, tasks: [...new Set(trials.map(trial => trial.task))].length,
        runs: options.runs, concurrency: options.concurrency, model: options.model, thinking: options.thinking, seed: options.seed,
        tools: 120, turns: 80, trajectoryTimeoutSeconds: [...new Set(suite.tasks.map(task => task.timeoutSeconds))],
        billing: 'subscription; record tokens/time; USD unavailable', schedule: trials };
    console.log(JSON.stringify(plan, null, 2));
    if (options.dryRun) return;
    const output = join(root, '.ai-work/corpus-v2/runs');
    const run = options.runDirectory ? resolve(root, options.runDirectory) : join(output, `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`);
    if (relative(output, run).startsWith('..') || run === output) throw new Error('Run directory must be below .ai-work/corpus-v2/runs');
    await mkdir(run, { recursive: true, mode: 0o700 });
    await withRunLock(run, async () => {
        const context: TrialContext = { root, suiteRoot: dirname(dirname(file)), run, image: await docker(['image', 'inspect', '--format', '{{.Id}}', options.image]),
            suite, options, stages: new Map() };
        await lockInputs(context, plan, options);
        await preflight(context, trials);
        await executeTrials(context, trials);
    });
    console.log(`Run artifacts: ${run}`);
}

async function lockInputs(context: TrialContext, plan: object, options: SuiteOptions): Promise<void> {
    const stages = [];
    for (const arm of options.arms) {
        const path = join(context.run, 'stages', arm);
        const marker = await readOrStage(context.root, path, arm);
        context.stages.set(arm, { path, marker });
        stages.push({ arm, digest: marker.digest, skills: marker.skills });
    }
    await verifyStages(context);
    const execute = promisify(execFile);
    const pi = (await execute('pi', ['--version'])).stdout.trim();
    const commit = (await execute('git', ['rev-parse', 'HEAD'], { cwd: context.root })).stdout.trim();
    const frozen = { schemaVersion: 1, plan, image: context.image, inputs: await inputDigest(context.suiteRoot), stages,
        harness: await inputDigest(join(context.root, 'Source/SkillEvaluation')), commit, pi,
        options: { ...options, runDirectory: undefined }, node: process.version, platform: process.platform };
    await writeLocked(join(context.run, 'lock.json'), frozen);
}

export async function writeLocked(path: string, frozen: object): Promise<void> {
    const serialized = JSON.stringify(frozen, null, 2) + '\n';
    try {
        if (await readFile(path, 'utf8') !== serialized) throw new Error('Locked inputs/options changed; use a new run directory');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        await writeFile(path, serialized, { flag: 'wx' });
    }
}

async function verifyStages(context: TrialContext): Promise<void> {
    for (const [arm, stage] of context.stages) {
        const path = arm === 'none' ? stage.path : join(stage.path, '.cratis/ai');
        if (await treeDigest(path) !== stage.marker.digest) throw new Error(`${arm} stage changed; run is invalid`);
    }
}

async function preflight(context: TrialContext, trials: Trial[]): Promise<void> {
    // Preflight each distinct seed/overlay once, preserving successful checks across resume.
    const receipt = join(context.run, 'preflight.jsonl');
    const checked = new Set((await readLines<{ key: string }>(receipt)).map(row => row.key));
    for (const id of new Set(trials.map(trial => trial.task))) {
        const task = context.suite.tasks.find(task => task.id === id)!;
        const key = `${task.fixture}:${task.overlay ?? ''}`;
        if (checked.has(key)) continue;
        const directory = join(context.run, 'preflight', `${id}-${Date.now()}`);
        await mkdir(directory, { recursive: true });
        const workspace = join(directory, 'workspace');
        await prepareFixture(context, task, workspace);
        const container = await startSandbox(context.image, workspace);
        try {
            const fixture = context.suite.fixtures[task.fixture];
            const build = await phase(container, fixture.build, 'build', directory, 'preflight-build');
            if (build !== 0) throw new Error(`${id}: fixture preflight build failed (${build}); no model calls started`);
            const specs = await phase(container, fixture.specs, 'test', directory, 'preflight-specs');
            if (specs !== 0) throw new Error(`${id}: fixture preflight specs failed (${specs}); no model calls started`);
            appendLine(receipt, { key });
            checked.add(key);
        } finally { await docker(['rm', '-f', container]); }
    }
}

async function readOrStage(root: string, path: string, arm: Arm): Promise<StageMarker> {
    try { return JSON.parse(await readFile(join(path, '.cratis-stage.json'), 'utf8')); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        return arm === 'none' ? stageNone(path) : stageCorpus({ corpus: arm, root, output: path });
    }
}

async function executeTrials(context: TrialContext, trials: Trial[]): Promise<void> {
    const path = join(context.run, 'results.jsonl');
    const rows = await readLines<SuiteResult>(path);
    if (new Set(rows.map(row => row.key)).size !== rows.length) throw new Error('Duplicate result keys; preserve and repair results before resuming');
    if (rows.some(row => !trials.some(trial => trial.key === row.key))) throw new Error('Unknown result keys; preserve and repair results before resuming');
    try {
        await concurrent(pendingTasks(trials, rows), context.options.concurrency, async trial => {
            const row = await runTrial(context, trial);
            appendLine(path, row);
            rows.push(row);
            await verifyStages(context);
            if (row.status !== 'completed') throw new Error(`${row.key}: ${row.status}: ${row.error}; stopped scheduling further model calls`);
        });
    } finally { await writeFile(join(context.run, 'report.md'), renderReport(rows, trials.length)); }
}

export async function suiteReport(directory: string): Promise<void> {
    const run = resolve(root, directory);
    const lock = JSON.parse(await readFile(join(run, 'lock.json'), 'utf8'));
    const rows = await readLines<SuiteResult>(join(run, 'results.jsonl'));
    const report = renderReport(rows, lock.plan.trials);
    await writeFile(join(run, 'report.md'), report);
    console.log(report);
}
