// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const cwd = resolve(import.meta.dirname, '../..');
const guard = resolve(cwd, '.cratis/ai/hooks/scripts/cratis-guard-shell-writes.sh');

function checkCommand(command: string, expectedStatus: number) {
    // The command is JSON data for the guard, never a shell script to execute.
    const result = spawnSync('/bin/bash', [guard], {
        cwd,
        timeout: 20000,
        encoding: 'utf8',
        env: {
            ...process.env,
            HOME: tmpdir(),
            TMPDIR: tmpdir(),
            PREFIX_PARENT: '..',
            CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0',
        },
        input: JSON.stringify({ cwd, tool_name: 'Bash', tool_input: { command } }),
    });
    assert.ifError(result.error);
    assert.equal(result.status, expectedStatus, `${command}\n${result.stderr}`);
    assert.equal(result.stdout, '', command);
    return result.stderr;
}

const unresolved = [
    'p=..; rm -rf "$p/AI"',
    'p=..; rm -rf "${p}/AI"',
    'rm -rf "$(echo ..)/AI"',
    'rm -rf "`echo ..`/AI"',
    'rm -rf "$PREFIX_PARENT/AI"',
    'rm -rf "${PREFIX_PARENT}/AI"',
    'rm -rf "${missing:-..}/AI"',
    'rm -rf build/"$missing"',
    'rm -rf ~operator/AI',
    'rmdir "$missing/out"',
    'unlink "$missing/out"',
    'shred "$missing/out"',
    'mv "$missing/out" build',
    'find "$missing/out" -delete',
    'git clean -fdx -- "$missing/out"',
    'p=build; p=..; rm -rf "$p/out"',
    'p=build; unset p; rm -rf "$p/out"',
    'false && p=build; rm -rf "$p/out"',
    'p=build | cat; rm -rf "$p/out"',
    'p=build; (p=other); rm -rf "$p/out"',
    'p=build; sh -c \'rm -rf "$p/out"\'',
    'p=build; echo "$(p=other)"; rm -rf "$p/out"',
];

for (const [index, command] of unresolved.entries()) {
    test(`refuse destructive operands whose path cannot be resolved (${index + 1})`, () => {
        assert.match(checkCommand(command, 2), /operand that could not be resolved/);
    });
}

const allowed = [
    'p=build; rm -rf "$p/out"',
    'p=build; rm -rf "${p}/out"',
    'p=./build; rm -rf "$p/out"',
    'p="build/cache"; rm -rf "$p/out"',
    'p=build\nrm -rf "$p/out"',
    'p=build; q=cache; rm -rf "$p/out"',
    'p=build; rmdir "$p/out"',
    'p=build; mv "$p/out" build/archive',
    'p=build; find "$p/out" -delete',
    'p=build; git clean -fdx -- "$p/out"',
    'rm -rf "$PWD/build/out"',
    'rm -rf "$HOME/build/out"',
    'rm -rf "$TMPDIR/build/out"',
    'ls "$HOME"',
    'ls "$PREFIX_PARENT/AI"',
    'echo "$p/AI"',
    'p=..; echo "$p/AI"',
    'find "$missing/out" -print',
    'git -C "$missing" status',
    'unknown-program "$missing/out"',
];

for (const [index, command] of allowed.entries()) {
    test(`allow resolved paths and non-destructive commands (${index + 1})`, () => {
        assert.equal(checkCommand(command, 0), '');
    });
}

test('literal assignments still check the resolved protected path', () => {
    assert.match(checkCommand('p=.; rm -rf "$p"', 2), /protected reference/);
});
