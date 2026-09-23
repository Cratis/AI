// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { validateMcpServers } from './mcp-servers.ts';

const profiles = new Set(['cratis/screenplay']);
const server = {
    id: 'screenplay', profiles: ['cratis/screenplay'], transport: 'stdio',
    command: 'cratis', args: ['screenplay', 'mcp'], defaultRoot: '.cratis/screenplay',
    description: 'Safely author a Screenplay model.',
};
const catalogue = (servers: unknown[]) => ({ schemaVersion: '1.0', servers });

test('Screenplay MCP uses the CLI entry point and conventional model root', () => {
    const path = resolve(import.meta.dirname, '../../.cratis/ai/mcp-servers.json');
    const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
    assert.deepEqual(validateMcpServers(value, profiles), []);
    const declared = (value as { servers: Array<typeof server> }).servers;
    assert.equal(declared.length, 1);
    assert.equal(declared[0].id, 'screenplay');
    assert.equal(declared[0].command, 'cratis');
    assert.deepEqual(declared[0].args, ['screenplay', 'mcp']);
    assert.equal(declared[0].defaultRoot, '.cratis/screenplay');
});

test('MCP catalogue validation detects planted invalid declarations', () => {
    const invalid = [
        catalogue([]),
        catalogue([server, server]),
        catalogue([{ ...server, profiles: ['missing'] }]),
        catalogue([{ ...server, args: [1] }]),
        catalogue([{ ...server, command: '' }]),
        catalogue([{ ...server, transport: 'invented' }]),
        catalogue([{ ...server, defaultRoot: '../outside' }]),
        catalogue([{ ...server, defaultRoot: '/outside' }]),
        catalogue([{ ...server, defaultRoot: 'C:\\outside' }]),
        catalogue([{ ...server, secret: 'not-an-admitted-field' }]),
        { ...catalogue([server]), schemaVersion: 'future' },
    ];
    assert.equal(invalid.length, 11);
    for (const value of invalid) assert.ok(validateMcpServers(value, profiles).length > 0, JSON.stringify(value));
});

test('MCP catalogue accepts the explicit project root', () => {
    assert.deepEqual(validateMcpServers(catalogue([{ ...server, defaultRoot: '.' }]), profiles), []);
});
