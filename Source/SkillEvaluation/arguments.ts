// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Harness } from './Harness.ts';
import type { Options } from './Options.ts';

const allowed = ['skill', 'harness', 'model', 'models', 'corpus', 'compare', 'thinking', 'runs', 'concurrency', 'timeout', 'listing-budget', 'limit', 'run', 'grader-model'];

function optionValue(flag: string, value: string | undefined): string {
    if (!flag.startsWith('--') || !allowed.includes(flag.slice(2))) throw new Error(`Invalid option: ${flag}`);
    if (!value || value.startsWith('--')) throw new Error(`Invalid option: ${flag}`);
    return value;
}

function readOptions(args: string[]) {
    const values = new Map<string, string>();
    const skills: string[] = [];
    for (let index = 0; index < args.length; index++) {
        const flag = args[index];
        if (flag === '--dry-run') {
            setOption(values, flag, 'true');
            continue;
        }
        const value = optionValue(flag, args[++index]);
        if (flag === '--skill') skills.push(...list(value));
        else setOption(values, flag, value);
    }
    return { values, skills };
}

function setOption(values: Map<string, string>, flag: string, value: string): void {
    const key = flag.slice(2);
    if (values.has(key)) throw new Error(`Repeated option: ${flag}`);
    values.set(key, value);
}

function list(value: string): string[] { return value.split(',').map(item => item.trim()); }

function validateSkills(skills: string[]): void {
    if (skills.includes('all') && skills.length > 1) throw new Error('--skill all cannot be combined with other names');
    if (!skills.every(skill => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill))) throw new Error('--skill names must be unique lowercase kebab-case');
    if (new Set(skills).size !== skills.length) throw new Error('--skill names must be unique lowercase kebab-case');
}

function matrixOptions(command: Options['command'], values: Map<string, string>) {
    const corpus = values.get('corpus');
    const compare = values.get('compare');
    const models = values.has('models') ? list(values.get('models')!) : undefined;
    const dryRun = values.has('dry-run') || undefined;
    if (corpus !== undefined && corpus !== 'v1' && corpus !== 'v2') throw new Error('--corpus must be v1 or v2');
    if (compare !== undefined && (compare !== 'v1' || corpus !== 'v2' || command !== 'outputs')) {
        throw new Error('--compare v1 requires outputs --corpus v2');
    }
    if (models) validateModels(models, values);
    if (command === 'grade' || command === 'report') {
        if (corpus || models || dryRun) throw new Error('--corpus, --models and --dry-run require trigger or outputs');
        if (!values.has('run')) throw new Error(`${command} requires --run DIR`);
    }
    return { models, corpus: corpus === 'v2' ? 'v2' as const : 'v1' as const, compare: compare as Options['compare'], dryRun };
}

function validateModels(models: string[], values: Map<string, string>): void {
    if (values.has('model')) throw new Error('Use --model or --models, not both');
    if (models.includes('') || new Set(models).size !== models.length) throw new Error('--models must contain unique, nonempty model names');
}

function executionOptions(command: Options['command'], values: Map<string, string>) {
    const integer = (flag: string, fallback: number, maximum: number) => {
        const value = Number(values.get(flag) ?? fallback);
        if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`--${flag} must be an integer from 1 to ${maximum}`);
        return value;
    };
    return {
        thinking: values.get('thinking') ?? 'medium', runs: integer('runs', command === 'trigger' ? 3 : 1, 20),
        concurrency: integer('concurrency', 4, 16), timeout: integer('timeout', 240, 600),
        listingBudget: values.has('listing-budget') ? integer('listing-budget', 60000, 1000000) : undefined,
        limit: values.has('limit') ? integer('limit', 2, 1000) : undefined,
        runDirectory: values.get('run'), graderModel: values.get('grader-model') ?? 'opus',
    };
}

export function parseOptions(arguments_: string[]): Options {
    const [rawCommand, ...args] = arguments_;
    if (!['trigger', 'outputs', 'grade', 'report'].includes(rawCommand)) throw new Error('Usage: evaluate trigger|outputs|grade|report [--skill NAME ...] [--harness pi|claude] [--run DIR]');
    const command = rawCommand as Options['command'];
    const { values, skills } = readOptions(args);
    const harness = values.get('harness') ?? Harness.Pi;
    if (harness !== Harness.Pi && harness !== Harness.Claude) throw new Error('--harness must be pi or claude');
    validateSkills(skills);
    const matrix = matrixOptions(command, values);
    if (matrix.corpus === 'v2' && harness !== Harness.Pi) throw new Error('--corpus v2 requires the sandboxed pi harness');
    return {
        command, skills, harness,
        model: matrix.models?.[0] ?? values.get('model') ?? (harness === Harness.Pi ? 'openai-codex/gpt-6.1-sol' : 'sonnet'),
        ...executionOptions(command, values), ...matrix,
    };
}
