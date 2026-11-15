// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { access, lstat, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { Harness } from './Harness.ts';
import { isolateBatch } from './isolation.ts';
import { workspace } from './workspace.ts';

async function put(root: string, path: string, content: string): Promise<void> {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
}

test('isolated runs stage only the explicit corpus dependency closure, preserving both path forms', async () => {
    const source = await workspace();
    const corpus = join(source.path, '.cratis/ai');
    try {
        await put(corpus, 'skills/cratis-ci-gates/SKILL.md', '[gates](../../rules/gates.md)\n`.cratis/ai/prompts/review.prompt.md`');
        await put(corpus, 'rules/gates.md', '[verify](../hooks/scripts/verify.sh)\n[cycle](./gates.md)');
        await put(corpus, 'hooks/scripts/verify.sh', 'node ./helper.mjs');
        await put(corpus, 'hooks/scripts/helper.mjs', 'console.log("verify");');
        await put(corpus, 'prompts/review.prompt.md', 'Review using [gates](../rules/gates.md).');
        await put(corpus, 'rules/unrelated.md', 'not a dependency');
        await put(source.path, 'Evaluations/answers.json', 'private answer');
        await put(source.path, 'SYSTEM.md', 'host instructions');
        const isolated = await isolateBatch(join(corpus, 'skills'), Harness.Claude);
        try {
            const skill = join(isolated.skillsDirectory, 'cratis-ci-gates');
            assert.equal(await readFile(resolve(skill, '../../rules/gates.md'), 'utf8'), await readFile(join(corpus, 'rules/gates.md'), 'utf8'));
            for (const file of ['rules/gates.md', 'prompts/review.prompt.md', 'hooks/scripts/verify.sh', 'hooks/scripts/helper.mjs']) {
                const staged = join(isolated.withWorkspace, '.cratis/ai', file);
                assert.equal(await readFile(staged, 'utf8'), await readFile(join(corpus, file), 'utf8'));
                assert.equal((await lstat(staged)).isSymbolicLink(), false);
            }
            for (const file of ['.cratis/ai/rules/unrelated.md', 'Evaluations', 'SYSTEM.md']) {
                await assert.rejects(access(join(isolated.withWorkspace, file)), { code: 'ENOENT' });
            }
            await assert.rejects(access(join(isolated.withoutWorkspace, '.cratis')), { code: 'ENOENT' });
            await assert.rejects(access(join(isolated.withoutWorkspace, '.claude')), { code: 'ENOENT' });
            await put(corpus, 'rules/gates.md', 'changed dependency');
            const changed = await isolateBatch(join(corpus, 'skills'), Harness.Claude);
            try { assert.notEqual(isolated.digest, changed.digest); }
            finally { await changed.remove(); }
            assert.notEqual(await readFile(resolve(skill, '../../rules/gates.md'), 'utf8'), 'changed dependency');
        } finally { await isolated.remove(); }
    } finally { await source.remove(); }
});

test('missing explicit dependencies remain absent without preventing other dependencies from staging', async () => {
    const source = await workspace();
    const corpus = join(source.path, '.cratis/ai');
    try {
        await put(corpus, 'skills/example/SKILL.md', '[missing](../../rules/missing.md)\n[present](../../rules/present.md)');
        await put(corpus, 'rules/present.md', '[missing transitive dependency](../prompts/missing.prompt.md)');
        const isolated = await isolateBatch(join(corpus, 'skills'), Harness.Claude);
        try {
            assert.equal(await readFile(join(isolated.withWorkspace, '.cratis/ai/rules/present.md'), 'utf8'), '[missing transitive dependency](../prompts/missing.prompt.md)');
            await assert.rejects(access(join(isolated.withWorkspace, '.cratis/ai/rules/missing.md')), { code: 'ENOENT' });
            await assert.rejects(access(join(isolated.withWorkspace, '.cratis/ai/prompts')), { code: 'ENOENT' });
        } finally { await isolated.remove(); }
    } finally { await source.remove(); }
});

test('dependency scanning follows symlinked skill directories only within the corpus', async () => {
    const source = await workspace();
    const corpus = join(source.path, '.cratis/ai');
    try {
        await put(corpus, 'skills/example/SKILL.md', '# Example');
        await put(corpus, 'references/guide.md', '[gates](../../../rules/gates.md)');
        await put(corpus, 'rules/gates.md', 'gates');
        await put(corpus, 'rules/private.md', 'not a dependency');
        await put(source.path, 'host/guide.md', '[private](../../../rules/private.md)');
        await symlink(join(corpus, 'references'), join(corpus, 'skills/example/references'));
        await symlink(join(source.path, 'host'), join(corpus, 'skills/example/host'));
        const isolated = await isolateBatch(join(corpus, 'skills'), Harness.Claude);
        try {
            assert.equal(await readFile(join(isolated.withWorkspace, '.cratis/ai/rules/gates.md'), 'utf8'), 'gates');
            assert.equal((await lstat(join(isolated.skillsDirectory, 'example/references'))).isSymbolicLink(), false);
            await assert.rejects(access(join(isolated.withWorkspace, '.cratis/ai/rules/private.md')), { code: 'ENOENT' });
        } finally { await isolated.remove(); }
    } finally { await source.remove(); }
});

test('dependency links cannot expose evaluation data or escape the corpus through symlinks', async () => {
    const source = await workspace();
    const corpus = join(source.path, '.cratis/ai');
    try {
        await put(corpus, 'skills/example/SKILL.md', [
            '[answers](../../../../Evaluations/answers.json)',
            '[internal](../../answers.json)',
            '[external symlink](../../rules/external.md)',
            '[internal symlink](../../rules/internal.md)',
        ].join('\n'));
        await put(source.path, 'Evaluations/answers.json', 'private external answers');
        await put(corpus, 'answers.json', 'private internal answers');
        await mkdir(join(corpus, 'rules'));
        await symlink(join(source.path, 'Evaluations/answers.json'), join(corpus, 'rules/external.md'));
        await symlink(join(corpus, 'answers.json'), join(corpus, 'rules/internal.md'));
        const isolated = await isolateBatch(join(corpus, 'skills'), Harness.Claude);
        try {
            for (const file of ['rules', 'answers.json', 'Evaluations']) {
                await assert.rejects(access(join(isolated.withWorkspace, '.cratis/ai', file)), { code: 'ENOENT' });
            }
            await assert.rejects(access(join(isolated.withWorkspace, 'Evaluations')), { code: 'ENOENT' });
        } finally { await isolated.remove(); }
    } finally { await source.remove(); }
});
