// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Resume cannot silently mix skill revisions. Sorted relative filenames and content cover references too. */
export async function corpusDigest(directory: string): Promise<string> {
    const hash = createHash('sha256');
    async function visit(path: string, prefix: string): Promise<void> {
        const entries = (await readdir(path, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name));
        for (const entry of entries) {
            const name = `${prefix}/${entry.name}`;
            if (entry.isDirectory()) await visit(join(path, entry.name), name);
            else if (entry.isFile()) hash.update(name).update('\0').update(await readFile(join(path, entry.name))).update('\0');
        }
    }
    await visit(directory, '');
    return hash.digest('hex');
}
