// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { pinnedVersion } from '../play/fences.ts';
import { parseContract } from './check.ts';
import { referenceDirectory } from './index.ts';

function validateVersion(version: string): void {
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error(`Invalid Screenplay version: ${version}. Expected X.Y.Z.`);
}

/** Validate all inputs before updating the three files that define the standalone pin. */
export async function applyPin(root: string, version: string, contractJson: string): Promise<void> {
    validateVersion(version);
    parseContract(JSON.parse(contractJson) as unknown);
    const compatibilityPath = join(root, 'Documentation/compatibility.md');
    const compatibility = await readFile(compatibilityPath, 'utf8');
    pinnedVersion(compatibility); // Refuse a missing row before writing any of the pin files.
    const updated = compatibility.replace(/^(\| Screenplay language, standalone tool and MCP \| \*\*)\d+\.\d+\.\d+(\*\*)/m, (_, prefix: string, suffix: string) => `${prefix}${version}${suffix}`);
    const references = join(root, referenceDirectory);
    // Preserve the published asset byte-for-byte, including indentation and its final newline.
    await writeFile(join(references, 'screenplay-contract.json'), contractJson);
    await writeFile(join(references, 'screenplay-contract.version'), `${version}\n`);
    await writeFile(compatibilityPath, updated);
}

async function downloadContract(version: string): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), 'screenplay-pin-'));
    try {
        const result = spawnSync('gh', ['release', 'download', `v${version}`, '--repo', 'Cratis/Screenplay', '--pattern', 'screenplay-contract.json', '--dir', directory], { encoding: 'utf8' });
        if (result.error) throw result.error;
        if (result.status !== 0) throw new Error(`Screenplay contract download failed (${result.status}): ${result.stderr}`);
        return await readFile(join(directory, 'screenplay-contract.json'), 'utf8');
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}

async function main(): Promise<void> {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { contract: { type: 'string' } } });
    if (positionals.length !== 1) throw new Error('Usage: bump <version> [--contract <path>]');
    const [version] = positionals;
    validateVersion(version);
    const contractJson = values.contract ? await readFile(resolve(values.contract), 'utf8') : await downloadContract(version);
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
    await applyPin(root, version, contractJson);
    console.log(`Pinned standalone Screenplay ${version}. Run yarn workspace @cratis/ai-verification run tool:screenplay, then yarn workspace @cratis/ai-verification run verify and yarn workspace @cratis/ai-verification run test.`);
    console.log('If verification flags them, review pin-restatement-exceptions.json and screenplay-contract-exceptions.json.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        await main();
    } catch (error) {
        console.error(`Screenplay pin could not be updated: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 2;
    }
}
