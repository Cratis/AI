// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { compareProduct, driftExitCode, driftReport, driftTable } from './product-drift.ts';
import { github, latestProduct } from './product-github.ts';
import { loadProductSync, productSyncProblems, type ProductLedger } from './product-sync.ts';
import { productSyncSelfTest } from './product-sync-self-test.ts';

try {
    const { values } = parseArgs({ options: { json: { type: 'boolean' }, root: { type: 'string' }, 'self-test': { type: 'boolean' } } });
    const root = resolve(values.root ?? resolve(import.meta.dirname, '../..'));
    const { document, sources } = await loadProductSync(root);
    const validation = productSyncProblems(document, sources);
    if (validation.problems.length) throw new Error(validation.problems.join('\n'));
    const ledger = document as ProductLedger;
    if (values['self-test']) {
        console.log(`Product drift self-test: ${productSyncSelfTest()} planted violations detected.`);
    } else {
        const report = driftReport(ledger.products.map(product => compareProduct(product, latestProduct(product, github))));
        console.log(values.json ? JSON.stringify(report, null, 2) : driftTable(report));
        process.exitCode = driftExitCode(report);
    }
} catch (error) {
    console.error(`Product drift could not run: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
}
