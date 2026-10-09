// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { access, lstat, mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import test from 'node:test';
import { Harness } from './Harness.ts';
import { isolateBatch } from './isolation.ts';
import { corpusDigest } from './tasks.ts';
import { workspace } from './workspace.ts';

test('batch copies skills without links and copies only pi authentication, never host prompts or settings', async () => {
    const source = await workspace();
    try {
        const skill = join(source.path, 'skills/cratis-arc-command');
        await mkdir(skill, { recursive: true });
        await writeFile(join(skill, 'SKILL.md'), 'skill body');
        await writeFile(join(source.path, 'reference.md'), 'reference body');
        await symlink(join(source.path, 'reference.md'), join(skill, 'reference.md'));
        const host = join(source.path, 'host');
        await mkdir(host);
        for (const file of ['SYSTEM.md', 'APPEND_SYSTEM.md', 'settings.json', 'auth.json']) await writeFile(join(host, file), `fake ${file}`);
        const isolated = await isolateBatch(join(source.path, 'skills'), Harness.Pi, { PI_CODING_AGENT_DIR: host });
        try {
            assert.equal(relative(source.path, isolated.skillsDirectory).startsWith('..'), true);
            assert.equal((await lstat(join(isolated.skillsDirectory, 'cratis-arc-command/reference.md'))).isSymbolicLink(), false);
            assert.equal(await readFile(join(isolated.skillsDirectory, 'cratis-arc-command/reference.md'), 'utf8'), 'reference body');
            assert.deepEqual(await readdir(isolated.agentDirectory!), ['auth.json']);
            assert.equal((await lstat(join(isolated.agentDirectory!, 'auth.json'))).mode & 0o777, 0o600);
            assert.equal(isolated.digest, await corpusDigest(isolated.skillsDirectory));
            await writeFile(join(skill, 'SKILL.md'), 'changed after snapshot');
            assert.equal(await readFile(join(isolated.skillsDirectory, 'cratis-arc-command/SKILL.md'), 'utf8'), 'skill body');
            await assert.rejects(access(join(isolated.withoutWorkspace, '.claude/skills')));
            await assert.rejects(access(join(isolated.withWorkspace, 'Evaluations')));
        } finally { await isolated.remove(); }
        await assert.rejects(access(isolated.withWorkspace));
        await assert.rejects(access(isolated.agentDirectory!));
    } finally { await source.remove(); }
});
