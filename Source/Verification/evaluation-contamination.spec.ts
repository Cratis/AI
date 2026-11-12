// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { contaminationProblems, contaminationSummary, evaluationTargets, scanEvaluationContamination } from './evaluation-contamination.ts';

const repositoryCorpus = resolve(dirname(fileURLToPath(import.meta.url)), '../../.cratis/ai');
const target = 'Solo' + 'Crm';

async function temporaryCorpus(files: Record<string, string | Buffer>): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), 'contamination-'));
    for (const [path, content] of Object.entries(files)) {
        await mkdir(dirname(join(directory, path)), { recursive: true });
        await writeFile(join(directory, path), content);
    }
    return directory;
}

async function problemsFor(files: Record<string, string | Buffer>, targets = evaluationTargets): Promise<string[]> {
    const directory = await temporaryCorpus(files);
    try {
        return contaminationProblems(await scanEvaluationContamination(directory, targets));
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}

test('a clean corpus passes', async () => {
    assert.deepEqual(await problemsFor({ 'skills/a/SKILL.md': 'Clean text.', 'skills/a/scripts/run.mjs': 'export {};' }), []);
});

test('a hit in content is reported', async () => {
    const problems = await problemsFor({ 'skills/a/SKILL.md': `The ${target} case.` });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /skills\/a\/SKILL\.md/);
});

test('a hit in a file name is reported', async () => {
    const problems = await problemsFor({ [`skills/a/fixtures/${target.toLowerCase()}-drift/data.txt`]: 'Clean text.' });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /file name/);
});

test('a hit in a source file with an extension other than markdown is reported', async () => {
    const problems = await problemsFor({ 'skills/a/Example.cs': `// ${target}\nclass Example {}` });
    assert.equal(problems.length, 1);
});

test('the spelling with a space or separator is reported', async () => {
    assert.equal((await problemsFor({ 'rules/a.md': 'The solo crm app.' })).length, 1);
    assert.equal((await problemsFor({ 'rules/a.md': 'The solo_crm app and SOLO-CRM.' })).length, 1);
});

test('binary files are not read as text but their names are still checked', async () => {
    const binary = Buffer.concat([Buffer.from([0]), Buffer.from(target)]);
    assert.deepEqual(await problemsFor({ 'skills/a/image.bin': binary }), []);
    assert.equal((await problemsFor({ [`skills/a/${target}.bin`]: binary })).length, 1);
});

test('an empty corpus fails because nothing was checked', async () => {
    const problems = await problemsFor({});
    assert.equal(problems.length, 1);
    assert.match(problems[0], /no files/);
});

test('an empty target list fails because nothing was looked for', async () => {
    const problems = await problemsFor({ 'rules/a.md': 'Clean text.' }, []);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /no targets/);
});

test('the summary reports files, targets and hits', async () => {
    const directory = await temporaryCorpus({ 'rules/a.md': 'Clean text.', 'rules/b.md': `The ${target} app.` });
    try {
        const result = await scanEvaluationContamination(directory, evaluationTargets);
        assert.equal(contaminationSummary(result), `Evaluation contamination: checked 2 files, ${evaluationTargets.length} targets, 1 hits.`);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('the shipped corpus names no evaluation target', async () => {
    const result = await scanEvaluationContamination(repositoryCorpus, evaluationTargets);
    assert.ok(result.files > 0);
    assert.deepEqual(contaminationProblems(result), []);
});
