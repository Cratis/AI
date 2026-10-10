// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { pinnedVersion } from '../play/fences.ts';
import { check, parseContract, parseExceptions, pinProblems } from './check.ts';

export const referenceDirectory = '.cratis/ai/skills/cratis-screenplay-toolchain/references';

async function markdown(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map(entry => entry.isDirectory() ? markdown(join(directory, entry.name)) : entry.isFile() && entry.name.endsWith('.md') ? [join(directory, entry.name)] : []))).flat();
}

export async function verifyContract(root: string, override?: string) {
    const references = join(root, referenceDirectory);
    const pin = pinnedVersion(await readFile(join(references, 'versions.md'), 'utf8'));
    const version = (await readFile(join(references, 'screenplay-contract.version'), 'utf8')).trim();
    const pinned = parseContract(JSON.parse(await readFile(join(references, 'screenplay-contract.json'), 'utf8')) as unknown);
    const contract = override ? parseContract(JSON.parse(await readFile(resolve(root, override), 'utf8')) as unknown) : pinned;
    const exceptions = parseExceptions(JSON.parse(await readFile(join(references, 'screenplay-contract-exceptions.json'), 'utf8')) as unknown);
    const corpus = join(root, '.cratis/ai');
    const skills = (await readdir(join(corpus, 'skills'), { withFileTypes: true })).filter(entry => entry.isDirectory() && /^cratis-(?:screenplay|stage)-/.test(entry.name));
    const skillFiles = (await Promise.all(skills.map(entry => markdown(join(corpus, 'skills', entry.name))))).flat();
    const agents = (await readdir(join(corpus, 'agents'))).filter(name => /^screenplay-.*\.md$/.test(name)).map(name => join(corpus, 'agents', name));
    const rules = await markdown(join(corpus, 'rules'));
    const documents = await Promise.all([...skillFiles, ...agents, ...rules].sort().map(async path => ({ file: relative(root, path).replaceAll('\\', '/'), content: await readFile(path, 'utf8') })));
    const scoped = documents.filter(document => !document.file.startsWith('.cratis/ai/rules/') || /Screenplay/i.test(document.content));
    const result = check(contract, scoped, exceptions, !override, pinned);
    result.problems.push(...pinProblems(pin, version));
    return { ...result, files: scoped.length, pinnedVersion: version, contractSource: override ?? `${referenceDirectory}/screenplay-contract.json` };
}

export function summary(result: Awaited<ReturnType<typeof verifyContract>>): string {
    return `Screenplay contract: ${result.files} files; checked ${Object.entries(result.counts).map(([kind, count]) => `${kind}=${count}`).join(', ')}; ${result.problems.length} findings, ${result.exempted.length} historical exceptions. Coverage gaps (mentions only): ${Object.entries(result.coverage).map(([kind, values]) => `${kind}=${values.length}`).join(', ')}.`;
}
