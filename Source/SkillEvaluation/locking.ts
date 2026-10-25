// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export function processAlive(pid: number): boolean | undefined {
    if (!Number.isSafeInteger(pid) || pid < 1) return undefined;
    try { process.kill(pid, 0); return true; } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
        if ((error as NodeJS.ErrnoException).code === 'EPERM') return true;
        return undefined;
    }
}

/** Never clear a stale lock automatically; it is the user's recovery boundary. */
export async function acquireRunLock(directory: string): Promise<() => Promise<void>> {
    const path = join(directory, '.lock');
    try { await writeFile(path, String(process.pid), { flag: 'wx' }); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        const owner = (await readFile(path, 'utf8')).trim();
        const alive = processAlive(Number(owner));
        const status = alive === true ? 'alive' : alive === false ? 'dead' : 'unknown';
        const recovery = alive === false ? `After confirming no evaluation worker is running, clear it with: rm -- '${path.replaceAll("'", "'\\''")}'` : 'Do not remove this lock while its owner or workers may be running.';
        throw new Error(`Run is locked by PID ${owner} (${status}): ${path}. ${recovery}`);
    }
    return () => unlink(path);
}

export async function withRunLock<T>(directory: string, work: () => Promise<T>): Promise<T> {
    const release = await acquireRunLock(directory);
    try { return await work(); } finally { await release(); }
}
