// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const scan = join(repositoryRoot, '.cratis/ai/hooks/scripts/cratis-pattern-scan.sh');
const patterns = join(repositoryRoot, '.cratis/ai/hooks/scripts/cratis-patterns.json');

function reminder(path: string, content: string): string {
    const scratch = join(repositoryRoot, '.ai-work/hook-fixtures');
    mkdirSync(scratch, { recursive: true });
    const root = mkdtempSync(join(scratch, 'migration-reminder-'));
    try {
        const file = join(root, path);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, content);
        const result = spawnSync('bash', [scan], {
            input: JSON.stringify({ session_id: 'fixture', cwd: root, tool_name: 'Edit', tool_input: { file_path: file } }),
            encoding: 'utf8',
            env: { ...process.env, CLAUDE_PROJECT_DIR: root, TMPDIR: root, CRATIS_HOOKS_PATTERNS: patterns, CRATIS_HOOKS_SKIP_SCAN: '' },
        });
        assert.equal(result.status, 0, result.stderr);
        return result.stdout;
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test('a migration attribute produces an advisory reminder, never a block', () => {
    const output = reminder('Source/Marina/Migrations/AddBerths.cs', '[Migration("add-berths")]\npublic class AddBerths;\n');
    const context = JSON.parse(output).hookSpecificOutput.additionalContext as string;
    assert.match(context, /Migration review \(advisory\)/);
    assert.match(context, /uncommitted migration may be removed/);
    assert.match(context, /does not determine commit or database state/);
});

test('snapshots, non-migrations and unrelated source layouts receive no migration reminder', () => {
    const attribute = '[Migration("add-berths")]\npublic class AddBerths;\n';
    assert.equal(reminder('Source/Marina/Migrations/MarinaModelSnapshot.cs', attribute), '');
    assert.equal(reminder('Source/Marina/Migrations/Notes.cs', 'public class Notes;\n'), '');
    assert.equal(reminder('Library/Migrations/AddBerths.cs', attribute), '');
});
