// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { cp, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** No model/opt-in hints: the baseline must not be handed the lifecycle answers. */
export async function workspace(skillsDirectory?: string, parent = tmpdir()): Promise<{ path: string; remove: () => Promise<void> }> {
    const path = await mkdtemp(join(parent, 'cratis-skill-evaluation-'));
    try {
        await writeFile(join(path, 'README.md'), '# Harbor Rentals\n\nA boat-rental application using Cratis Arc and Chronicle on a C# backend, MongoDB read models, and a React frontend. Features include boats, bookings, customers, and payments.\n');
        if (skillsDirectory) {
            await mkdir(join(path, '.claude'));
            await cp(skillsDirectory, join(path, '.claude', 'skills'), { recursive: true, dereference: true });
        }
        return { path, remove: () => rm(path, { recursive: true }) };
    } catch (error) {
        await rm(path, { recursive: true });
        throw error;
    }
}
