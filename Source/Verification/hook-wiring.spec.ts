// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * The Claude hook wiring must not depend on the scripts' execute bit. An install or checkout can lose it
 * (Cratis/AI#480), and Claude Code treats `Permission denied` as a non-blocking hook error, so a script
 * invoked directly would silently stop guarding. Every wired command therefore runs its script through `bash`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../..');
const templatePath = join(root, '.cratis/ai/hooks/settings.template.json');

type Hook = { type: string; command: string };
type Entry = { matcher?: string; hooks: Hook[] };

function wiredCommands(): string[] {
    const template = JSON.parse(readFileSync(templatePath, 'utf8')) as { hooks: Record<string, Entry[]> };
    return Object.values(template.hooks).flat().flatMap(entry => entry.hooks.map(hook => hook.command));
}

test('every Claude hook command runs its script through bash', () => {
    const commands = wiredCommands();
    assert.ok(commands.length >= 5, `expected the five wired guards, found ${commands.length}`);
    for (const command of commands) {
        assert.match(command, /^bash "\$CLAUDE_PROJECT_DIR"\/\.cratis\/ai\/hooks\/scripts\/[a-z-]+\.sh( --hook)?$/, command);
    }
});

test('the secrets guard is wired on Bash beside the store-mutation guard', () => {
    const template = JSON.parse(readFileSync(templatePath, 'utf8')) as { hooks: Record<string, Entry[]> };
    const bash = template.hooks.PreToolUse.find(entry => entry.matcher === 'Bash');
    const commands = bash?.hooks.map(hook => hook.command) ?? [];
    assert.ok(commands.some(command => command.endsWith('/cratis-guard-secrets.sh')), 'the secrets guard is wired on Bash');
    assert.ok(commands.some(command => command.endsWith('/cratis-guard-store-mutations.sh')), 'the store-mutation guard stays wired');
});

test('the wired secrets guard still blocks when its script has lost the execute bit', () => {
    const command = wiredCommands().find(candidate => candidate.endsWith('/cratis-guard-secrets.sh'));
    assert.ok(command, 'the secrets guard is wired');
    const project = mkdtempSync(join(tmpdir(), 'hook-wiring-secrets-'));
    try {
        const scripts = join(project, '.cratis/ai/hooks/scripts');
        spawnSync('mkdir', ['-p', scripts]);
        for (const file of ['cratis-guard-secrets.sh', 'hook-lib.sh']) {
            copyFileSync(join(root, '.cratis/ai/hooks/scripts', file), join(scripts, file));
            chmodSync(join(scripts, file), 0o644);
        }
        const run = spawnSync('bash', ['-c', command!], {
            input: JSON.stringify({ session_id: 't', cwd: project, tool_name: 'Bash', tool_input: { command: 'kubectl get pods -o json' } }),
            cwd: project, encoding: 'utf8',
            env: { ...process.env, CLAUDE_PROJECT_DIR: project, CRATIS_HOOKS_ALLOW_SECRET_READS: '0' },
        });
        assert.equal(run.status, 2, `expected a block (exit 2), got ${run.status}: ${run.stderr}`);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test('a wired guard still blocks when its script has lost the execute bit', () => {
    const command = wiredCommands().find(candidate => candidate.endsWith('/cratis-guard-writes.sh'));
    assert.ok(command, 'the write guard is wired');
    const project = mkdtempSync(join(tmpdir(), 'hook-wiring-'));
    try {
        const scripts = join(project, '.cratis/ai/hooks/scripts');
        spawnSync('mkdir', ['-p', scripts]);
        for (const file of ['cratis-guard-writes.sh', 'hook-lib.sh']) {
            copyFileSync(join(root, '.cratis/ai/hooks/scripts', file), join(scripts, file));
            chmodSync(join(scripts, file), 0o644);
        }
        const payload = JSON.stringify({
            session_id: 't', cwd: project, tool_name: 'Edit',
            tool_input: { file_path: join(project, 'Directory.Packages.props'), new_string: 'x' },
        });
        const run = spawnSync('bash', ['-c', command!], {
            input: payload, cwd: project, encoding: 'utf8',
            env: { ...process.env, CLAUDE_PROJECT_DIR: project },
        });
        assert.equal(run.status, 2, `expected a block (exit 2), got ${run.status}: ${run.stderr}`);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});
