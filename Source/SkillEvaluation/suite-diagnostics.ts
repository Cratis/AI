// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { SuiteResult, SuiteMetrics } from './Suite.ts';

const average = (values: number[]): string => values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2) : 'N/A';

export function routingDiagnostics(rows: SuiteResult[]): string {
    const groups = new Map<string, SuiteResult[]>();
    for (const row of rows) {
        const key = `${row.arm}/${row.area}`;
        groups.set(key, [...groups.get(key) ?? [], row]);
    }
    const lines = [...groups].map(([key, group]) => {
        const mapped = group.filter(row => row.expectedSkills?.length);
        const recalls = mapped.map(row => row.expectedSkills!.filter(skill => row.confirmedSkills.includes(skill)).length / row.expectedSkills!.length);
        const withReads = mapped.filter(row => row.confirmedSkills.length);
        const precisions = withReads.map(row => row.confirmedSkills.filter(skill => row.expectedSkills!.includes(skill)).length / row.confirmedSkills.length);
        const wrong = mapped.map(row => Number(row.confirmedSkills.some(skill => !row.expectedSkills!.includes(skill))));
        const attempted = group.reduce((sum, row) => sum + row.attemptedSkills.length, 0);
        const confirmed = group.reduce((sum, row) => sum + row.confirmedSkills.length, 0);
        return `| ${key} | ${mapped.length}/${group.length} | ${attempted} | ${confirmed} | ${average(precisions)} | ${average(recalls)} | ${average(wrong)} |`;
    });
    return '\n## Routing\n| Arm/area | Resolved mappings | Attempted reads | Confirmed reads | Precision | Recall | Wrong-neighbor trial rate |\n' +
        '|---|---:|---:|---:|---:|---:|---:|\n' + lines.join('\n') + '\n\nNone and unresolved mappings are N/A. Precision is N/A without confirmed reads; recall is zero when a mapped target was not read.\n';
}

export function usageDiagnostics(rows: SuiteResult[]): string {
    const keys: (keyof SuiteMetrics)[] = ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning', 'turns', 'toolCalls'];
    const groups = new Map<string, SuiteResult[]>();
    for (const row of rows) {
        const key = `${row.arm}/${row.area}`;
        groups.set(key, [...groups.get(key) ?? [], row]);
    }
    const lines = [...groups].map(([name, group]) => {
        const values = keys.map(key => average(group.flatMap(row => row.metrics[key] === null ? [] : [row.metrics[key]!])));
        return `| ${name} | ${values.join(' | ')} |`;
    });
    return '\n## Measured usage means\n| Arm/area | Input | Output | Cache read | Cache write | Reasoning | Turns | Tools |\n' +
        '|---|---:|---:|---:|---:|---:|---:|---:|\n' + lines.join('\n') + '\n';
}
