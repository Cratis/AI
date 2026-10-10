// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { summary, verifyContract } from './index.ts';
import { selfTest } from './self-test.ts';

try {
    const { values } = parseArgs({ options: {
        root: { type: 'string', default: '../..' },
        contract: { type: 'string' },
        'coverage-json': { type: 'string' },
        'report-json': { type: 'string' },
        'self-test': { type: 'boolean' },
    } });
    if (values['self-test']) {
        selfTest();
        console.log('Screenplay contract self-test: detected every planted defect.');
    } else {
        const result = await verifyContract(resolve(values.root), values.contract);
        console.log(summary(result));
        console.log(JSON.stringify(result, null, 2));
        if (values['coverage-json']) await writeFile(values['coverage-json'], JSON.stringify(result.coverage, null, 2) + '\n');
        if (values['report-json']) await writeFile(values['report-json'], JSON.stringify(result, null, 2) + '\n');
        process.exitCode = result.problems.length ? 1 : 0;
    }
} catch (error) {
    console.error(`Screenplay contract could not run: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
}
