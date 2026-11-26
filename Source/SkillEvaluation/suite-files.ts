// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { cp, lstat, mkdir, readdir, readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

export function inside(root: string, path: string): string {
    const target = resolve(root, path);
    const within = relative(root, target);
    const escaped = within === '..' || within.startsWith('../') || within.startsWith('..\\');
    if (isAbsolute(path) || !within || escaped) throw new Error(`Path escapes root: ${path}`);
    return target;
}

export async function sourceFiles(root: string, prefix = ''): Promise<Map<string, string>> {
    const files = new Map<string, string>();
    for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
        const path = join(prefix, entry.name);
        if (['node_modules', 'bin', 'obj', '.git', 'wwwroot'].includes(entry.name)) continue;
        if (entry.isSymbolicLink()) throw new Error(`Symbolic link refused: ${path}`);
        if (entry.isDirectory()) for (const [name, text] of await sourceFiles(root, path)) files.set(name, text);
        else if (/\.(cs|ts|tsx|play|json|props|targets|config|csproj)$/i.test(path)) files.set(path, await readFile(join(root, path), 'utf8'));
    }
    return files;
}

export async function copyFixture(source: string, destination: string): Promise<void> {
    if (!(await lstat(source)).isDirectory()) throw new Error('Fixture must be a directory');
    await assertNoLinks(source);
    await mkdir(destination, { recursive: true });
    await cp(source, destination, { recursive: true, force: true });
}

async function assertNoLinks(root: string): Promise<void> {
    for (const entry of await readdir(root, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) throw new Error(`Symbolic link refused: ${join(root, entry.name)}`);
        if (entry.isDirectory()) await assertNoLinks(join(root, entry.name));
    }
}

/** Includes every seed/overlay/scorer file, not just source extensions. */
export async function inputDigest(root: string): Promise<string> {
    const hash = createHash('sha256');
    async function visit(path: string): Promise<void> {
        for (const entry of (await readdir(join(root, path), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
            const name = join(path, entry.name);
            if (entry.isSymbolicLink()) throw new Error(`Symbolic link refused: ${name}`);
            if (entry.isDirectory()) await visit(name);
            else hash.update(name).update('\0').update(await readFile(join(root, name))).update('\0');
        }
    }
    await visit('');
    return hash.digest('hex');
}
