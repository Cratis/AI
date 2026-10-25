// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Harness } from './Harness.ts';
import type { Options } from './Options.ts';

export function parseOptions(arguments_: string[]): Options {
    const [command, ...argumentsRest] = arguments_;
    if (!['trigger', 'outputs', 'grade', 'report'].includes(command)) throw new Error('Usage: evaluate trigger|outputs|grade|report [--skill NAME ...] [--harness pi|claude] [--run DIR]');
    const values = new Map<string, string>();
    const skills: string[] = [];
    const allowed = ['skill', 'harness', 'model', 'thinking', 'runs', 'concurrency', 'timeout', 'listing-budget', 'limit', 'run', 'grader-model'];
    for (let index = 0; index < argumentsRest.length; index++) {
        const flag = argumentsRest[index];
        const value = argumentsRest[++index];
        if (!flag.startsWith('--') || !allowed.includes(flag.slice(2)) || !value || value.startsWith('--')) throw new Error(`Invalid option: ${flag}`);
        if (flag === '--skill') skills.push(value);
        else if (values.has(flag.slice(2))) throw new Error(`Repeated option: ${flag}`);
        else values.set(flag.slice(2), value);
    }
    const harness = values.get('harness') ?? Harness.Pi;
    if (harness !== Harness.Pi && harness !== Harness.Claude) throw new Error('--harness must be pi or claude');
    const integer = (flag: string, fallback: number, maximum: number) => {
        const value = Number(values.get(flag) ?? fallback);
        if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`--${flag} must be an integer from 1 to ${maximum}`);
        return value;
    };
    if (skills.some(skill => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill)) || new Set(skills).size !== skills.length) throw new Error('--skill names must be unique lowercase kebab-case');
    if (['grade', 'report'].includes(command) && !values.has('run')) throw new Error(`${command} requires --run DIR`);
    return {
        command: command as Options['command'], skills, harness,
        model: values.get('model') ?? (harness === Harness.Pi ? 'openai-codex/gpt-6.1-sol' : 'sonnet'),
        thinking: values.get('thinking') ?? 'medium', runs: integer('runs', command === 'trigger' ? 3 : 1, 20),
        concurrency: integer('concurrency', 4, 16), timeout: integer('timeout', 240, 600),
        listingBudget: values.has('listing-budget') ? integer('listing-budget', 60000, 1000000) : undefined,
        limit: values.has('limit') ? integer('limit', 2, 1000) : undefined,
        runDirectory: values.get('run'), graderModel: values.get('grader-model') ?? 'opus',
    };
}
