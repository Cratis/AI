// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { appendFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

export async function readLines<T>(path: string): Promise<T[]> {
    let content: string;
    try { content = await readFile(path, 'utf8'); } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
    }
    return content.split('\n').filter(line => line.trim()).map((line, index) => {
        try { return JSON.parse(line) as T; } catch { throw new Error(`${path}:${index + 1}: invalid JSONL; preserve and repair the interrupted line before resuming.`); }
    });
}

export function appendLine(path: string, value: unknown): void {
    // A synchronous append keeps concurrent workers from interleaving result lines.
    appendFileSync(path, JSON.stringify(value) + '\n');
}

export function uniqueByKey<T extends { key: string }>(rows: T[]): T[] {
    return [...new Map(rows.map(row => [row.key, row])).values()];
}

export function pendingTasks<T extends { key: string }>(tasks: T[], completed: Array<{ key: string }>): T[] {
    const keys = new Set(completed.map(result => result.key));
    return tasks.filter(task => !keys.has(task.key));
}

/** Fail-fast scheduling: finish already-running children, but start no more paid calls after a failure. */
export async function concurrent<T>(tasks: T[], concurrency: number, work: (task: T) => Promise<void>): Promise<void> {
    let index = 0;
    let failure: unknown;
    await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
        while (index < tasks.length && !failure) {
            const task = tasks[index++];
            try { await work(task); } catch (error) { failure ??= error; }
        }
    }));
    if (failure) throw failure;
}
