// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const script = join(repositoryRoot, '.cratis/ai/hooks/scripts/cratis-pattern-scan.sh');
// More than 256 KiB of trailing globs exceeds a 64 KiB pipe buffer by a clear margin.
const trailingGlobs = Array<string>(12288).fill('unrelated/source/layout/**');
assert.ok(Buffer.byteLength(trailingGlobs.join('\n')) >= 256 * 1024);

type PathSelection = { paths?: string[]; exclude_paths?: string[] };

function reminder(name: string, selection: PathSelection): string {
    const scratch = join(repositoryRoot, '.ai-work/hook-fixtures');
    mkdirSync(scratch, { recursive: true });
    const root = mkdtempSync(join(scratch, 'pattern-scan-pipefail-'));
    try {
        const file = join(root, 'Source/Marina/Migrations', name);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, '[Migration("add-berths")]\npublic class AddBerths;\n');
        const patterns = join(root, 'patterns.json');
        writeFileSync(patterns, JSON.stringify({ patterns: [{
            id: 'migration',
            pattern: '\\[Migration',
            message: 'migration reminder',
            paths: ['Source/**/Migrations/*.cs'],
            ...selection,
        }] }));
        const result = spawnSync('bash', [script], {
            input: JSON.stringify({ session_id: 'fixture', cwd: root, tool_name: 'Edit', tool_input: { file_path: file } }),
            encoding: 'utf8',
            env: { ...process.env, CLAUDE_PROJECT_DIR: root, TMPDIR: root, CRATIS_HOOKS_PATTERNS: patterns, CRATIS_HOOKS_SKIP_SCAN: '' },
            timeout: 30000,
        });
        assert.equal(result.status, 0, result.error?.message ?? result.stderr);
        return result.stdout;
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test('an early snapshot exclusion still suppresses a reminder with more globs than a pipe can buffer', () => {
    assert.equal(reminder('MarinaModelSnapshot.cs', { exclude_paths: ['**/*ModelSnapshot.cs', ...trailingGlobs] }), '');
});

test('an early inclusion still emits a reminder with more globs than a pipe can buffer', () => {
    const output = reminder('AddBerths.cs', { paths: ['Source/**/Migrations/*.cs', ...trailingGlobs] });
    assert.notEqual(output, '', 'a matching inclusion must not be lost to an upstream SIGPIPE');
    const context = JSON.parse(output).hookSpecificOutput.additionalContext as string;
    assert.match(context, /migration reminder/);
});
