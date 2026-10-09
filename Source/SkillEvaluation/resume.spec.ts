// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { parseOptions } from './arguments.ts';
import { invocationDirectory, runPath } from './batch.ts';
import { gradeBatch } from './grading.ts';
import { acquireRunLock, processAlive } from './locking.ts';
import { appendLine, readLines } from './storage.ts';
import { workspace } from './workspace.ts';

const options = parseOptions(['grade', '--run', 'unused']);

test('run paths resolve from the original yarn invocation directory, not its workspace cwd', () => {
    assert.equal(runPath('/repository', '.ai-work/skill-evaluations/run', '/repository'), '/repository/.ai-work/skill-evaluations/run');
    assert.equal(runPath('/repository', './run', '/repository/.ai-work/skill-evaluations'), '/repository/.ai-work/skill-evaluations/run');
    assert.throws(() => runPath('/repository', '../outside', '/repository'));
    assert.equal(invocationDirectory('/repository', { INIT_CWD: '/original' }, '/package'), '/original');
    assert.equal(invocationDirectory('/repository', {}, '/original'), '/original');
    assert.equal(invocationDirectory('/repository', { INIT_CWD: '/repository/Source/SkillEvaluation', PROJECT_CWD: '/repository' }, '/repository/Source/SkillEvaluation'), '/repository');
});

test('existing locks name the owner and live status before reading any manifest', async () => {
    const temporary = await workspace();
    try {
        const release = await acquireRunLock(temporary.path);
        await assert.rejects(gradeBatch(temporary.path, options), new RegExp(`PID ${process.pid} \\(alive\\)`));
        await release();
        await assert.rejects(access(join(temporary.path, '.lock')));
        // Impossible process id: verifies the recovery message without killing anything.
        const deadPid = 2147483647;
        assert.equal(processAlive(deadPid), false);
        await writeFile(join(temporary.path, '.lock'), String(deadPid));
        await assert.rejects(acquireRunLock(temporary.path), /PID 2147483647 \(dead\).*clear it with: rm --/);
    } finally { await temporary.remove(); }
});

test('a second grading invocation after completion reads the new grades under lock and bills no duplicate calls', async () => {
    const temporary = await workspace();
    try {
        const result = { key: 'task-with', assertions: ['assertion'], text: 'answer' };
        await writeFile(join(temporary.path, 'manifest.json'), JSON.stringify({ options: { command: 'outputs' }, tasks: [result] }));
        appendLine(join(temporary.path, 'results.jsonl'), result);
        let calls = 0;
        const fakeGrader = async () => {
            assert.equal(await access(join(temporary.path, '.lock')), undefined);
            calls++;
            return [{ text: 'assertion', passed: true, evidence: 'answer' }];
        };
        await gradeBatch(temporary.path, options, fakeGrader);
        await gradeBatch(temporary.path, options, fakeGrader);
        assert.equal(calls, 1);
        assert.equal((await readLines(join(temporary.path, 'grades.jsonl'))).length, 1);
    } finally { await temporary.remove(); }
});
