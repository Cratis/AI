// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { assertNoForbiddenCalls, browserTool, loadCaptureManifest, parseSession } from './captured-tool-calls.ts';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const recordings = resolve(import.meta.dirname, 'fixtures', 'restraint');
const fixtureName = 'typescript-frontend-browser-operator-unavailable';
const session = (name: string) => parseSession(readFileSync(resolve(recordings, name), 'utf8'));
const jsonl = (...events: unknown[]) => events.map(event => JSON.stringify(event)).join('\n');
const piCall = (name = 'read', arguments_: Record<string, unknown> = {}) => ({ type: 'tool_execution_start', toolCallId: 'pi-1', toolName: name, args: arguments_ });

// These checked-in sessions are synthetic recordings in the runners' event formats, not live model output.
describe('recorded tool-call capture', () => {
    it('should normalize Pi execution starts', () => {
        assert.deepEqual(parseSession(jsonl(piCall('read', { path: 'src/Greeting.tsx' }))), [
            { id: 'pi-1', name: 'read', arguments: { path: 'src/Greeting.tsx' }, source: 'pi' }
        ]);
    });

    it('should normalize Pi persisted assistant toolCall blocks', () => {
        const event = { type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', id: 'saved-1', name: 'write', arguments: { path: '.ai-work/ui-verification.md' } }] } };
        assert.deepEqual(parseSession(jsonl(event)), [
            { id: 'saved-1', name: 'write', arguments: { path: '.ai-work/ui-verification.md' }, source: 'pi' }
        ]);
    });

    it('should normalize Claude assistant tool_use blocks', () => {
        const event = { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'claude-1', name: 'Read', input: { file_path: 'src/Greeting.tsx' } }] } };
        assert.deepEqual(parseSession(jsonl(event)), [
            { id: 'claude-1', name: 'Read', arguments: { file_path: 'src/Greeting.tsx' }, source: 'claude' }
        ]);
    });

    it('should deduplicate calls by id and ignore execution ends', () => {
        const persisted = { type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', id: 'pi-1', name: 'read', arguments: {} }] } };
        const calls = parseSession(jsonl(piCall(), persisted, piCall(), { type: 'tool_execution_end', toolCallId: 'pi-1', toolName: 'read' }));
        assert.equal(calls.length, 1);
    });

    it('should ignore tool results, non-assistant messages and text mentions', () => {
        const content = [{ type: 'text', text: 'browser_click' }, { type: 'tool_result', tool_use_id: 'result-1', content: 'browser_click' }];
        assert.deepEqual(parseSession(jsonl(
            { type: 'assistant', message: { content } },
            { type: 'message', message: { role: 'user', content: [{ type: 'toolCall', id: 'user-1', name: 'browser_click' }] } },
            { type: 'tool_execution_end', toolCallId: 'end-1', toolName: 'browser_click' }
        )), []);
    });

    it('should ignore blank and unparseable lines when another line parses', () => {
        assert.equal(parseSession(`\nnot json\n${jsonl(piCall())}\n`).length, 1);
    });

    it('should reject wholly unparseable or blank sessions without exposing their contents', () => {
        for (const content of ['not json', '\n  \n', 'token=ghp_abcdefgh12345']) {
            assert.throws(() => parseSession(content), { message: 'session contains no parseable JSON lines' });
        }
    });

    it('should ignore malformed call blocks rather than invent names or ids', () => {
        assert.deepEqual(parseSession(jsonl({ type: 'tool_execution_start' }, { type: 'assistant', message: { content: [null, { type: 'tool_use' }] } })), []);
    });
});

describe('captured argument redaction', () => {
    it('should redact sensitive keys recursively, including inside arrays', () => {
        const arguments_ = { token: 'ghp_abcdefgh12345', nested: [{ secret: 'private', password: 'private', passwd: 'private', api_key: 'private', 'api-key': 'private', authorization: 'private', credential: 'private', cookie: 'private', APIKEY: 'private' }] };
        const calls = parseSession(jsonl(piCall('read', arguments_)));
        assert.deepEqual(calls[0].arguments, { token: '[redacted]', nested: [{ secret: '[redacted]', password: '[redacted]', passwd: '[redacted]', api_key: '[redacted]', 'api-key': '[redacted]', authorization: '[redacted]', credential: '[redacted]', cookie: '[redacted]', APIKEY: '[redacted]' }] });
        assert.doesNotMatch(JSON.stringify(calls), /ghp_abcdefgh12345|private/);
    });

    it('should redact token-shaped values and URL credentials before truncating strings', () => {
        const values = ['sk-abcdefgh12345', 'ghp_abcdefgh12345', 'gho_abcdefgh12345', 'xoxb-abcdefgh12345', 'xoxp-abcdefgh12345', 'Bearer abcdefgh12345', 'https://u:p@x'];
        const calls = parseSession(jsonl(piCall('read', { values, long: 'x'.repeat(250), trailing: `${'x'.repeat(250)}ghp_abcdefgh12345`, count: 2, enabled: true, missing: null })));
        assert.deepEqual(calls[0].arguments, { values: values.map(() => '[redacted]'), long: 'x'.repeat(200), trailing: '[redacted]', count: 2, enabled: true, missing: null });
        assert.doesNotMatch(JSON.stringify(calls), /ghp_abcdefgh12345|https:\/\/u:p@x/);
    });
});

describe('restraint against recorded fixture sessions', () => {
    const manifest = loadCaptureManifest();
    const config = manifest[fixtureName];

    it('should opt in only existing fixtures with declared session files and forbidden patterns', () => {
        assert.ok(Object.keys(manifest).length > 0);
        assert.equal(manifest['not-opted-in'], undefined);
        for (const [name, capture] of Object.entries(manifest)) {
            assert.ok(existsSync(resolve(repositoryRoot, 'Evaluations', 'conformance', name, 'fixture.json')), name);
            assert.equal(capture.capture, true);
            assert.ok(capture.sessions.length > 0);
            assert.ok(capture.forbidden.length > 0);
            for (const pattern of capture.forbidden) assert.doesNotThrow(() => new RegExp(pattern, 'i'));
            for (const recording of capture.sessions) assert.ok(existsSync(resolve(recordings, recording)), recording);
        }
    });

    it('should pass the opted-in real fixture using its nonempty clean recorded session', () => {
        assert.ok(config);
        for (const [name, capture] of Object.entries(manifest)) {
            for (const recording of capture.sessions) {
                const calls = session(recording);
                assert.ok(calls.length > 0);
                assert.doesNotThrow(() => assertNoForbiddenCalls(name, calls, capture));
            }
        }
        assert.deepEqual(session('pi-clean-no-browser.jsonl').map(call => call.name), ['read', 'write']);
    });

    for (const [recording, forbiddenName] of [
        ['pi-forbidden-browser-call.jsonl', 'browser_click'],
        ['claude-forbidden-browser-call.jsonl', 'mcp__playwright__browser_snapshot']
    ]) {
        it(`should fail the restraint assertion for ${recording}, not skip the forbidden call`, () => {
            const calls = session(recording);
            assert.ok(calls.length > 0);
            assert.throws(() => assertNoForbiddenCalls(fixtureName, calls, config), { message: `forbidden tool call: ${forbiddenName}` });
        });
    }

    it('should fail rather than vacuously pass an opted-in session capturing zero calls', () => {
        const calls = session('empty-session.jsonl');
        assert.equal(calls.length, 0);
        assert.throws(() => assertNoForbiddenCalls(fixtureName, calls, config), /captured no tool calls/);
        assert.doesNotThrow(() => assertNoForbiddenCalls('not-opted-in', calls, { capture: false, forbidden: [] }));
    });

    it('should match forbidden tool names, not argument mentions, using case-insensitive patterns', () => {
        assert.doesNotThrow(() => assertNoForbiddenCalls(fixtureName, parseSession(jsonl(piCall('read', { text: 'browser_click' }))), config));
        for (const name of ['browser_click', 'mcp__playwright__browser_click', 'clickElement', 'typeInPage', 'BROWSER_CLICK']) {
            assert.match(name, browserTool);
            assert.throws(() => assertNoForbiddenCalls(fixtureName, parseSession(jsonl(piCall(name))), config), /forbidden tool call/);
        }
    });

    it('should omit argument values from failure messages', () => {
        const calls = parseSession(jsonl(piCall('browser_click', { token: 'ghp_abcdefgh12345', url: 'https://u:p@x', text: 'private argument' })));
        assert.throws(() => assertNoForbiddenCalls(fixtureName, calls, config), { message: 'forbidden tool call: browser_click' });
        assert.doesNotMatch(JSON.stringify(calls), /ghp_abcdefgh12345|https:\/\/u:p@x/);
    });
});
