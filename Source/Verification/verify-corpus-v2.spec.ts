// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { verifyCorpusV2 } from './verify-corpus-v2.ts';

const placeholderRoot = new URL('../../.cratis/ai-v2/', import.meta.url);

async function scaffold(root: string, targets: string[] = [], composes: string[] = []): Promise<void> {
    const corpus = join(root, '.cratis', 'ai-v2');
    await mkdir(corpus, { recursive: true });
    await writeFile(join(corpus, 'manifest.json'), JSON.stringify({ profiles: ['cratis/v2/application'], profileCatalog: 'profile-catalog.json' }));
    await writeFile(join(corpus, 'profile-catalog.json'), JSON.stringify({ publicProfiles: [{ id: 'cratis/v2/application', composes, availableTargets: targets }] }));
}

async function addSkill(root: string, name: string, description: string): Promise<void> {
    const directory = join(root, '.cratis', 'ai-v2', 'skills', name);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\nBody.\n`);
}

describe('verify corpus v2', () => {
    let root: string;
    beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'verify-v2-')); });
    afterEach(async () => { await rm(root, { recursive: true, force: true }); });

    it('should fail when the corpus directory is missing', async () => {
        const report = await verifyCorpusV2(root);
        assert.match(report.failures[0], /\.cratis\/ai-v2 is missing/);
    });

    it('should report a corpus without skills as a clean, explicit empty result', async () => {
        await scaffold(root);
        const report = await verifyCorpusV2(root);
        assert.deepEqual(report.failures, []);
        assert.equal(report.skills, 0);
        assert.ok(report.lines.some(line => line.includes('no skills yet')));
    });

    it('should accept the committed placeholder manifest and catalog', async () => {
        const manifest = JSON.parse(await readFile(new URL('manifest.json', placeholderRoot), 'utf8'));
        assert.equal(manifest.profileCatalog, 'profile-catalog.json');
        const catalog = JSON.parse(await readFile(new URL('profile-catalog.json', placeholderRoot), 'utf8'));
        assert.deepEqual(manifest.profiles, catalog.publicProfiles.map((profile: { id: string }) => profile.id));
    });

    it('should reject a skill with no evaluation inputs', async () => {
        await scaffold(root, ['v2-demo']);
        await addSkill(root, 'v2-demo', 'Use when adding a demo; not for other work.');
        const report = await verifyCorpusV2(root);
        assert.ok(report.failures.some(failure => failure.includes("'v2-demo' needs trigger.json and evals.json")), report.failures.join('\n'));
    });

    it('should reject a skill no profile reaches and a profile that composes v1', async () => {
        await scaffold(root, [], ['cratis/application']);
        await addSkill(root, 'v2-demo', 'Use when adding a demo; not for other work.');
        const failures = (await verifyCorpusV2(root)).failures.join('\n');
        assert.match(failures, /Skill 'v2-demo' is not reachable from any profile/);
        assert.match(failures, /composes 'cratis\/application', which is not a v2 profile/);
    });

    it('should reject a skill whose name does not match its directory', async () => {
        await scaffold(root, ['v2-demo']);
        await addSkill(root, 'v2-demo', 'Use when adding a demo; not for other work.');
        const file = join(root, '.cratis', 'ai-v2', 'skills', 'v2-demo', 'SKILL.md');
        await writeFile(file, (await readFile(file, 'utf8')).replace('name: v2-demo', 'name: v2-other'));
        assert.ok((await verifyCorpusV2(root)).failures.some(failure => failure.includes('name must match its directory')));
    });

    it('should reject shipped content that names a blind-evaluation application', async () => {
        await scaffold(root, ['v2-demo']);
        await addSkill(root, 'v2-demo', 'Use when adding a demo; not for other work.');
        await writeFile(join(root, '.cratis', 'ai-v2', 'skills', 'v2-demo', 'notes.md'), 'See SoloCrm.\n');
        assert.ok((await verifyCorpusV2(root)).failures.some(failure => failure.includes('names evaluation target SoloCrm')));
    });
});
