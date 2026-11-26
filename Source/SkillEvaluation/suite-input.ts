// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { parseArgs } from 'node:util';
import type { Arm, Suite, SuiteOptions, Trial } from './Suite.ts';
export { validateSuite } from './suite-validation.ts';

function selectedArms(value: string): Arm[] {
    const arms = value.split(',') as Arm[];
    if (arms.some(arm => !['v1', 'v2', 'none'].includes(arm))) throw new Error('Arms must be a selection of v1,v2,none');
    if (new Set(arms).size !== arms.length) throw new Error('Arms must be unique');
    return arms;
}

function validateHarness(harness: string, thinking: string): void {
    if (harness !== 'pi') throw new Error('The suite requires Pi');
    if (thinking !== 'medium') throw new Error('The suite requires medium thinking');
}

function selectedModels(model: string | undefined, list: string | undefined): string[] {
    if (model !== undefined && list !== undefined) throw new Error('Use either --model or --models, not both');
    const models = list === undefined ? [model ?? 'openai-codex/gpt-6.2-sol'] : list.split(',').map(identity => identity.trim());
    if (models.some(identity => !/^[^\s/,]+(?:\/[^\s/,]+)+$/.test(identity))) throw new Error('Use a provider/model identity');
    if (new Set(models).size !== models.length) throw new Error('Models must be unique');
    return models;
}

function validatePilot(pilot: boolean | undefined, runs: string | undefined): void {
    const requestedRuns = runs || '1';
    if (!pilot) return;
    if (requestedRuns !== '1') throw new Error('Pilot has exactly one repetition');
}

function integer(value: string | undefined, fallback: number, maximum: number): number {
    const number = Number(value ?? fallback);
    const inRange = number >= 1 && number <= maximum;
    if (!(Number.isSafeInteger(number) && inRange)) throw new Error(`Expected integer 1..${maximum}: ${value}`);
    return number;
}

export function suiteOptions(args: string[]): SuiteOptions & { models: string[] } {
    const { values } = parseArgs({ args, options: {
        suite: { type: 'string', default: 'Evaluations/corpus-v2/tasks/suite.json' },
        arms: { type: 'string', default: 'v1,v2,none' }, runs: { type: 'string' }, concurrency: { type: 'string' },
        seed: { type: 'string' }, model: { type: 'string' }, models: { type: 'string' },
        thinking: { type: 'string', default: 'medium' }, harness: { type: 'string', default: 'pi' },
        'dry-run': { type: 'boolean' }, pilot: { type: 'boolean' }, task: { type: 'string' }, run: { type: 'string' },
        image: { type: 'string', default: 'cratis-corpus-v2:fixture' },
    } });
    validateHarness(values.harness!, values.thinking!);
    const models = selectedModels(values.model, values.models);
    validatePilot(values.pilot, values.runs);
    return { suite: values.suite!, arms: selectedArms(values.arms!), runs: integer(values.runs, values.pilot ? 1 : 3, 20), concurrency: integer(values.concurrency, 2, 8),
        seed: integer(values.seed, 1349, 2147483647), model: models[0], models, thinking: 'medium', dryRun: Boolean(values['dry-run']),
        pilot: Boolean(values.pilot), task: values.task, runDirectory: values.run, image: values.image! };
}

export function random(seed: number): () => number {
    let state = seed >>> 0;
    return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

export function schedule(suite: Suite, options: SuiteOptions): Trial[] {
    const tasks = suite.tasks.filter(task => (!options.pilot || task.pilot) && (!options.task || task.id === options.task));
    if (!tasks.length) throw new Error('No tasks selected');
    const trials = tasks.flatMap(task => options.arms.flatMap(arm => Array.from({ length: options.runs }, (_, index) => ({
        key: `${task.id}:${arm}:${index + 1}`, task: task.id, arm, repetition: index + 1,
    }))));
    const next = random(options.seed);
    for (let index = trials.length - 1; index > 0; index--) {
        const other = Math.floor(next() * (index + 1));
        [trials[index], trials[other]] = [trials[other], trials[index]];
    }
    return trials;
}
