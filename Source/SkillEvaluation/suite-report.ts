// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Arm, SuiteResult } from './Suite.ts';
import { random } from './suite-input.ts';
import { routingDiagnostics, usageDiagnostics } from './suite-diagnostics.ts';

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
export function variance(values: number[]): number | null {
    const average = mean(values);
    return average === null || values.length < 2 ? null : values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
}

export function summarize(rows: SuiteResult[]) {
    const groups = new Map<string, SuiteResult[]>();
    for (const row of rows) {
        const key = `${row.arm}/${row.area}`;
        groups.set(key, [...groups.get(key) ?? [], row]);
    }
    return [...groups].map(([key, group]) => ({ key, trials: group.length,
        passRate: mean(group.map(row => Number(row.passed)))!,
        qualityVariance: variance(group.map(row => Number(row.passed))),
        seconds: mean(group.map(row => row.durationSeconds)), timeVariance: variance(group.map(row => row.durationSeconds)),
        input: mean(group.flatMap(row => row.metrics.input === null ? [] : [row.metrics.input])),
        output: mean(group.flatMap(row => row.metrics.output === null ? [] : [row.metrics.output])),
        tools: mean(group.map(row => row.metrics.toolCalls)),
        failures: group.filter(row => row.status !== 'completed').length,
    }));
}

/** Bootstrap task clusters, preserving repetitions and pairing within each task. No trial-level pseudo-replication. */
export function pairedInterval(rows: SuiteResult[], baseline: Arm, seed = 1349): { tasks: number; delta: number | null; interval: [number, number] | null } {
    const ids = [...new Set(rows.map(row => row.task))];
    const differences = ids.flatMap(id => {
        const left = rows.filter(row => row.task === id && row.arm === 'v2');
        const right = rows.filter(row => row.task === id && row.arm === baseline);
        const paired = left.filter(row => right.some(other => other.repetition === row.repetition));
        if (!paired.length) return [];
        return [mean(paired.map(row => Number(row.passed) - Number(right.find(other => other.repetition === row.repetition)!.passed)))!];
    });
    if (differences.length < 2) return { tasks: differences.length, delta: mean(differences), interval: null };
    const next = random(seed);
    const samples = Array.from({ length: 2000 }, () => mean(differences.map(() => differences[Math.floor(next() * differences.length)]))!).sort((a, b) => a - b);
    return { tasks: differences.length, delta: mean(differences), interval: [samples[49], samples[1949]] };
}

const display = (value: number | null) => value === null ? 'N/A' : value.toFixed(2);

function repetitionVariance(rows: SuiteResult[]): string {
    const keys = [...new Set(rows.map(row => `${row.arm}/${row.task}`))];
    const lines = keys.map(key => {
        const group = rows.filter(row => `${row.arm}/${row.task}` === key);
        return `| ${key} | ${group.length} | ${display(variance(group.map(row => Number(row.passed))))} | ${display(variance(group.map(row => row.durationSeconds)))} |`;
    });
    return '\n\n## Within-task repetition variance\n| Arm/task | Repetitions | Quality variance | Time variance |\n|---|---:|---:|---:|\n' + lines.join('\n') + '\n';
}

export function renderReport(rows: SuiteResult[], planned: number): string {
    const groups = summarize(rows);
    const table = groups.map(group => `| ${group.key} | ${group.trials} | ${display(group.passRate)} | ${display(group.qualityVariance)} | ${display(group.seconds)} | ${display(group.timeVariance)} | ${display(group.input)} | ${display(group.output)} | ${display(group.tools)} | ${group.failures} |`).join('\n');
    const scopes = ['all', ...new Set(rows.map(row => row.area))];
    const pairs = scopes.flatMap(scope => (['v1', 'none'] as Arm[]).map(arm => {
        const selected = scope === 'all' ? rows : rows.filter(row => row.area === scope);
        const result = pairedInterval(selected, arm);
        return `- ${scope}, v2 − ${arm}: ${result.tasks} paired task clusters; difference ${display(result.delta)}; bootstrap 95% interval ${result.interval?.map(display).join(' … ') ?? 'N/A'}.`;
    })).join('\n');
    const statuses = [...new Set(rows.map(row => row.status))].map(status => `${status}: ${rows.filter(row => row.status === status).length}`).join(', ');
    const idioms = [...new Set(rows.flatMap(row => row.idioms.map(check => check.id)))].map(id => {
        const checks = rows.flatMap(row => row.idioms.filter(check => check.id === id));
        return `- ${id}: ${checks.filter(check => check.passed).length}/${checks.length}`;
    }).join('\n');
    return `# Corpus v2 executable suite\n\nCompleted ${rows.length}/${planned} planned trials. ${statuses}.\n\n` +
        '| Arm/area | Trials | Pass rate | Quality variance | Seconds | Time variance | Input tokens | Output tokens | Tools | Errors |\n' +
        '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n' + table + '\n\n## Paired quality\n' + pairs +
        '\n\n## Idioms\n' + idioms + repetitionVariance(rows) + routingDiagnostics(rows) + usageDiagnostics(rows) + '\n\n## Interpretation\n' +
        'Failures and timeouts remain in denominators; infrastructure errors are separately labelled, not silently excluded. Missing telemetry is N/A, never zero. ' +
        'USD is N/A: subscription providers have no per-token USD billing. Variance is sample variance within arm/area; repetitions are not independent tasks. ' +
        'Bootstrap intervals cluster by task; partial runs may be biased and are inconclusive. No superiority or efficiency claim follows from a smoke or pilot. ' +
        'Source idioms are structured-grep diagnostics, not hidden behavioral proof. Passing requires the fixture build, executable specs and all critical idioms.\n';
}
