// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

interface Timing { name: string; file: string; milliseconds: number }

/** Formats the slowest leaf tests; exported so the format is specified without running node:test. */
export function slowestReport(timings: Timing[], count = 10): string {
    const slowest = [...timings].sort((a, b) => b.milliseconds - a.milliseconds).slice(0, count);
    const lines = slowest.map((timing, index) => `${String(index + 1).padStart(2)}. ${(timing.milliseconds / 1000).toFixed(2).padStart(7)} s  ${timing.file.replace(/^.*\//, '')}  ${timing.name}`);
    return `\nSlowest ${slowest.length} specs:\n${lines.join('\n')}\n`;
}

/** node:test reporter that prints the ten slowest leaf tests after the run. */
export default async function* slowestReporter(source: AsyncIterable<{ type: string; data: { name?: string; file?: string; nesting?: number; details?: { duration_ms?: number; type?: string } } }>): AsyncGenerator<string> {
    const timings: Timing[] = [];
    for await (const event of source) {
        if ((event.type === 'test:pass' || event.type === 'test:fail') && event.data.details?.type !== 'suite') {
            timings.push({ name: event.data.name ?? '', file: event.data.file ?? '', milliseconds: event.data.details?.duration_ms ?? 0 });
        }
    }
    yield slowestReport(timings);
}
