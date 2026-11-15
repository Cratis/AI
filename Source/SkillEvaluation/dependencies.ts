// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { cp, mkdir, readFile, readdir, realpath, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

const dependencyAreas = new Set(['rules', 'prompts', 'hooks']);

async function files(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const paths = await Promise.all(entries.map(entry => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? files(path) : [path];
    }));
    return paths.flat();
}

function inDependencyArea(corpus: string, path: string): boolean {
    return dependencyAreas.has(relative(corpus, path).split(sep)[0]);
}

async function dependency(corpus: string, source: string, reference: string): Promise<string | undefined> {
    const path = reference.startsWith('.cratis/ai/')
        ? resolve(corpus, reference.slice('.cratis/ai/'.length))
        : resolve(dirname(source), reference);
    if (!inDependencyArea(corpus, path)) return undefined;
    try {
        if (!(await stat(path)).isFile()) return undefined;
        // Reject symlinks into evaluations or outside the corpus, even when the link lives in rules.
        return inDependencyArea(await realpath(corpus), await realpath(path)) ? path : undefined;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

async function stageReference(corpus: string, source: string, reference: string, destination: string, visited: Set<string>): Promise<string[]> {
    const path = await dependency(corpus, source, reference);
    if (!path || visited.has(path)) return [];
    visited.add(path);
    const target = join(destination, relative(corpus, path));
    await mkdir(dirname(target), { recursive: true });
    await cp(path, target, { dereference: true });
    return [path];
}

/** Stage only explicitly referenced files in rules, prompts and hooks, including their transitive references. */
export async function stageDependencies(corpusSkills: string, destination: string): Promise<void> {
    const corpus = dirname(corpusSkills);
    const pending = await files(corpusSkills);
    const visited = new Set<string>(pending);
    while (pending.length) {
        const source = pending.pop()!;
        const references = (await readFile(source, 'utf8')).match(/(?:\.{1,2}\/|\.cratis\/ai\/)[^\s`"'<>()[\]#?]+/g) ?? [];
        for (const reference of references) {
            pending.push(...await stageReference(corpus, source, reference, destination, visited));
        }
    }
}
