// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { Manifest } from './Manifest.ts';
import type { Result } from './Result.ts';
import type { Grade } from './Grade.ts';
import { parseOptions } from './arguments.ts';
import { runBatch, runPath } from './batch.ts';
import { gradeBatch } from './grading.ts';
import { report } from './report.ts';
import { readLines } from './storage.ts';
import { withRunLock } from './locking.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
try {
    const options = parseOptions(process.argv.slice(2));
    if (options.command === 'trigger' || options.command === 'outputs') await runBatch(root, options);
    else {
        const directory = runPath(root, options.runDirectory!);
        if (options.command === 'grade') await gradeBatch(directory, options);
        else await withRunLock(directory, async () => {
            console.log(report(JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')) as Manifest,
                await readLines<Result>(join(directory, 'results.jsonl')), await readLines<Grade>(join(directory, 'grades.jsonl'))));
        });
    }
} catch (error) {
    console.error(String(error));
    process.exitCode = 2;
}
