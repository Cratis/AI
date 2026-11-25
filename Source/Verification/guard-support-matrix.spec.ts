// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

// Contract for the support matrix in .cratis/ai/hooks/README.md. These guards are best-effort defense in
// depth, not a sandbox. A `limit` row asserts only what the guard does NOT detect; its zero verdict is never a
// claim that the command is safe. Candidate shell text is JSON input to the guard and is never executed.
const scripts = resolve(import.meta.dirname, '../../.cratis/ai/hooks/scripts');
type Guard = 'writes' | 'secrets';
type Outcome = 'allow' | 'refuse' | 'limit';
type Row = { area: string; guard: Guard; command: string; outcome: Outcome };
const status = { allow: 0, refuse: 2, limit: 0 } as const;
const script = { writes: 'cratis-guard-shell-writes.sh', secrets: 'cratis-guard-secrets.sh' } as const;

const rows: Row[] = [
    // State inherited from earlier calls: only the supplied cwd and the command text are known.
    { area: 'state', guard: 'writes', command: 'rm -rf .', outcome: 'refuse' },
    { area: 'state', guard: 'writes', command: 'rm -rf Source/Foo/bin', outcome: 'allow' },
    { area: 'state', guard: 'writes', command: 'rm -rf "$LATER"', outcome: 'refuse' },
    { area: 'state: an earlier call may have changed what a clean-looking name means', guard: 'writes', command: 'rm -rf output', outcome: 'limit' },
    // Aliases and functions are never loaded or run to inspect them.
    { area: 'alias: a synthetic alias name hides its definition', guard: 'writes', command: 'cleanup-alias .', outcome: 'limit' },
    { area: 'alias', guard: 'secrets', command: 'cat .env', outcome: 'refuse' },
    // Directory resolution: literal paths and links are resolved; later filesystem changes are not.
    { area: 'directory', guard: 'writes', command: 'rm -rf control-link/', outcome: 'refuse' },
    { area: 'directory', guard: 'writes', command: 'rm -rf .cratis/ai/../', outcome: 'refuse' },
    { area: 'directory', guard: 'writes', command: 'rm -rf Source/Foo/bin', outcome: 'allow' },
    // Expansion and quoting: archive operands that can expand to options.
    { area: 'expansion', guard: 'writes', command: 'tar -cf /tmp/o.tar ?x', outcome: 'refuse' },
    { area: 'expansion', guard: 'writes', command: 'tar -cf /tmp/o.tar ""?x', outcome: 'refuse' },
    { area: 'expansion', guard: 'writes', command: 'tar -cf /tmp/o.tar -- ?x', outcome: 'refuse' },
    { area: 'expansion', guard: 'writes', command: 'tar -cf ""? Source', outcome: 'refuse' },
    { area: 'expansion', guard: 'writes', command: 'tar -cf /tmp/o.tar ./?x', outcome: 'allow' },
    { area: 'expansion', guard: 'writes', command: "tar -cf /tmp/o.tar '?x'", outcome: 'allow' },
    { area: 'expansion', guard: 'writes', command: 'tar -cf /tmp/o.tar "a"?', outcome: 'allow' },
    { area: 'expansion', guard: 'writes', command: 'zip /tmp/o.zip -- ?x', outcome: 'allow' },
    { area: 'expansion', guard: 'writes', command: '7z a /tmp/o.7z -- ?x', outcome: 'allow' },
    { area: 'expansion', guard: 'secrets', command: "cat .e''nv", outcome: 'refuse' },
    { area: 'expansion', guard: 'secrets', command: 'rg -n foo Source', outcome: 'allow' },
    // Known gap tracked on Cratis/AI#1223: cp and rsync share the option reader but not the archive check.
    { area: 'known gap: cp operands that can expand to options', guard: 'writes', command: 'cp ?x /tmp/d', outcome: 'limit' },
    { area: 'known gap: rsync operands that can expand to options', guard: 'writes', command: 'rsync -a ?x /tmp/d', outcome: 'limit' },
    // File-list content and generated scripts are not read or evaluated.
    { area: 'file list: payload is not inspected', guard: 'writes', command: 'tar -cf /tmp/o.tar -T files.txt', outcome: 'limit' },
    { area: 'external script: behaviour is not inspected', guard: 'secrets', command: './generate-report.sh', outcome: 'limit' },
    // Wrappers and shell entry points: only modeled wrappers and literal nested bodies.
    { area: 'wrapper', guard: 'writes', command: 'env tar -cf /tmp/o.tar ?x', outcome: 'refuse' },
    { area: 'wrapper', guard: 'writes', command: "sh -c 'tar -cf /tmp/o.tar ?x'", outcome: 'refuse' },
    { area: 'wrapper', guard: 'writes', command: "sh -c 'tar -cf /tmp/o.tar ./?x'", outcome: 'allow' },
    { area: 'wrapper', guard: 'writes', command: 'nice rm -rf .', outcome: 'refuse' },
    { area: 'wrapper: a custom wrapper is an unmodeled executable', guard: 'writes', command: 'custom-runner tar -cf /tmp/o.tar ?x', outcome: 'limit' },
    // Ordinary workflows the guards must keep allowing.
    { area: 'workflow', guard: 'secrets', command: 'git commit -m "mentions .env file"', outcome: 'allow' },
    { area: 'workflow', guard: 'secrets', command: 'cat .env.example', outcome: 'allow' },
];

function verdict(root: string, entry: Row): number | null {
    const result = spawnSync('/bin/bash', [join(scripts, script[entry.guard])], {
        cwd: tmpdir(), timeout: 20_000, encoding: 'utf8',
        env: { ...process.env, HOME: tmpdir(), CRATIS_HOOKS_ALLOW_PROTECTED_WRITES: '0', CRATIS_HOOKS_ALLOW_SECRET_READS: '0' },
        input: JSON.stringify({ cwd: root, tool_name: 'Bash', tool_input: { command: entry.command } }),
    });
    assert.ifError(result.error);
    assert.equal(result.stdout, '', entry.command);
    return result.status;
}

test('the support matrix rows keep their published outcome', () => {
    const root = mkdtempSync(join(tmpdir(), 'cratis-support-matrix-'));
    try {
        assert.equal(spawnSync('git', ['init', '-q', root]).status, 0);
        for (const directory of ['.cratis/ai/hooks', 'Source/Foo/bin', 'node_modules']) mkdirSync(join(root, directory), { recursive: true });
        symlinkSync('.cratis', join(root, 'control-link'));
        for (const entry of rows) assert.equal(verdict(root, entry), status[entry.outcome], `${entry.area}: ${entry.guard}: ${entry.command}`);
    } finally { rmSync(root, { recursive: true, force: true }); }
});
