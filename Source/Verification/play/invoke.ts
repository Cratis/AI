// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFile } from 'node:child_process';
import type { Runner } from './Runner.ts';

/** Four workers at most; each tool invocation has its own deadline and output bound. */
export const run: Runner = (tool, arguments_, directory) => new Promise(resolve => {
    execFile(tool, arguments_, { cwd: directory, timeout: 15_000, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024 }, (error, stdout, stderr) => {
        const output = stdout + stderr;
        if (!error) return resolve({ exit: 0, output });
        const exit = typeof error.code === 'number' ? error.code : null;
        resolve({ exit, output, ...(exit === null || error.killed ? { unavailable: error.message } : {}) });
    });
});
