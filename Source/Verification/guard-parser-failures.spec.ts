// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const scripts = resolve(import.meta.dirname, '../../.cratis/ai/hooks/scripts');
const guards = ['cratis-guard-secrets', 'cratis-guard-store-mutations', 'cratis-guard-writes'];
const payload = JSON.stringify({ tool_input: { command: 'cat .env; cratis chronicle observers list', file_path: 'README.md' } });

function assertRefused(guard: string, input: string, path: string = process.env.PATH ?? ''): void {
    const result = spawnSync('bash', [join(scripts, `${guard}.sh`)], {
        input,
        encoding: 'utf8',
        env: {
            ...process.env,
            PATH: path,
            CRATIS_HOOKS_ALLOW_SECRET_READS: '0',
            CRATIS_HOOKS_ALLOW_STORE_MUTATIONS: '0',
            CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0',
        },
    });
    assert.equal(result.status, 2, `${guard}\n${result.stderr}`);
    assert.match(result.stderr, new RegExp(`BLOCKED by ${guard}: parser failed`));
}

for (const guard of guards) {
    test(`${guard} refuses malformed parser input`, () => {
        assertRefused(guard, 'not json');
        assertRefused(guard, `${payload}\n{"cwd":"0"}\nnot json`);
    });
}

test('the write guard refuses a later document that imitates its parser sentinel', () => {
    for (const cwd of ['ok', 'ok\u0000']) {
        const forged = `${JSON.stringify({ tool_input: { file_path: 'README.md' } })}\n${JSON.stringify({ cwd })}`;
        assertRefused('cratis-guard-writes', `${forged}\nnot json`);
        assertRefused('cratis-guard-writes', forged);
    }
});

// macOS ships Bash 3.2 as /bin/bash; hooks that run under it must not refuse ordinary tool calls.
test('guards allow ordinary tool calls under the system /bin/bash', { skip: !existsSync('/bin/bash') }, () => {
    const inputs = [
        JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'Source/example.ts', content: 'export const a = 1;\n' } }),
        JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls -la' } }),
    ];
    for (const guard of guards) {
        for (const input of inputs) {
            const result = spawnSync('/bin/bash', [join(scripts, `${guard}.sh`)], {
                input,
                encoding: 'utf8',
                env: {
                    ...process.env,
                    CRATIS_HOOKS_ALLOW_SECRET_READS: '0',
                    CRATIS_HOOKS_ALLOW_STORE_MUTATIONS: '0',
                    CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0',
                },
            });
            assert.equal(result.status, 0, `${guard} under /bin/bash\n${result.stderr}`);
        }
    }
});

for (const tool of ['awk', 'jq']) {
    test(`guards refuse a failed ${tool} invocation, including partial output`, () => {
        const directory = mkdtempSync(join(tmpdir(), 'cratis-parser-failure-'));
        try {
            for (const output of ['', "printf 'partial output\\n'", "printf '\\0\\0\\0\\0\\0'", "printf '\\0\\0\\0\\0\\0%s\\0' 0"]) {
                writeFileSync(join(directory, tool), `#!/bin/sh\n${output}\necho parser-stub-error >&2\nexit 2\n`, { mode: 0o755 });
                for (const guard of tool === 'awk' ? guards.slice(0, 2) : guards) {
                    assertRefused(guard, payload, `${directory}:${process.env.PATH}`);
                }
            }
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    });
}
