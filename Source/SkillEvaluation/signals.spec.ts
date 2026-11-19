// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Harness } from './Harness.ts';
import { Transcript, skillSignal } from './signals.ts';

// Minimal events derived from the pilot smoke JSONL (ids/path shortened, no private content).
const piRead = '{"type":"tool_execution_start","toolCallId":"call_9e4c","toolName":"read","args":{"path":"/corpus/skills/cratis-arc-command/SKILL.md","offset":null,"limit":null}}';
const claudeLimit = '{"type":"result","is_error":true,"result":"Usage limit reached","usage":{"input_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":0},"num_turns":1}';
const claudeSkill = '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"tool_1","name":"Skill","input":{"skill":"cratis-arc-command"}}]}}';

test('tool attempts are deduplicated, not mentions or grep searches', () => {
    const pi = new Transcript(Harness.Pi);
    pi.consume(piRead); pi.consume(piRead);
    pi.consume('{"type":"tool_execution_start","toolCallId":"search","toolName":"grep","args":{"path":"/corpus/skills/cratis-chronicle-projection/SKILL.md"}}');
    assert.deepEqual([...pi.skillsRead], []);
    assert.deepEqual([...pi.attemptedSkills], ['cratis-arc-command']);
    assert.equal(pi.seenCalls.size, 2);
    const claude = new Transcript(Harness.Claude);
    claude.consume(claudeSkill); claude.consume(claudeSkill);
    assert.deepEqual([...claude.skillsRead], []);
    assert.deepEqual([...claude.attemptedSkills], ['cratis-arc-command']);
    assert.equal(claude.seenCalls.size, 1);
    assert.equal(skillSignal('Read', { file_path: '/corpus/skills/cratis-chronicle-projection/SKILL.md' }), 'cratis-chronicle-projection');
    assert.equal(skillSignal('read', { path: '/corpus/skills/cratis-arc-command/references/a.md' }), undefined);
    assert.equal(skillSignal('Skill', { command: 'plugin:cratis-arc-command' }), 'cratis-arc-command');
});

const expectation = { target: 'cratis-arc-command', corpusSkills: ['cratis-arc-command', 'cratis-chronicle-projection'], withSkills: true };

for (const harness of [Harness.Pi, Harness.Claude]) {
    test(`${harness} fixtures require a matching successful installed skill load`, async context => {
        const root = mkdtempSync(join(tmpdir(), 'skill-signals-'));
        try {
            for (const skill of [...expectation.corpusSkills, 'uninstalled']) {
                const directory = join(root, 'skills', skill);
                mkdirSync(directory, { recursive: true });
                writeFileSync(join(directory, 'SKILL.md'), 'Skill content');
            }
            const fixture = JSON.parse(readFileSync(new URL(`./fixtures/${harness}.json`, import.meta.url), 'utf8')) as {
                scenarios: Array<{ name: string; confirmed: string[]; events: Record<string, unknown>[] }>;
            };
            for (const scenario of fixture.scenarios) await context.test(scenario.name, () => {
                const transcript = new Transcript(harness, expectation, root);
                for (const event of scenario.events) transcript.consume(JSON.stringify(event).replaceAll('/corpus', root));
                assert.deepEqual([...transcript.skillsRead], scenario.confirmed);
                assert.equal(transcript.targetLoaded, scenario.confirmed.includes(expectation.target));
                assert.ok(transcript.attemptedSkills.size > 0);
                for (const event of scenario.events) transcript.consume(JSON.stringify(event).replaceAll('/corpus', root));
                assert.deepEqual([...transcript.skillsRead], scenario.confirmed, 'duplicate events are idempotent');
            });
        } finally { rmSync(root, { recursive: true }); }
    });
}

test('mismatched and missing correlation IDs cannot confirm, and failures cannot be upgraded', () => {
    const transcript = new Transcript(Harness.Claude, expectation);
    transcript.consume(claudeSkill);
    const result = (id: string, failed = false) => JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: failed }] } });
    transcript.consume(result('other'));
    transcript.consume(result(''));
    assert.equal(transcript.skillsRead.size, 0);
    transcript.consume(result('tool_1', true));
    transcript.consume(result('tool_1'));
    assert.equal(transcript.skillsRead.size, 0);
    transcript.consume('{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"cratis-arc-command"}}]}}');
    transcript.consume('{"type":"user","message":{"content":[{"type":"tool_result"}]}}');
    assert.equal(transcript.skillsRead.size, 0);
});

test('baseline invocations do not confirm corpus skills', () => {
    const transcript = new Transcript(Harness.Claude, { ...expectation, withSkills: false });
    transcript.consume(claudeSkill);
    transcript.consume('{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"tool_1","content":"Launching skill"}]}}');
    assert.equal(transcript.targetLoaded, false);
});

test('read containment rejects traversal, sibling prefixes and symlink escapes', () => {
    const parent = mkdtempSync(join(tmpdir(), 'skill-containment-'));
    const root = join(parent, 'root');
    const outside = join(parent, 'root-other', 'skills', expectation.target);
    mkdirSync(root);
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, 'SKILL.md'), 'Outside skill');
    symlinkSync(join(parent, 'root-other', 'skills'), join(root, 'skills'));
    try {
        for (const path of [join(outside, 'SKILL.md'), `../root-other/skills/${expectation.target}/SKILL.md`, `skills/${expectation.target}/SKILL.md`]) {
            const transcript = new Transcript(Harness.Pi, expectation, root);
            transcript.consume(JSON.stringify({ type: 'tool_execution_start', toolCallId: 'read', toolName: 'read', args: { path } }));
            transcript.consume('{"type":"tool_execution_end","toolCallId":"read","isError":false}');
            assert.equal(transcript.targetLoaded, false);
        }
    } finally { rmSync(parent, { recursive: true }); }
});

test('Claude usage limits are an execution error, not a negative trigger verdict', () => {
    const transcript = new Transcript(Harness.Claude);
    transcript.consume(claudeLimit);
    assert.match(transcript.error!, /Usage limit/);
});

test('final text and cached usage are extracted with harness-specific accounting', () => {
    const pi = new Transcript(Harness.Pi);
    const event = (text: string) => JSON.stringify({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text }], usage: { input: 10, cacheRead: 20, cacheWrite: 5, output: 3 } } });
    pi.consume(event('intermediate')); pi.consume(event('final'));
    assert.equal(pi.text, 'final');
    assert.deepEqual(pi.usage, { input: 70, output: 6 });
    const claude = new Transcript(Harness.Claude);
    claude.consume('{"type":"result","result":"answer","usage":{"input_tokens":10,"cache_read_input_tokens":20,"cache_creation_input_tokens":5,"output_tokens":3},"total_cost_usd":0.1}');
    assert.equal(claude.text, 'answer');
    assert.deepEqual(claude.usage, { input: 35, output: 3, costUsd: 0.1 });
    assert.equal(claude.completed, true);
});

test('Claude init requires the target with skills and forbids corpus skills in the baseline', () => {
    const init = (skills: string[]) => JSON.stringify({ type: 'system', subtype: 'init', skills, tools: ['Read', 'Glob', 'Grep', 'Skill'] });
    const expectation = { target: 'cratis-arc-command', corpusSkills: ['cratis-arc-command', 'cratis-chronicle-projection'], withSkills: true };
    const valid = new Transcript(Harness.Claude, expectation);
    valid.consume(init(['cratis-arc-command', 'debug']));
    valid.validateInitialization();
    assert.equal(valid.error, undefined);
    assert.deepEqual(valid.listedSkills, ['cratis-arc-command', 'debug']);
    const missing = new Transcript(Harness.Claude, expectation);
    missing.consume(init(['debug']));
    assert.match(missing.error!, /does not list target/);
    const contaminated = new Transcript(Harness.Claude, { ...expectation, withSkills: false });
    contaminated.consume(init(['cratis-chronicle-projection']));
    assert.match(contaminated.error!, /without-skills.*corpus skill/);
    const baseline = new Transcript(Harness.Claude, { ...expectation, withSkills: false });
    baseline.consume(init(['debug']));
    baseline.validateInitialization();
    assert.equal(baseline.error, undefined);
    const absent = new Transcript(Harness.Claude, expectation);
    absent.validateInitialization();
    assert.match(absent.error!, /did not emit/);
});

test('pi model errors remain errors even if the stream ends', () => {
    const transcript = new Transcript(Harness.Pi);
    transcript.consume('{"type":"message_end","message":{"role":"assistant","stopReason":"error","errorMessage":"Not logged in"}}');
    transcript.consume('{"type":"agent_end"}');
    assert.equal(transcript.error, 'Not logged in');
});
