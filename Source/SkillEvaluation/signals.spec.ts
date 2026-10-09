// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Harness } from './Harness.ts';
import { Transcript, skillSignal } from './signals.ts';

// Minimal events derived from the pilot smoke JSONL (ids/path shortened, no private content).
const piRead = '{"type":"tool_execution_start","toolCallId":"call_9e4c","toolName":"read","args":{"path":"/corpus/skills/cratis-arc-command/SKILL.md","offset":null,"limit":null}}';
const claudeLimit = '{"type":"result","is_error":true,"result":"Usage limit reached","usage":{"input_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":0},"num_turns":1}';
const claudeSkill = '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"tool_1","name":"Skill","input":{"skill":"cratis-arc-command"}}]}}';

test('pi reads and Claude Skill invocations are deduplicated, not mentions or grep searches', () => {
    const pi = new Transcript(Harness.Pi);
    pi.consume(piRead); pi.consume(piRead);
    pi.consume('{"type":"tool_execution_start","toolCallId":"search","toolName":"grep","args":{"path":"/corpus/skills/cratis-chronicle-projection/SKILL.md"}}');
    assert.deepEqual([...pi.skillsRead], ['cratis-arc-command']);
    assert.equal(pi.seenCalls.size, 2);
    const claude = new Transcript(Harness.Claude);
    claude.consume(claudeSkill); claude.consume(claudeSkill);
    assert.deepEqual([...claude.skillsRead], ['cratis-arc-command']);
    assert.equal(claude.seenCalls.size, 1);
    assert.equal(skillSignal('Read', { file_path: '/corpus/skills/cratis-chronicle-projection/SKILL.md' }), 'cratis-chronicle-projection');
    assert.equal(skillSignal('read', { path: '/corpus/skills/cratis-arc-command/references/a.md' }), undefined);
    assert.equal(skillSignal('Skill', { command: 'plugin:cratis-arc-command' }), 'cratis-arc-command');
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

test('pi model errors remain errors even if the stream ends', () => {
    const transcript = new Transcript(Harness.Pi);
    transcript.consume('{"type":"message_end","message":{"role":"assistant","stopReason":"error","errorMessage":"Not logged in"}}');
    transcript.consume('{"type":"agent_end"}');
    assert.equal(transcript.error, 'Not logged in');
});
