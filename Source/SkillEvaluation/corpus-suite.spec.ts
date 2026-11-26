// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir, mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { suiteOptions, schedule, validateSuite } from './suite-input.ts';
import { evaluateIdiom, scoreSources } from './suite-scoring.ts';
import { summarize, renderReport, variance } from './suite-report.ts';
import { SuiteTranscript } from './suite-transcript.ts';
import { inside, copyFixture } from './suite-files.ts';
import type { SuiteResult, Suite } from './Suite.ts';
import { concurrent, pendingTasks } from './storage.ts';
import { suiteMain, writeLocked } from './suite-runner.ts';
import { protectedFilesUnchanged } from './suite-trial.ts';
import { runProcess } from './suite-process.ts';

const manifest = new URL('../../Evaluations/corpus-v2/tasks/suite.json', import.meta.url);
const suite = validateSuite(JSON.parse(await readFile(manifest, 'utf8')));

test('the frozen suite has 24 unique tasks, all scored, and a six-task pilot', () => {
    assert.equal(suite.tasks.length, 24);
    assert.equal(new Set(suite.tasks.map(task => task.id)).size, 24);
    assert.equal(suite.tasks.filter(task => task.pilot).length, 6);
    for (const task of suite.tasks) {
        assert.ok(task.idioms.length >= 2);
        assert.ok(task.requiredSpecs.length > 0);
        assert.ok(!/cratis\/ai|SKILL\.md|corpus v[12]/i.test(task.prompt));
    }
});

test('every suite task names skills available for v2 routing', async () => {
    const skills = new Set(await readdir(new URL('../../.cratis/ai-v2/skills/', import.meta.url)));
    for (const task of suite.tasks) {
        assert.ok(task.expectedSkills.v2.length > 0, `${task.id} lacks v2 routing expectations`);
        for (const skill of task.expectedSkills.v2) assert.ok(skills.has(skill), `${task.id}: unknown v2 skill ${skill}`);
    }
});

test('defaults count 216 calls, pilot counts 18, and dry-run does not require a run directory', () => {
    assert.equal(schedule(suite, suiteOptions(['--dry-run'])).length, 216);
    assert.equal(schedule(suite, suiteOptions(['--pilot', '--dry-run'])).length, 18);
    const options = suiteOptions(['--arms', 'none', '--runs', '1', '--task', '01-concepts', '--dry-run']);
    assert.equal(schedule(suite, options).length, 1);
    assert.equal(options.model, 'openai-codex/gpt-6.2-sol');
    assert.equal(options.concurrency, 2);
    assert.deepEqual(schedule(suite, options), schedule(suite, options));
    assert.notDeepEqual(schedule(suite, suiteOptions(['--seed', '42'])), schedule(suite, suiteOptions(['--seed', '43'])));
    for (const args of [['--arms', 'v1,v1'], ['--harness', 'claude'], ['--runs', '0'], ['--unknown'], ['--thinking', 'high'], ['--task', 'missing']]) {
        assert.throws(() => schedule(suite, suiteOptions(args)));
    }
});

test('suite option validation retains model, pilot and integer diagnostics', () => {
    assert.throws(() => suiteOptions(['--model', 'local']), /Use a provider\/model identity/);
    assert.throws(() => suiteOptions(['--pilot', '--runs', '01']), /Pilot has exactly one repetition/);
    assert.equal(suiteOptions(['--pilot', '--runs', '1']).runs, 1);
    assert.throws(() => suiteOptions(['--pilot', '--runs', '']), /Expected integer 1\.\.20:/);
    assert.throws(() => suiteOptions(['--concurrency', '9']), /Expected integer 1\.\.8: 9/);
    assert.throws(() => suiteOptions(['--concurrency', '1.5']), /Expected integer 1\.\.8: 1\.5/);
});

test('dry run prints its plan without opening a sandbox or validating the run directory', async t => {
    const log = t.mock.method(console, 'log', () => {});
    const args = ['--arms', 'none', '--runs', '1', '--task', '01-concepts', '--run', '.ai-work/corpus-v2/runs'];
    await suiteMain([...args, '--dry-run']);
    assert.equal(log.mock.callCount(), 1);
    const plan = JSON.parse(log.mock.calls[0].arguments[0]);
    assert.deepEqual(plan.schedule, [{ key: '01-concepts:none:1', task: '01-concepts', arm: 'none', repetition: 1 }]);
    await assert.rejects(suiteMain(args), /Run directory must be below \.ai-work\/corpus-v2\/runs/);
});

test('schema rejects unsafe paths, missing scorers, duplicate IDs and unbounded limits', () => {
    const mutate = (change: (value: Suite) => void) => { const copy = structuredClone(suite); change(copy); return copy; };
    for (const value of [mutate(value => value.tasks[0].fixture = '../escape'), mutate(value => value.tasks[0].idioms = []),
        mutate(value => value.tasks[1].id = value.tasks[0].id), mutate(value => value.tasks[0].timeoutSeconds = 0)]) {
        assert.throws(() => validateSuite(value));
    }
});

test('every declared idiom has a passing witness and a failing mutant', () => {
    for (const task of suite.tasks) for (const check of task.idioms) {
        assert.equal(evaluateIdiom(check, check.positive), true, `${task.id}: ${check.id} positive`);
        assert.equal(evaluateIdiom(check, check.negative), false, `${task.id}: ${check.id} negative`);
        assert.equal(evaluateIdiom(check, `// ${check.positive}`), check.kind === 'absent', `${check.id}: comments cannot supply required code`);
    }
});

test('source scoring cannot pass by omitting required code or specs', () => {
    const result = scoreSources(suite.tasks[0], new Map());
    assert.equal(result.passed, false);
    assert.equal(result.specsPresent, false);
    assert.ok(result.idioms.some(check => !check.passed));
});

test('fixture copies refuse links and paths cannot escape their root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'corpus-files-'));
    try {
        await mkdir(join(root, 'seed'));
        await writeFile(join(root, 'seed', 'one.cs'), 'seed');
        await copyFixture(join(root, 'seed'), join(root, 'trial'));
        await writeFile(join(root, 'trial', 'one.cs'), 'changed');
        assert.equal(await readFile(join(root, 'seed', 'one.cs'), 'utf8'), 'seed');
        assert.throws(() => inside(root, '../escape'));
        assert.throws(() => inside(root, '/etc/passwd'));
        await symlink('/etc/passwd', join(root, 'seed', 'outside'));
        await assert.rejects(copyFixture(join(root, 'seed'), join(root, 'bad')));
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('telemetry retains measured usage on errors, confirms successful reads only, and rejects substitution', () => {
    const transcript = new SuiteTranscript('openai-codex/gpt-6.2-sol', ['concepts']);
    transcript.consume({ type: 'tool_execution_start', toolCallId: '1', toolName: 'read', args: { path: '/corpus/skills/concepts/SKILL.md' } });
    transcript.consume({ type: 'tool_execution_end', toolCallId: '1', isError: true });
    assert.deepEqual([...transcript.confirmedSkills], []);
    transcript.consume({ type: 'tool_execution_start', toolCallId: 'spoof', toolName: 'read', args: { path: '/workspace/skills/concepts/SKILL.md' } });
    transcript.consume({ type: 'tool_execution_end', toolCallId: 'spoof', isError: false });
    assert.deepEqual([...transcript.confirmedSkills], []);
    transcript.consume({ type: 'tool_execution_start', toolCallId: '2', toolName: 'read', args: { path: '/corpus/skills/concepts/SKILL.md' } });
    transcript.consume({ type: 'tool_execution_end', toolCallId: '2', isError: false });
    transcript.consume({ type: 'message_end', message: { role: 'assistant', provider: 'openai-codex', model: 'gpt-6.2-sol', usage: { input: 12, output: 3, cacheRead: 4, cacheWrite: 0 }, stopReason: 'error', errorMessage: 'quota' } });
    assert.equal(transcript.metrics().input, 12);
    assert.equal(transcript.metrics().output, 3);
    assert.equal(transcript.metrics().turns, 1);
    assert.equal(transcript.metrics().costUsd, null);
    assert.deepEqual([...transcript.confirmedSkills], ['concepts']);
    assert.equal(transcript.error, 'quota');
    const substituted = new SuiteTranscript('openai-codex/gpt-6.2-sol', []);
    substituted.consume({ type: 'message_end', message: { role: 'assistant', provider: 'other', model: 'other' } });
    assert.match(substituted.error!, /model/i);
    assert.equal(new SuiteTranscript('x/y', []).metrics().input, null);
});

function row(arm: SuiteResult['arm'], repetition: number, passed: boolean): SuiteResult {
    return { key: `task:${arm}:${repetition}`, task: 'task', area: 'concepts', arm, repetition, status: 'completed', passed,
        idioms: [{ id: 'concept', passed }], buildExit: 0, specExit: 0, durationSeconds: repetition, metrics: {
            input: 10, output: 2, cacheRead: null, cacheWrite: null, reasoning: null, turns: 1, toolCalls: 2, costUsd: null },
        attemptedSkills: [], confirmedSkills: [], transcript: 'raw/task.jsonl' };
}

test('resume locks reject changes and skip only completed trial keys', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'corpus-resume-'));
    try {
        const lock = join(directory, 'inputs.json');
        await writeLocked(lock, { image: 'sha256:first', model: 'p/m' });
        await writeLocked(lock, { image: 'sha256:first', model: 'p/m' });
        await assert.rejects(writeLocked(lock, { image: 'sha256:changed', model: 'p/m' }), /Locked inputs/);
        const plan = schedule(suite, suiteOptions(['--pilot']));
        assert.deepEqual(pendingTasks(plan, [plan[0]]), plan.slice(1));
        assert.deepEqual(pendingTasks(plan, []), plan);
    } finally { await rm(directory, { recursive: true, force: true }); }
});

test('concurrent workers remain bounded without skipping work', async () => {
    let active = 0;
    let peak = 0;
    const completed: number[] = [];
    await concurrent([1, 2, 3, 4, 5], 2, async item => {
        peak = Math.max(peak, ++active);
        await new Promise(resolve => setTimeout(resolve, 5));
        completed.push(item);
        active--;
    });
    assert.equal(peak, 2);
    assert.deepEqual(completed.sort(), [1, 2, 3, 4, 5]);
});

test('scoring rejects modified package inputs, seed specs and injected project targets', () => {
    const before = new Map([['package.json', '{}'], ['Production.Specs/seed.cs', 'seed']]);
    assert.equal(protectedFilesUnchanged(before, new Map(before)), true);
    for (const [path, content] of [['package.json', 'changed'], ['Production.Specs/seed.cs', 'changed'], ['Backend/Directory.Build.targets', '<Project/>']]) {
        assert.equal(protectedFilesUnchanged(before, new Map([...before, [path, content]])), false);
    }
    assert.equal(protectedFilesUnchanged(before, new Map([...before, ['Production.Specs/new.cs', 'new spec']])), true);
});

test('process failures preserve partial telemetry and raw output', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'corpus-process-'));
    const event = JSON.stringify({ type: 'message_end', message: { role: 'assistant', provider: 'p', model: 'm', usage: { input: 7 }, content: [] } });
    try {
        const transcript = new SuiteTranscript('p/m', []);
        const result = await runProcess({ command: [process.execPath, '-e', `console.log(${JSON.stringify(event)}); setInterval(() => {}, 1000)`],
            cwd: directory, env: process.env, log: join(directory, 'timeout.log'), timeoutSeconds: 1, transcript });
        assert.match(result.error!, /Timed out/);
        assert.notEqual(result.exit, 0);
        assert.equal(transcript.metrics().input, 7);
        assert.match(await readFile(join(directory, 'timeout.log'), 'utf8'), /message_end/);
        const failure = await runProcess({ command: [process.execPath, '-e', 'console.error("failure"); process.exit(7)'],
            cwd: directory, env: process.env, log: join(directory, 'failure.log'), timeoutSeconds: 5 });
        assert.equal(failure.exit, 7);
        assert.equal(await readFile(join(directory, 'failure.log'), 'utf8'), 'failure\n');
    } finally { await rm(directory, { recursive: true, force: true }); }
});

test('reports keep failures in denominators, missing metrics null, and repetition variance', () => {
    const rows = [row('v1', 1, true), row('v1', 2, false), { ...row('none', 1, false), status: 'infrastructure-error' as const }];
    const [group] = summarize(rows);
    assert.equal(group.passRate, 0.5);
    assert.equal(group.trials, 2);
    assert.equal(variance([1, 3]), 2);
    const report = renderReport(rows, 9);
    assert.match(report, /3\/9/);
    assert.match(report, /infrastructure-error/);
    assert.match(report, /N\/A/);
    assert.match(report, /inconclusive/i);
});
