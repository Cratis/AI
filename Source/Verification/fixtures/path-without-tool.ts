// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Tools the hook scripts need besides the one a spec removes. */
export const hookTools = ['bash', 'cat', 'dirname', 'tr', 'awk', 'git', 'sed', 'grep', 'head', 'basename', 'mkdir', 'rm', 'env'];

function locate(tool: string): string | undefined {
    const located = spawnSync('bash', ['-c', 'command -v "$1"', 'bash', tool], { encoding: 'utf8' });
    return located.status === 0 ? located.stdout.trim() : undefined;
}

/**
 * Builds a PATH that holds a symlink for each tool in `needed` except `tool`. Removing entries from the real PATH
 * does not work because macOS keeps jq in /usr/bin beside the system tools, so the directory is assembled instead.
 */
export function pathWithout(tool: string, needed: string[] = hookTools): { path: string; dispose(): void } {
    const directory = mkdtempSync(join(tmpdir(), 'cratis-path-without-'));
    for (const name of needed) {
        const target = name === tool ? undefined : locate(name);
        if (target) symlinkSync(target, join(directory, name));
    }
    const probe = spawnSync('/bin/bash', ['-c', `command -v ${tool}`], { encoding: 'utf8', env: { PATH: directory } });
    if (probe.status === 0) {
        rmSync(directory, { recursive: true, force: true });
    }
    assert.notEqual(probe.status, 0, `${tool} must really be absent from PATH`);
    return { path: directory, dispose: () => rmSync(directory, { recursive: true, force: true }) };
}
