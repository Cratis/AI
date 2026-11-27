// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Harness } from './Harness.ts';
import type { Options } from './Options.ts';

const allowed = new Set(['--skill', '--harness', '--model', '--models', '--corpus', '--compare', '--thinking', '--runs', '--concurrency',
    '--timeout', '--listing-budget', '--limit', '--run', '--grader-model']);
const defaultModels = { [Harness.Pi]: 'openai-codex/gpt-6.1-sol', [Harness.Claude]: 'sonnet' };

function optionValue(flag: string, value: string | undefined): string {
    if (!allowed.has(flag)) throw new Error(`Invalid option: ${flag}`);
    if (!value || value.startsWith('--')) throw new Error(`Invalid option: ${flag}`);
    return value;
}

function readOptions(args: string[]) {
    const values = new Map<string, string>();
    const skills: string[] = [];
    const tokens = args.values();
    for (const flag of tokens) {
        const value = flag === '--dry-run' ? 'true' : optionValue(flag, tokens.next().value);
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
    const validNames = skills.every(skill => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill));
    if (!validNames || new Set(skills).size !== skills.length) throw new Error('--skill names must be unique lowercase kebab-case');
}

function selectedCorpus(values: Map<string, string>): NonNullable<Options['corpus']> {
    const corpus = values.get('corpus') ?? 'v1';
    if (corpus !== 'v1' && corpus !== 'v2') throw new Error('--corpus must be v1 or v2');
    return corpus;
}

function selectedComparison(command: Options['command'], corpus: NonNullable<Options['corpus']>, values: Map<string, string>): Options['compare'] {
    const compare = values.get('compare');
    if (compare === undefined) return undefined;
    const comparesOutputs = command === 'outputs' && corpus === 'v2';
    if (compare !== 'v1' || !comparesOutputs) throw new Error('--compare v1 requires outputs --corpus v2');
    return compare;
}

function selectedModels(values: Map<string, string>): Options['models'] {
    const value = values.get('models');
    if (value === undefined) return undefined;
    if (values.has('model')) throw new Error('Use --model or --models, not both');
    const models = list(value);
    if (models.includes('') || new Set(models).size !== models.length) throw new Error('--models must contain unique, nonempty model names');
    return models;
}

function validateRunOptions(command: Options['command'], values: Map<string, string>): void {
    if (!['grade', 'report'].includes(command)) return;
    if (['corpus', 'models', 'dry-run'].some(flag => values.has(flag))) throw new Error('--corpus, --models and --dry-run require trigger or outputs');
    if (!values.has('run')) throw new Error(`${command} requires --run DIR`);
}

function matrixOptions(command: Options['command'], values: Map<string, string>) {
    const corpus = selectedCorpus(values);
    const compare = selectedComparison(command, corpus, values);
    const models = selectedModels(values);
    validateRunOptions(command, values);
    return { models, corpus, compare, dryRun: values.has('dry-run') || undefined };
}

const integerLimits = { runs: 20, concurrency: 16, timeout: 600, 'listing-budget': 1000000, limit: 1000 };

function executionOptions(command: Options['command'], values: Map<string, string>) {
    const integer = (flag: keyof typeof integerLimits, fallback: number) => {
        const maximum = integerLimits[flag];
        const value = Number(values.get(flag) ?? fallback);
        const inRange = value >= 1 && value <= maximum;
        if (!Number.isInteger(value) || !inRange) throw new Error(`--${flag} must be an integer from 1 to ${maximum}`);
        return value;
    };
    return {
        thinking: values.get('thinking') ?? 'medium', runs: integer('runs', command === 'trigger' ? 3 : 1),
        concurrency: integer('concurrency', 4), timeout: integer('timeout', 240),
        listingBudget: values.has('listing-budget') ? integer('listing-budget', 60000) : undefined,
        limit: values.has('limit') ? integer('limit', 2) : undefined,
        runDirectory: values.get('run'), graderModel: values.get('grader-model') ?? 'opus',
    };
}

function selectedHarness(values: Map<string, string>): Harness {
    const harness = values.get('harness') ?? Harness.Pi;
    if (harness !== Harness.Pi && harness !== Harness.Claude) throw new Error('--harness must be pi or claude');
    return harness;
}

export function parseOptions(arguments_: string[]): Options {
    const [rawCommand, ...args] = arguments_;
    if (!['trigger', 'outputs', 'grade', 'report'].includes(rawCommand)) throw new Error('Usage: evaluate trigger|outputs|grade|report [--skill NAME ...] [--harness pi|claude] [--run DIR]');
    const command = rawCommand as Options['command'];
    const { values, skills } = readOptions(args);
    const harness = selectedHarness(values);
    validateSkills(skills);
    const matrix = matrixOptions(command, values);
    if (matrix.corpus === 'v2' && harness !== Harness.Pi) throw new Error('--corpus v2 requires the sandboxed pi harness');
    return {
        command, skills, harness,
        model: matrix.models?.[0] ?? values.get('model') ?? defaultModels[harness],
        ...executionOptions(command, values), ...matrix,
    };
}
