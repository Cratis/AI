// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { validateMcpServers } from './mcp-servers.ts';

const profiles = new Set(['cratis/screenplay', 'cratis/codescene']);
const server = {
    id: 'screenplay', profiles: ['cratis/screenplay'], transport: 'stdio',
    command: 'cratis', args: ['screenplay', 'mcp'],
    description: 'Safely author a Screenplay model.',
};
const catalogue = (servers: unknown[]) => ({ schemaVersion: '1.0', servers });

test('Screenplay MCP uses the CLI entry point and leaves model location to it', () => {
    const path = resolve(import.meta.dirname, '../../.cratis/ai/mcp-servers.json');
    const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
    assert.deepEqual(validateMcpServers(value, profiles), []);
    const declared = (value as { servers: Array<typeof server> }).servers.filter(entry => entry.id === 'screenplay');
    assert.equal(declared.length, 1);
    assert.equal(declared[0].id, 'screenplay');
    assert.equal(declared[0].command, 'cratis');
    assert.deepEqual(declared[0].args, ['screenplay', 'mcp']);
    assert.equal('defaultRoot' in declared[0], false);
});

test('CodeScene MCP is an opt-in stdio declaration with no arguments', () => {
    const path = resolve(import.meta.dirname, '../../.cratis/ai/mcp-servers.json');
    const value = JSON.parse(readFileSync(path, 'utf8')) as { servers: Array<typeof server> };
    const declared = value.servers.filter(entry => entry.id === 'codescene');
    assert.equal(declared.length, 1);
    assert.deepEqual(declared[0].profiles, ['cratis/codescene']);
    assert.equal(declared[0].transport, 'stdio');
    assert.equal(declared[0].command, 'cs-mcp');
    assert.deepEqual(declared[0].args, []);
    assert.match(declared[0].description, /account.*OAuth login/);
});

test('MCP catalogue validation detects planted invalid declarations', () => {
    const invalid = [
        catalogue([]),
        catalogue([server, server]),
        catalogue([{ ...server, profiles: ['missing'] }]),
        catalogue([{ ...server, args: [1] }]),
        catalogue([{ ...server, command: '' }]),
        catalogue([{ ...server, transport: 'invented' }]),
        catalogue([{ ...server, defaultRoot: '.cratis/screenplay' }]),
        catalogue([{ ...server, secret: 'not-an-admitted-field' }]),
        { ...catalogue([server]), schemaVersion: 'future' },
    ];
    assert.equal(invalid.length, 9);
    for (const value of invalid) assert.ok(validateMcpServers(value, profiles).length > 0, JSON.stringify(value));
});
