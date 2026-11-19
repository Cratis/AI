// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, access, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Harness } from './Harness.ts';
import type { Result } from './Result.ts';
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
    assert.equal(claude[claude.indexOf('--tools') + 1], 'Read,Glob,Grep,Skill');
    assert.ok(claude.includes('--strict-mcp-config'));
    assert.ok(graderCommand('prompt', 'opus').includes('--strict-mcp-config'));
    assert.ok(claude.includes('--setting-sources'));
    assert.deepEqual(harnessEnvironment({ PATH: 'path', PI_MODEL: 'wrong', PI_SESSION_ID: 'session', SLASH_COMMAND_TOOL_CHAR_BUDGET: '99' }), { PATH: 'path' });
    assert.equal(harnessEnvironment({}, 60000).SLASH_COMMAND_TOOL_CHAR_BUDGET, '60000');
    assert.deepEqual(harnessEnvironment({ PI_CODING_AGENT_DIR: '/host', PI_MODEL: 'wrong' }, undefined, '/isolated/agent'), { PI_CODING_AGENT_DIR: '/isolated/agent' });
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

test('legacy result files load with absent confirmation fields and retain their original scores', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'skill-legacy-results-'));
    try {
        const path = join(directory, 'results.jsonl');
        const historical: Result = { key: 'legacy', skill: 'cratis-arc-command', index: 0, run: 1, prompt: 'query', withSkills: true,
            shouldTrigger: true, skillsRead: ['cratis-arc-command'], text: '', usage: undefined, durationSeconds: 1,
            stopped: 'skill-loaded', transcript: 'raw/legacy.jsonl' };
        appendLine(path, historical);
        const original = await readFile(path, 'utf8');
        const [loaded] = await readLines<Result>(path);
        assert.equal(loaded.confirmedSkills, undefined);
        assert.equal(loaded.attemptedSkills, undefined);
        assert.deepEqual(loaded.skillsRead, historical.skillsRead);
        assert.equal(loaded.stopped, 'skill-loaded');
        assert.deepEqual(pendingTasks([historical], [loaded]), []);
        assert.equal(await readFile(path, 'utf8'), original);
        appendLine(path, { ...historical, key: 'confirmed', confirmedSkills: [], attemptedSkills: ['cratis-arc-command'] } satisfies Result);
        const [, current] = await readLines<Result>(path);
        assert.deepEqual(current.confirmedSkills, []);
        assert.deepEqual(current.attemptedSkills, ['cratis-arc-command']);
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

test('workspaces are neutral and removed', async () => {
    const temporary = await workspace();
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

for (const harness of [Harness.Pi, Harness.Claude]) {
    test(`${harness} cutoff waits for the confirmed target, including sibling-first recovery`, async () => {
        const temporary = await workspace();
        const expectation = { target: 'cratis-arc-command', corpusSkills: ['cratis-arc-command', 'cratis-chronicle-projection'], withSkills: true };
        try {
            for (const skill of expectation.corpusSkills) {
                const directory = join(temporary.path, 'skills', skill);
                await mkdir(directory, { recursive: true });
                await writeFile(join(directory, 'SKILL.md'), 'Skill content');
            }
            const fixture = JSON.parse(await readFile(new URL(`./fixtures/${harness}.json`, import.meta.url), 'utf8')) as {
                scenarios: Array<{ name: string; confirmed: string[]; events: Record<string, unknown>[] }>;
            };
            const path = join(temporary.path, 'raw.jsonl');
            const init = harness === Harness.Claude ? [{ type: 'system', subtype: 'init', skills: expectation.corpusSkills }] : [];
            for (const name of ['successful target', 'sibling-first then target']) {
                const scenario = fixture.scenarios.find(scenario => scenario.name === name)!;
                const lines = [...init, ...scenario.events].map(event => JSON.stringify(event).replaceAll('/corpus', temporary.path));
                // Separate writes make a premature stop at either start or sibling observable.
                const script = `const lines = ${JSON.stringify(lines)}; let index = 0; setInterval(() => { if (index < lines.length) console.log(lines[index++]); }, 20);`;
                const result = await execute([process.execPath, '-e', script], harness, temporary.path, {}, path, 2, name === 'successful target' ? 1 : 6, expectation);
                assert.equal(result.stopped, 'skill-loaded');
                assert.deepEqual([...result.transcript.skillsRead], scenario.confirmed);
            }
            const start = fixture.scenarios.find(scenario => scenario.name === 'start-only')!;
            const lines = [...init, ...start.events].map(event => JSON.stringify(event).replaceAll('/corpus', temporary.path));
            const hang = `for (const line of ${JSON.stringify(lines)}) console.log(line); setInterval(() => {}, 1000);`;
            await assert.rejects(execute([process.execPath, '-e', hang], harness, temporary.path, {}, path, 0.2, 6, expectation), /Timed out/);
            const incomplete = `for (const line of ${JSON.stringify(lines)}) console.log(line);`;
            await assert.rejects(execute([process.execPath, '-e', incomplete], harness, temporary.path, {}, path, 1, 6, expectation), /could not complete/);
        } finally { await temporary.remove(); }
    });
}

test('a model error remains a failure even after a target confirmation', async () => {
    const temporary = await workspace();
    try {
        const events = [
            { type: 'system', subtype: 'init', skills: ['cratis-arc-command'] },
            { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'target', name: 'Skill', input: { skill: 'cratis-arc-command' } }] } },
            { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'target', content: 'Launching skill' }] } },
            { type: 'result', is_error: true, result: 'Usage limit reached' },
        ];
        const script = `process.stdout.write(${JSON.stringify(events.map(event => JSON.stringify(event)).join('\n') + '\n')}); setInterval(() => {}, 1000);`;
        await assert.rejects(execute([process.execPath, '-e', script], Harness.Claude, temporary.path, {}, join(temporary.path, 'raw.jsonl'), 1, 6,
            { target: 'cratis-arc-command', corpusSkills: ['cratis-arc-command'], withSkills: true }));
    } finally { await temporary.remove(); }
});
