// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Harness } from './Harness.ts';
import { harnessCommand, harnessEnvironment, graderCommand } from './commands.ts';
import { parseOptions } from './arguments.ts';
import { parseGrade } from './grading.ts';
import { execute } from './process.ts';
import { appendLine, concurrent, pendingTasks, readLines } from './storage.ts';
import { workspace } from './workspace.ts';

test('commands isolate pi and Claude with the pilot flags and model choices', () => {
    const options = parseOptions(['trigger', '--skill', 'cratis-arc-command']);
    const command = harnessCommand(options, 'query', '/corpus/skills');
    for (const flag of ['--no-context-files', '--no-extensions', '--no-mcp', '--no-session', '--no-skills', '--no-themes', '--no-prompt-templates']) assert.ok(command.includes(flag));
    assert.deepEqual(command.slice(-7), ['--skill', '/corpus/skills', '--model', 'openai-codex/gpt-6.1-sol', '--thinking', 'medium', 'query']);
    assert.ok(!harnessCommand(options, 'query').includes('--skill'));
    const claude = harnessCommand({ ...options, harness: Harness.Claude }, 'query');
    for (const tool of ['Edit', 'Write', 'Bash', 'Agent', 'Task', 'WebSearch', 'WebFetch', 'NotebookEdit']) assert.ok(claude.includes(tool));
    assert.ok(claude.includes('--setting-sources'));
    assert.deepEqual(harnessEnvironment({ PATH: 'path', PI_MODEL: 'wrong', PI_SESSION_ID: 'session', SLASH_COMMAND_TOOL_CHAR_BUDGET: '99' }), { PATH: 'path' });
    assert.equal(harnessEnvironment({}, 60000).SLASH_COMMAND_TOOL_CHAR_BUDGET, '60000');
    assert.deepEqual(graderCommand('prompt', 'opus').slice(-2), ['--tools', '']);
});

test('options enforce bounded concurrency, timeouts, harnesses and skill names', () => {
    assert.equal(parseOptions(['trigger']).runs, 3);
    assert.equal(parseOptions(['outputs', '--harness', 'claude']).model, 'sonnet');
    for (const arguments_ of [['trigger', '--concurrency', '0'], ['trigger', '--timeout', '601'], ['trigger', '--harness', 'other'], ['trigger', '--skill', '../escape'], ['grade'], ['trigger', '--unknown', 'x']]) assert.throws(() => parseOptions(arguments_));
});

test('grading rejects missing assertions and evidence not quoted from the answer', () => {
    const assertion = 'Uses a tuple';
    const grade = (evidence: string) => JSON.stringify({ assertion_results: [{ text: assertion, passed: true, evidence }] });
    assert.equal(parseGrade(grade('a tuple'), [assertion], 'Returns a tuple')[0].passed, true);
    assert.equal(parseGrade(grade(''), [assertion], 'Returns a tuple')[0].passed, false);
    assert.equal(parseGrade(grade('invented'), [assertion], 'Returns a tuple')[0].passed, false);
    assert.throws(() => parseGrade('{"assertion_results":[]}', [assertion], 'answer'));
});

test('resumability skips recorded keys and round-trips JSONL', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'skill-evaluation-spec-'));
    try {
        const path = join(directory, 'results.jsonl');
        appendLine(path, { key: 'completed' });
        const completed = await readLines<{ key: string }>(path);
        assert.deepEqual(pendingTasks([{ key: 'completed' }, { key: 'pending' }], completed), [{ key: 'pending' }]);
        assert.deepEqual(await readLines(join(directory, 'absent.jsonl')), []);
    } finally { await rm(directory, { recursive: true }); }
});

test('concurrency never exceeds the bound and stops scheduling on failure', async () => {
    let active = 0, maximum = 0;
    await concurrent([1, 2, 3, 4], 2, async () => {
        maximum = Math.max(maximum, ++active);
        await new Promise(resolve => setTimeout(resolve, 5));
        active--;
    });
    assert.equal(maximum, 2);
    const visited: number[] = [];
    await assert.rejects(concurrent([1, 2, 3], 1, async task => { visited.push(task); throw new Error('failure'); }));
    assert.deepEqual(visited, [1]);
});

test('workspaces are neutral and removed, including the skills link', async () => {
    const temporary = await workspace('/corpus/skills');
    const content = await readFile(join(temporary.path, 'README.md'), 'utf8');
    assert.match(content, /Cratis Arc and Chronicle/);
    assert.doesNotMatch(content, /code-first|\.play|opted/);
    await temporary.remove();
    await assert.rejects(access(temporary.path));
});

test('silent harness hangs are timed out; missing binaries and nonzero exits are errors', async () => {
    const temporary = await workspace();
    try {
        const path = join(temporary.path, 'raw.jsonl');
        await assert.rejects(execute([process.execPath, '-e', 'setInterval(() => {}, 1000)'], Harness.Pi, temporary.path, {}, path, 0.05), /Timed out/);
        await assert.rejects(execute(['/missing/cratis-evaluation-harness'], Harness.Pi, temporary.path, {}, path, 1), /installed and logged in/);
        await assert.rejects(execute([process.execPath, '-e', 'process.exit(1)'], Harness.Pi, temporary.path, {}, path, 1), /exit 1/);
    } finally { await temporary.remove(); }
});

test('trigger cutoff is deliberate success but output stream must actually complete', async () => {
    const temporary = await workspace();
    try {
        const path = join(temporary.path, 'raw.jsonl');
        const event = { type: 'tool_execution_start', toolCallId: '1', toolName: 'read', args: { path: '/skills/cratis-arc-command/SKILL.md' } };
        const script = `console.log(${JSON.stringify(JSON.stringify(event))}); setInterval(() => {}, 1000);`;
        const result = await execute([process.execPath, '-e', script], Harness.Pi, temporary.path, {}, path, 1, 6);
        assert.equal(result.stopped, 'skill-loaded');
        assert.deepEqual([...result.transcript.skillsRead], ['cratis-arc-command']);
        await assert.rejects(execute([process.execPath, '-e', 'console.log("not a result")'], Harness.Pi, temporary.path, {}, path, 1), /could not complete/);
    } finally { await temporary.remove(); }
});
