// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { referenceContentsProblems, withReferenceContents } from './skill-structure.ts';

const root = resolve(import.meta.dirname, '../..');
const skills = join(root, '.cratis', 'ai', 'skills');
const check = process.argv.includes('--check');
const failures: string[] = [];
let changed = 0;

async function referenceFiles(directory: string): Promise<string[]> {
    const paths: string[] = [];
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) paths.push(...await referenceFiles(path));
        else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'SKILL.md') paths.push(path);
    }
    return paths;
}

for (const path of await referenceFiles(skills)) {
    const content = await readFile(path, 'utf8');
    const subject = relative(root, path);
    const problems = referenceContentsProblems(subject, content);
    if (problems.length === 0) continue;
    if (check) {
        failures.push(...problems);
        continue;
    }
    const generated = withReferenceContents(content);
    const remaining = referenceContentsProblems(subject, generated);
    if (remaining.length > 0) {
        failures.push(...remaining);
        continue;
    }
    await writeFile(path, generated, 'utf8');
    changed++;
    console.log(subject);
}
if (failures.length > 0) {
    console.error(JSON.stringify({ passed: false, failures }, null, 2));
    process.exitCode = 1;
} else {
    console.log(JSON.stringify({ passed: true, changed, check }));
}
