// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import type { DriftReport } from './product-drift.ts';
import { reconcileProductDrift } from './product-drift-issue.ts';
import { github } from './product-github.ts';

try {
    const path = process.argv[2];
    if (!path || !process.env.GITHUB_REPOSITORY) throw new Error('Report path and GITHUB_REPOSITORY are required.');
    reconcileProductDrift(github, process.env.GITHUB_REPOSITORY, JSON.parse(readFileSync(path, 'utf8')) as DriftReport);
} catch (error) {
    console.error(`Product drift issue reconciliation could not run: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
}
