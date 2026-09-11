// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(root, '..', '..');
const output = join(root, 'package');

rmSync(output, { recursive: true, force: true });
if (process.argv.includes('--clean')) process.exit(0);

const catalogSource = join(repositoryRoot, '.cratis', 'ai', 'profile-catalog.json');
const catalog = JSON.parse(readFileSync(catalogSource, 'utf8'));
const profiles = [...catalog.publicProfiles, ...catalog.engineeringProfiles];
const skillNames = [...new Set(profiles.flatMap(profile => profile.availableTargets ?? []))].sort();
const sourceCorpus = join(repositoryRoot, '.cratis', 'ai');
const targetCorpus = join(output, 'corpus');

mkdirSync(join(targetCorpus, 'skills'), { recursive: true });
for (const directory of ['rules', 'prompts']) {
    cpSync(join(sourceCorpus, directory), join(targetCorpus, directory), { recursive: true });
}
for (const skill of skillNames) {
    const source = join(sourceCorpus, 'skills', skill);
    if (!existsSync(source)) throw new Error(`Profile catalog references missing skill '${skill}'.`);
    cpSync(source, join(targetCorpus, 'skills', skill), { recursive: true });
}
writeFileSync(join(output, 'profile-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Prepared @cratis/pi with ${skillNames.length} skills.`);
