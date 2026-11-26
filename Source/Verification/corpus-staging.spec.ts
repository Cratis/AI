// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { access, chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { catalogProblems, profileSkills, removeStage, stageCorpus, stageMarkerFile, stageNone, treeDigest } from './corpus-staging.ts';
import { main } from './stage-corpus.ts';

const catalog = (extra: object[] = []) => ({
    publicProfiles: [
        { id: 'cratis/v2/application', composes: ['cratis/v2/arc'], availableTargets: ['v2-platform'] },
        { id: 'cratis/v2/arc', availableTargets: ['v2-arc-command'] },
        ...extra,
    ],
});

async function seed(root: string, directory: string, skills: string[]): Promise<void> {
    const corpus = join(root, directory);
    await mkdir(join(corpus, 'rules'), { recursive: true });
    await writeFile(join(corpus, 'rules', 'general.md'), '# General\n');
    await writeFile(join(corpus, 'manifest.json'), '{}');
    await writeFile(join(corpus, 'profile-catalog.json'), JSON.stringify(directory.endsWith('v2') ? catalog() : { publicProfiles: [{ id: 'cratis', availableTargets: skills }] }));
    for (const skill of skills) {
        await mkdir(join(corpus, 'skills', skill), { recursive: true });
        await writeFile(join(corpus, 'skills', skill, 'SKILL.md'), `---\nname: ${skill}\n---\n`);
    }
}

async function listAll(directory: string): Promise<string[]> {
    return (await readdir(directory, { recursive: true })).sort();
}

describe('corpus staging', () => {
    let temporary: string;
    beforeEach(async () => { temporary = await mkdtemp(join(tmpdir(), 'stage-')); });
    afterEach(async () => {
        await chmod(temporary, 0o755).catch(() => undefined);
        for (const entry of await readdir(temporary, { recursive: true })) await chmod(join(temporary, entry), 0o755).catch(() => undefined);
        await rm(temporary, { recursive: true, force: true });
    });

    it('should stage exactly one corpus and none of the other', async () => {
        await seed(temporary, '.cratis/ai', ['cratis-old']);
        await seed(temporary, '.cratis/ai-v2', ['v2-platform', 'v2-arc-command']);
        const v2 = await stageCorpus({ corpus: 'v2', root: temporary, output: join(temporary, 'stage-v2') });
        const files = await listAll(join(temporary, 'stage-v2'));
        assert.ok(files.includes('.cratis/ai/skills/v2-platform/SKILL.md'));
        assert.equal(files.some(file => file.includes('cratis-old')), false);
        assert.equal(v2.corpus, 'v2');
        const v1 = await stageCorpus({ corpus: 'v1', root: temporary, output: join(temporary, 'stage-v1') });
        assert.equal((await listAll(join(temporary, 'stage-v1'))).some(file => file.includes('v2-')), false);
        assert.deepEqual(v1.skills, ['cratis-old']);
    });

    it('should load no corpus in the none arm', async () => {
        const marker = await stageNone(join(temporary, 'stage-none'));
        assert.deepEqual(await listAll(join(temporary, 'stage-none')), [stageMarkerFile]);
        assert.equal(marker.files, 0);
        assert.deepEqual(marker.skills, []);
        await assert.rejects(access(join(temporary, 'stage-none', '.cratis')));
    });

    it('should freeze the stage so a run cannot edit guidance', async () => {
        await seed(temporary, '.cratis/ai-v2', ['v2-platform', 'v2-arc-command']);
        await stageCorpus({ corpus: 'v2', root: temporary, output: join(temporary, 'stage') });
        await assert.rejects(writeFile(join(temporary, 'stage', '.cratis', 'ai', 'rules', 'general.md'), 'tampered'));
        await assert.rejects(writeFile(join(temporary, 'stage', '.cratis', 'ai', 'extra.md'), 'new'));
    });

    it('should record a digest that detects any change', async () => {
        await seed(temporary, '.cratis/ai-v2', ['v2-platform', 'v2-arc-command']);
        const marker = await stageCorpus({ corpus: 'v2', root: temporary, output: join(temporary, 'stage') });
        assert.equal(await treeDigest(join(temporary, 'stage', '.cratis', 'ai')), marker.digest);
        await chmod(join(temporary, 'stage', '.cratis', 'ai', 'rules'), 0o755);
        await chmod(join(temporary, 'stage', '.cratis', 'ai', 'rules', 'general.md'), 0o644);
        await writeFile(join(temporary, 'stage', '.cratis', 'ai', 'rules', 'general.md'), '# Changed\n');
        assert.notEqual(await treeDigest(join(temporary, 'stage', '.cratis', 'ai')), marker.digest);
    });

    it('should limit skills to the profile closure', async () => {
        await seed(temporary, '.cratis/ai-v2', ['v2-platform', 'v2-arc-command']);
        const marker = await stageCorpus({ corpus: 'v2', root: temporary, output: join(temporary, 'stage'), profile: 'cratis/v2/arc' });
        assert.deepEqual(marker.skills, ['v2-arc-command']);
        assert.deepEqual(profileSkills(catalog().publicProfiles, 'cratis/v2/application', ['v2-platform', 'v2-arc-command']), ['v2-arc-command', 'v2-platform']);
        assert.throws(() => profileSkills(catalog().publicProfiles, 'cratis/v2/nope', []), /Unknown profile/);
    });

    it('should refuse to overwrite or remove a directory that is not a stage', async () => {
        await seed(temporary, '.cratis/ai-v2', ['v2-platform', 'v2-arc-command']);
        await mkdir(join(temporary, 'mine'));
        await writeFile(join(temporary, 'mine', 'notes.txt'), 'keep');
        await assert.rejects(stageCorpus({ corpus: 'v2', root: temporary, output: join(temporary, 'mine') }), /not a corpus stage/);
        await assert.rejects(stageNone(join(temporary, 'mine')), /not a corpus stage/);
        await assert.rejects(removeStage(join(temporary, 'mine')), /not a corpus stage/);
        assert.equal(await readFile(join(temporary, 'mine', 'notes.txt'), 'utf8'), 'keep');
    });

    it('should replace a previous stage and remove it on request', async () => {
        await stageNone(join(temporary, 'stage'));
        await seed(temporary, '.cratis/ai-v2', ['v2-platform', 'v2-arc-command']);
        await stageCorpus({ corpus: 'v2', root: temporary, output: join(temporary, 'stage') });
        assert.ok((await listAll(join(temporary, 'stage'))).includes('.cratis/ai/rules/general.md'));
        await removeStage(join(temporary, 'stage'));
        await assert.rejects(access(join(temporary, 'stage')));
    });

    it('should refuse symbolic links that could reach guidance outside the corpus', async () => {
        await seed(temporary, '.cratis/ai-v2', ['v2-platform', 'v2-arc-command']);
        await symlink(join(temporary, '.cratis', 'ai'), join(temporary, '.cratis', 'ai-v2', 'linked'));
        await assert.rejects(stageCorpus({ corpus: 'v2', root: temporary, output: join(temporary, 'stage') }), /symbolic links/);
    });

    it('should isolate the v2 profile namespace and require reachable skills', () => {
        const manifest = { profiles: ['cratis/v2/application', 'cratis/v2/arc'] };
        assert.deepEqual(catalogProblems('v2', manifest, catalog(), ['v2-platform', 'v2-arc-command']), []);
        assert.match(catalogProblems('v2', manifest, catalog([{ id: 'cratis/v2/x', composes: ['cratis/application'] }]), ['v2-platform', 'v2-arc-command']).join('\n'), /composes 'cratis\/application', which is not a v2 profile/);
        assert.match(catalogProblems('v2', { profiles: ['cratis/v2/application'] }, catalog(), ['v2-platform', 'v2-arc-command']).join('\n'), /missing catalog profile 'cratis\/v2\/arc'/);
        assert.match(catalogProblems('v2', manifest, catalog(), ['v2-platform', 'v2-arc-command', 'v2-orphan']).join('\n'), /'v2-orphan' is not reachable/);
        assert.match(catalogProblems('v2', manifest, catalog(), ['v2-platform']).join('\n'), /missing skill 'v2-arc-command'/);
    });

    it('should expose the staging commands with usage errors and results', async () => {
        const lines: string[] = [];
        assert.equal(await main(['--corpus', 'none', '--output', join(temporary, 'a')], line => lines.push(line)), 0);
        assert.match(lines[0], /Staged none/);
        assert.equal(await main(['--corpus', 'v3', '--output', join(temporary, 'b')]), 2);
        assert.equal(await main(['--bogus', 'x']), 2);
        assert.equal(await main(['--corpus', 'v2', '--output', join(temporary, 'c'), '--root', join(temporary, 'absent')]), 1);
    });
});
