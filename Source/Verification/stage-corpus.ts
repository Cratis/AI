// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageCorpus, stageNone, type CorpusName } from './corpus-staging.ts';

/** `stage-corpus --corpus v1|v2|none --output <dir> [--profile <id>] [--root <repo>]` */
export async function main(argv: string[], log: (line: string) => void = console.log): Promise<number> {
    const values = new Map<string, string>();
    for (let index = 0; index < argv.length; index += 2) {
        const flag = argv[index];
        const value = argv[index + 1];
        if (!['--corpus', '--output', '--profile', '--root'].includes(flag) || !value || value.startsWith('--')) {
            console.error(`Usage: stage-corpus --corpus v1|v2|none --output <dir> [--profile <id>] [--root <repo>]; invalid: ${flag}`);
            return 2;
        }
        values.set(flag.slice(2), value);
    }
    const corpus = values.get('corpus');
    const output = values.get('output');
    if (!output || (corpus !== 'v1' && corpus !== 'v2' && corpus !== 'none')) {
        console.error('Usage: stage-corpus --corpus v1|v2|none --output <dir> [--profile <id>] [--root <repo>]');
        return 2;
    }
    try {
        const marker = corpus === 'none'
            ? await stageNone(output)
            : await stageCorpus({ corpus: corpus as CorpusName, root: resolve(values.get('root') ?? '../..'), output, profile: values.get('profile') });
        log(`Staged ${marker.corpus} at ${resolve(output)}: ${marker.files} files, ${marker.skills.length} skills, digest ${marker.digest}.`);
        return 0;
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        return 1;
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
