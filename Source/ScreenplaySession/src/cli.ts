// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { archiveBundle, archiveName, buildBundle, bundleName } from './bundle.ts';
import { pinnedScreenplayVersion, repositoryRoot } from './version.ts';

const { values } = parseArgs({
    options: {
        version: { type: 'string', default: '0.0.0-local' },
        output: { type: 'string', default: join(repositoryRoot, 'Source/ScreenplaySession/dist') },
        commit: { type: 'string' }
    }
});

if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(values.version)) {
    console.error(`--version must be a semantic version, got '${values.version}'.`);
    process.exit(2);
}

const output = resolve(values.output);
const commit = values.commit ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim();
const directory = join(output, bundleName);
const manifest = buildBundle({
    output: directory,
    version: values.version,
    commit,
    screenplayVersion: pinnedScreenplayVersion(),
    license: join(repositoryRoot, 'LICENSE')
});
const checksum = archiveBundle(directory, join(output, archiveName));
console.log(`${bundleName} ${manifest.version}: ${manifest.files.length} files, ${archiveName} sha256 ${checksum}`);
