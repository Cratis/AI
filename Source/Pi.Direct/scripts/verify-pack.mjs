// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from 'node:child_process';

const output = execFileSync('yarn', ['pack', '--dry-run', '--json'], { encoding: 'utf8' });
const files = output
    .split('\n')
    .filter(line => line.trim().startsWith('{'))
    .map(line => JSON.parse(line))
    .filter(entry => typeof entry.location === 'string')
    .map(entry => entry.location);

const failures = [];
if (files.length === 0) failures.push('the pack listing is empty');
for (const required of ['src/index.ts', 'README.md', 'LICENSE']) {
    if (!files.includes(required)) failures.push(`missing ${required}`);
}
const specs = files.filter(file => file.includes('/for_'));
if (specs.length > 0) failures.push(`specs would be published: ${specs.join(', ')}`);

console.log(`pack lists ${files.length} files, ${specs.length} specs`);
if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exit(1);
}
