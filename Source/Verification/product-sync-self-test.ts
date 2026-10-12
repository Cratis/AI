// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { compareProduct } from './product-drift.ts';
import { productSyncProblems, type ProductLedger } from './product-sync.ts';

/** Plant one violation per contract, checking the diagnostic as well as the nonzero result. */
export function productSyncSelfTest(): number {
    const ledger: ProductLedger = { schemaVersion: '1.0.0', products: [{
        id: 'arc', name: 'Arc', repository: 'Cratis/Arc', packages: [],
        synced: { version: '1.0.0', date: '2024-01-01', by: 'Cratis/AI#619' },
        covers: { skills: ['cratis-arc-command'], rules: ['csharp.md'] },
    }] };
    const sources = { skills: ['cratis-arc-command'], rules: ['csharp.md'], verifiedSkills: ['cratis-arc-command'] };
    const check = (value: unknown) => productSyncProblems(value, sources, '2024-02-01');
    if (check(ledger).problems.length) throw new Error('Product sync self-test baseline is invalid.');
    const cases: Array<{ plant: (value: ProductLedger) => void; diagnostic: string }> = [
        { plant: value => { Object.assign(value, { schemaVersion: 'wrong' }); }, diagnostic: 'schemaVersion' },
        { plant: value => { value.products = []; }, diagnostic: 'zero products' },
        { plant: value => { value.products.push(structuredClone(value.products[0])); }, diagnostic: 'duplicates id' },
        { plant: value => { value.products.push({ ...structuredClone(value.products[0]), id: 'arc-other' }); }, diagnostic: 'duplicates repository' },
        { plant: value => { value.products[0].covers.skills.push('missing'); }, diagnostic: 'covers missing skill' },
        { plant: value => { value.products[0].covers.rules.push('missing.md'); }, diagnostic: 'covers missing rule' },
        { plant: value => { value.products[0].covers.skills = []; }, diagnostic: 'not covered by any product' },
        { plant: value => { value.products[0].synced!.version = 'v1.0.0'; }, diagnostic: 'invalid synced version' },
        { plant: value => { value.products[0].synced!.date = '2024-02-30'; }, diagnostic: 'non-future synced date' },
        { plant: value => { value.products[0].synced!.date = '2024-03-01'; }, diagnostic: 'non-future synced date' },
    ];
    for (const { plant, diagnostic } of cases) {
        const planted = structuredClone(ledger);
        plant(planted);
        if (!check(planted).problems.some(problem => problem.includes(diagnostic))) throw new Error(`Product sync self-test missed '${diagnostic}'.`);
    }
    if (!compareProduct({ ...ledger.products[0], synced: null }, { version: '1.0.0' }).drift || !compareProduct(ledger.products[0], { version: '2.0.0' }).drift) throw new Error('Product drift self-test missed a planted drift.');
    return cases.length + 2;
}
